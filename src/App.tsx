import { useCallback, useEffect, useState, type MouseEvent } from "react"

import { HelpDialog } from "@/components/help-dialog"
import { Toaster, toast } from "@/components/ui/toast"
import {
  adminCalendarExists,
  emailDomainAllowed,
  errMessage,
  normalizeWeekHours,
  weekHoursErrorMessage,
} from "@/lib/booking"
import {
  bookingPageHref,
  navigateToBookingUrl,
  readBootstrap,
  syncDocumentTitle,
} from "@/lib/bootstrap"
import {
  adminGetState,
  adminSaveSettings,
  cancelBooking,
  createBooking,
  getBooking,
  getPublicConfig,
  getSlots,
} from "@/lib/gas-api"
import type {
  AdminCalendar,
  AdminSettings,
  AppView,
  Bootstrap,
  PublicBooking,
  PublicConfig,
} from "@/lib/types"
import { AdminPage } from "@/pages/admin-page"
import { BookPage } from "@/pages/book-page"
import { CancelPage } from "@/pages/cancel-page"
import { DonePage } from "@/pages/done-page"

/**
 * 予約・確定・キャンセル・管理の画面を切り替える。
 * @returns アプリの画面。
 */
export function App() {
  const [boot, setBoot] = useState<Bootstrap>(() => readBootstrap())
  const [view, setView] = useState<AppView>(boot.page)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [durationMin, setDurationMin] = useState(30)
  const [withMeet, setWithMeet] = useState(true)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const [starts, setStarts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [booking, setBooking] = useState<PublicBooking | null>(null)
  const [form, setForm] = useState({ name: "", eventTitle: "", email: "", note: "" })
  const [adminPatch, setAdminPatch] = useState<AdminSettings | null>(null)
  const [calendars, setCalendars] = useState<AdminCalendar[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const bookingHref = bookingPageHref(boot.webAppUrl)

  useEffect(() => {
    syncDocumentTitle(view)
  }, [view])

  const loadSlots = useCallback((minutes: number) => {
    setLoading(true)
    setError("")
    getSlots(minutes)
      .then((result) => {
        setStarts(result?.starts || [])
        setLoading(false)
      })
      .catch((caught) => {
        setLoading(false)
        setError(errMessage(caught))
      })
  }, [])

  const loadBookView = useCallback(() => {
    setLoading(true)
    setError("")
    getPublicConfig()
      .then((next) => {
        setConfig(next)
        let nextDuration = 30
        if (next?.durations && !next.durations.includes(30)) {
          nextDuration = next.durations[1] || next.durations[0]
        }
        setDurationMin(nextDuration)
        loadSlots(nextDuration)
      })
      .catch((caught) => {
        setLoading(false)
        setError(errMessage(caught))
      })
  }, [loadSlots])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (view === "admin") {
        setLoading(true)
        try {
          const result = await adminGetState(boot.adminKey)
          if (cancelled) return
          const next = structuredClone(result.settings)
          next.weekHours = normalizeWeekHours(next.weekHours)
          next.busyCalendarIds = (next.busyCalendarIds || []).filter((id) =>
            adminCalendarExists(id, result.calendars || [])
          )
          setCalendars(result.calendars || [])
          setAdminPatch(next)
          setLoading(false)
        } catch (caught) {
          if (cancelled) return
          setLoading(false)
          setError(errMessage(caught))
        }
        return
      }
      if (view === "cancel" || view === "done") {
        setLoading(true)
        try {
          const next = await getBooking(boot.token)
          if (cancelled) return
          setBooking(next)
          setLoading(false)
        } catch (caught) {
          if (cancelled) return
          setLoading(false)
          setError(errMessage(caught))
        }
        return
      }
      loadBookView()
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [boot.adminKey, boot.token, loadBookView, view])

  const goToBookingPage = (event?: MouseEvent<HTMLAnchorElement>) => {
    if (submitting) {
      event?.preventDefault()
      return
    }
    if (
      event &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    ) {
      return
    }
    event?.preventDefault()
    if (view === "book") {
      setHelpOpen(false)
      setSelectedStart(null)
      setError("")
      window.scrollTo(0, 0)
      return
    }
    if (bookingHref) {
      navigateToBookingUrl(bookingHref)
      return
    }
    setBoot((current) => ({ ...current, page: "book", token: "" }))
    setView("book")
    setBooking(null)
    setError("")
    setHelpOpen(false)
    setSelectedStart(null)
    setSelectedDay(null)
    setForm({ name: "", eventTitle: "", email: "", note: "" })
    loadBookView()
  }

  const submitBooking = () => {
    if (submitting || !selectedStart) return
    if (!emailDomainAllowed(form.email, config?.allowedEmailDomains)) {
      setError("このドメインのメールアドレスでは予約できません。")
      return
    }
    setSubmitting(true)
    setError("")
    setHelpOpen(false)
    createBooking({
      durationMin,
      withMeet,
      startIso: selectedStart,
      name: form.name,
      eventTitle: form.eventTitle,
      email: form.email,
      note: form.note,
    })
      .then((next) => {
        setBooking(next)
        setSubmitting(false)
        setView("done")
      })
      .catch((caught) => {
        setSubmitting(false)
        setError(errMessage(caught))
      })
  }

  const saveAdmin = () => {
    if (!adminPatch || submitting) return
    const hoursError = weekHoursErrorMessage(adminPatch.weekHours)
    if (hoursError) {
      setError(hoursError)
      return
    }
    if (!adminCalendarExists(adminPatch.writeCalendarId, calendars) || !(adminPatch.busyCalendarIds || []).length) {
      setError("このカレンダーはもうありません。選び直してください。")
      return
    }
    setSubmitting(true)
    setError("")
    adminSaveSettings(boot.adminKey, adminPatch)
      .then((settings) => {
        const next = structuredClone(settings)
        next.weekHours = normalizeWeekHours(next.weekHours)
        setAdminPatch(next)
        setSubmitting(false)
        setError("")
        toast.add({ type: "success", title: "保存しました" })
      })
      .catch((caught) => {
        setSubmitting(false)
        setError(errMessage(caught))
      })
  }

  return (
    <>
      {view === "admin" ? (
        <AdminPage
          patch={adminPatch}
          calendars={calendars}
          loading={loading}
          submitting={submitting}
          error={error}
          bookingHref={bookingHref}
          onBrandClick={goToBookingPage}
          onHelp={() => {
            if (!submitting) setHelpOpen(true)
          }}
          onPatch={setAdminPatch}
          onSave={saveAdmin}
        />
      ) : null}
      {view === "cancel" ? (
        <CancelPage
          booking={booking}
          loading={loading}
          submitting={submitting}
          error={error}
          bookingHref={bookingHref}
          onBrandClick={goToBookingPage}
          onHelp={() => {
            if (!submitting) setHelpOpen(true)
          }}
          onCancel={() => {
            if (submitting) return
            setSubmitting(true)
            setError("")
            setHelpOpen(false)
            cancelBooking(boot.token)
              .then((next) => {
                setBooking(next)
                setSubmitting(false)
              })
              .catch((caught) => {
                setSubmitting(false)
                setError(errMessage(caught))
              })
          }}
          onBookAgain={goToBookingPage}
        />
      ) : null}
      {view === "done" ? (
        <DonePage
          booking={booking}
          bookingHref={bookingHref}
          submitting={submitting}
          onBrandClick={goToBookingPage}
          onHelp={() => {
            if (!submitting) setHelpOpen(true)
          }}
        />
      ) : null}
      {view === "book" ? (
        <BookPage
          config={config}
          durationMin={durationMin}
          withMeet={withMeet}
          month={month}
          selectedDay={selectedDay}
          selectedStart={selectedStart}
          starts={starts}
          loading={loading}
          submitting={submitting}
          error={error}
          form={form}
          bookingHref={bookingHref}
          onBrandClick={goToBookingPage}
          onHelp={() => {
            if (!submitting) setHelpOpen(true)
          }}
          onDurationChange={(value) => {
            setDurationMin(value)
            setSelectedStart(null)
            setSelectedDay(null)
            loadSlots(value)
          }}
          onMeetChange={setWithMeet}
          onMonthChange={setMonth}
          onSelectDay={(day) => {
            setSelectedDay(day)
            setSelectedStart(null)
          }}
          onSelectStart={(iso) => {
            setSelectedStart(iso)
            setError("")
          }}
          onFormChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
          onCloseDrawer={() => {
            if (submitting) return
            setSelectedStart(null)
            setError("")
          }}
          onSubmit={submitBooking}
        />
      ) : null}
      <HelpDialog
        open={helpOpen && !submitting}
        onOpenChange={setHelpOpen}
        view={view}
      />
      <Toaster />
    </>
  )
}

export default App

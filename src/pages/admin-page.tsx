import { useMemo, useState, type MouseEvent } from "react"
import { Copy, Plus, Trash2 } from "lucide-react"

import { FieldLabel } from "@/components/field-label"
import { ErrorBanner, PageShell, Spinner } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  adminCalendarExists,
  calendarOptionLabel,
  dayHourIssues,
  dayRanges,
  hmToMin,
  sortedAdminCalendars,
  suggestNextRange,
  WEEK_KEYS,
} from "@/lib/booking"
import { TIMEZONES } from "@/lib/timezones"
import type { AdminCalendar, AdminSettings, HourRange } from "@/lib/types"

/**
 * 管理画面を表示する。
 * @param props 設定と保存操作。
 * @returns 管理画面。
 */
export function AdminPage({
  patch,
  calendars,
  loading,
  submitting,
  error,
  bookingHref,
  onBrandClick,
  onHelp,
  onPatch,
  onSave,
}: {
  patch: AdminSettings | null
  calendars: AdminCalendar[]
  loading: boolean
  submitting: boolean
  error: string
  bookingHref: string
  onBrandClick: (event: MouseEvent<HTMLAnchorElement>) => void
  onHelp: () => void
  onPatch: (next: AdminSettings) => void
  onSave: () => void
}) {
  const adminCals = useMemo(() => sortedAdminCalendars(calendars), [calendars])
  const writeGone = patch ? !adminCalendarExists(patch.writeCalendarId, calendars) : false
  const busyGone = patch ? !(patch.busyCalendarIds || []).length : false
  const anyGone = writeGone || busyGone
  const timezoneOptions = useMemo(() => {
    const current = patch?.timezone || "Asia/Tokyo"
    if (TIMEZONES.some((item) => item.value === current)) return [...TIMEZONES]
    return [{ value: current, label: current }, ...TIMEZONES]
  }, [patch?.timezone])

  return (
    <PageShell
      lede="管理画面"
      bookingHref={bookingHref}
      submitting={submitting}
      onBrandClick={onBrandClick}
      onHelp={onHelp}
      showFoot={false}
    >
      <Card>
        <CardContent>
          {loading && !patch ? <Spinner /> : null}
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          {patch && !error && anyGone ? (
            <ErrorBanner>このカレンダーはもうありません。選び直してください。</ErrorBanner>
          ) : null}
          {patch ? (
            <div className="grid gap-5">
              <div>
                <FieldLabel
                  text="表示名"
                  htmlFor="admin-hostName"
                  hint="予約ページの見出しに表示します。"
                />
                <Input
                  id="admin-hostName"
                  value={patch.hostName || ""}
                  onChange={(event) => onPatch({ ...patch, hostName: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel
                  text="許可するメールドメイン"
                  htmlFor="admin-domains"
                  hint="空欄なら制限しません。1行に1つ、@ は不要です。例: example.com"
                />
                <Textarea
                  id="admin-domains"
                  rows={3}
                  placeholder="example.com"
                  value={
                    Array.isArray(patch.allowedEmailDomains)
                      ? patch.allowedEmailDomains.join("\n")
                      : String(patch.allowedEmailDomains || "")
                  }
                  onChange={(event) =>
                    onPatch({ ...patch, allowedEmailDomains: event.target.value })
                  }
                />
              </div>
              <div>
                <FieldLabel
                  text="タイムゾーン"
                  hint="空き時間と予約の表示に使うタイムゾーンです。"
                />
                <Select
                  value={patch.timezone || "Asia/Tokyo"}
                  onValueChange={(value) => onPatch({ ...patch, timezone: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberField
                id="admin-buffer"
                label="会議前後のバッファ（分）"
                hint="カレンダー上の予定の前後に、この分数だけ予約を入れられなくします。"
                value={patch.bufferMin}
                onChange={(value) => onPatch({ ...patch, bufferMin: value })}
              />
              <NumberField
                id="admin-notice"
                label="最短何分前まで予約可"
                hint="いまからこの分数以内の枠は予約できません。"
                value={patch.minNoticeMin}
                onChange={(value) => onPatch({ ...patch, minNoticeMin: value })}
              />
              <NumberField
                id="admin-ahead"
                label="何日先まで予約可"
                hint="今日から何日先までの空きを公開するかを決めます。"
                value={patch.maxDaysAhead}
                onChange={(value) => onPatch({ ...patch, maxDaysAhead: value })}
              />
              <div>
                <FieldLabel text="受付時間" hint="曜日ごとに予約を受け付ける時間帯です。" />
                <div className="grid gap-3">
                  {WEEK_KEYS.map((day) => (
                    <WeekRow
                      key={day.key}
                      day={day}
                      patch={patch}
                      onPatch={onPatch}
                    />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel
                  text="予定の書き込み先"
                  hint="確定した予約を入れるカレンダーです。"
                />
                <Select
                  value={writeGone ? "" : patch.writeCalendarId}
                  onValueChange={(value) => onPatch({ ...patch, writeCalendarId: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="カレンダーを選び直してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminCals.map((calendar) => (
                      <SelectItem key={calendar.id} value={calendar.id}>
                        {calendarOptionLabel(calendar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {writeGone ? (
                  <p className="mt-2 text-sm text-destructive">
                    このカレンダーはもうありません。選び直してください。
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel
                  text="空き判定に使うカレンダー"
                  hint="予定が入っている時間を空きから除外するカレンダーです。複数選べます。"
                />
                <div className="grid gap-2">
                  {adminCals.map((calendar) => {
                    const checked = (patch.busyCalendarIds || []).includes(calendar.id)
                    return (
                      <label className="flex items-center gap-2 text-sm" key={calendar.id}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const set = new Set(patch.busyCalendarIds || [])
                            if (value === true) set.add(calendar.id)
                            else set.delete(calendar.id)
                            onPatch({ ...patch, busyCalendarIds: Array.from(set) })
                          }}
                        />
                        {calendarOptionLabel(calendar)}
                      </label>
                    )
                  })}
                </div>
                {busyGone ? (
                  <p className="mt-2 text-sm text-destructive">
                    このカレンダーはもうありません。選び直してください。
                  </p>
                ) : null}
              </div>
              <div>
                <Button type="button" disabled={submitting || anyGone} onClick={onSave}>
                  {submitting ? "保存しています…" : "設定を保存"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  )
}

/**
 * 数値設定欄を表示する。
 * @param props ラベルと値。
 * @returns 数値入力。
 */
function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <FieldLabel text={label} htmlFor={id} hint={hint} />
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

/**
 * 1曜日の受付時間を表示する。
 * @param props 曜日と設定。
 * @returns 曜日行。
 */
function WeekRow({
  day,
  patch,
  onPatch,
}: {
  day: (typeof WEEK_KEYS)[number]
  patch: AdminSettings
  onPatch: (next: AdminSettings) => void
}) {
  const ranges = dayRanges(patch.weekHours[day.key])
  const enabled = ranges.length > 0
  const issues = dayHourIssues(ranges)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyKeys, setCopyKeys] = useState<string[]>([])

  const setRanges = (next: HourRange[] | null) => {
    onPatch({
      ...patch,
      weekHours: { ...patch.weekHours, [day.key]: next },
    })
  }

  return (
    <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[4rem_1fr] md:items-start">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={enabled}
          onCheckedChange={(value) => {
            setRanges(value === true ? [{ start: "10:00", end: "18:00" }] : null)
          }}
        />
        {day.label}
      </label>
      <div className="grid gap-2">
        {!enabled ? (
          <div className="text-sm text-muted-foreground">休み</div>
        ) : (
          <>
            {ranges.map((range, index) => {
              const bad = !!(issues.invalid[index] || issues.overlap[index])
              return (
                <div className="flex flex-wrap items-center gap-2" key={`${day.key}-${index}`}>
                  <Input
                    type="time"
                    className="w-auto"
                    value={range.start}
                    aria-invalid={bad}
                    onChange={(event) => {
                      const next = dayRanges(patch.weekHours[day.key])
                      next[index] = { start: event.target.value, end: range.end }
                      setRanges(next)
                    }}
                  />
                  <span className="text-sm text-muted-foreground">〜</span>
                  <Input
                    type="time"
                    className="w-auto"
                    value={range.end}
                    aria-invalid={bad}
                    onChange={(event) => {
                      const next = dayRanges(patch.weekHours[day.key])
                      next[index] = { start: range.start, end: event.target.value }
                      setRanges(next)
                    }}
                  />
                  {ranges.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="この時間帯を削除"
                      onClick={() => {
                        const next = dayRanges(patch.weekHours[day.key])
                        next.splice(index, 1)
                        setRanges(next.length ? next : null)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                  {index === ranges.length - 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="時間帯を追加"
                        onClick={() => {
                          const next = dayRanges(patch.weekHours[day.key])
                          if (
                            next.length === 1 &&
                            hmToMin(next[0].end) - hmToMin(next[0].start) >= 6 * 60
                          ) {
                            const originalEnd = next[0].end
                            next[0] = { start: next[0].start, end: "12:00" }
                            next.push({ start: "13:00", end: originalEnd })
                          } else {
                            next.push(suggestNextRange(next))
                          }
                          setRanges(next)
                        }}
                      >
                        <Plus />
                      </Button>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="他の曜日に複製"
                          aria-expanded={copyOpen}
                          onClick={(event) => {
                            event.stopPropagation()
                            setCopyOpen((current) => !current)
                            setCopyKeys([])
                          }}
                        >
                          <Copy />
                        </Button>
                        {copyOpen ? (
                          <div
                            className="absolute top-full right-0 z-20 mt-1 w-56 rounded-lg border bg-popover p-3 text-sm shadow-md"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="font-medium">{day.label}の時間帯を複製</div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const others = WEEK_KEYS.filter((item) => item.key !== day.key).map(
                                    (item) => item.key
                                  )
                                  setCopyKeys(copyKeys.length === others.length ? [] : others)
                                }}
                              >
                                すべて
                              </Button>
                            </div>
                            <div className="grid gap-2">
                              {WEEK_KEYS.filter((item) => item.key !== day.key).map((other) => (
                                <label className="flex items-center gap-2" key={other.key}>
                                  <Checkbox
                                    checked={copyKeys.includes(other.key)}
                                    onCheckedChange={(value) => {
                                      setCopyKeys((current) =>
                                        value === true
                                          ? [...current, other.key]
                                          : current.filter((key) => key !== other.key)
                                      )
                                    }}
                                  />
                                  {other.label}
                                </label>
                              ))}
                            </div>
                            <Button
                              type="button"
                              className="mt-3 w-full"
                              size="sm"
                              disabled={!copyKeys.length}
                              onClick={() => {
                                const source = dayRanges(patch.weekHours[day.key])
                                if (!source.length) return
                                const weekHours = { ...patch.weekHours }
                                copyKeys.forEach((key) => {
                                  weekHours[key] = JSON.parse(JSON.stringify(source))
                                })
                                onPatch({ ...patch, weekHours })
                                setCopyOpen(false)
                              }}
                            >
                              適用
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
            {issues.messages.length ? (
              <div className="text-sm text-destructive">{issues.messages.join(" ")}</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

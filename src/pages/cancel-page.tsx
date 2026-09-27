import type { MouseEvent } from "react"

import { BookingFacts } from "@/components/booking-facts"
import { BusyOverlay } from "@/components/busy-overlay"
import { ErrorBanner, PageShell, Spinner } from "@/components/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatRange } from "@/lib/booking"
import type { PublicBooking } from "@/lib/types"

/**
 * キャンセル画面を表示する。
 * @param props 予約、状態、操作。
 * @returns キャンセル画面。
 */
export function CancelPage({
  booking,
  loading,
  submitting,
  error,
  bookingHref,
  onBrandClick,
  onHelp,
  onCancel,
  onBookAgain,
}: {
  booking: PublicBooking | null
  loading: boolean
  submitting: boolean
  error: string
  bookingHref: string
  onBrandClick: (event: MouseEvent<HTMLAnchorElement>) => void
  onHelp: () => void
  onCancel: () => void
  onBookAgain: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <PageShell
      lede="予約のキャンセル"
      bookingHref={bookingHref}
      submitting={submitting}
      onBrandClick={onBrandClick}
      onHelp={onHelp}
    >
      <Card>
        <CardContent>
          {loading ? <Spinner /> : null}
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          {booking ? (
            <>
              <Badge variant={booking.status === "cancelled" ? "secondary" : "default"}>
                {booking.status === "cancelled" ? "キャンセル済み" : "確定中"}
              </Badge>
              <h2 className="mt-3 text-lg font-medium">
                {formatRange(booking.startIso, booking.endIso)}
              </h2>
              <BookingFacts booking={booking} />
              {booking.status !== "cancelled" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    この予約を取り消します。カレンダー上の予定も削除されます。
                  </p>
                  <div className="mt-4">
                    <Button type="button" variant="destructive" disabled={submitting} onClick={onCancel}>
                      {submitting ? "キャンセルしています…" : "予約をキャンセルする"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    別の日時で予約し直すことができます。
                  </p>
                  <div className="mt-4">
                    <Button asChild>
                      <a href={bookingHref || "#"} target="_top" onClick={onBookAgain}>
                        新しく予約する
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
      {submitting ? <BusyOverlay text="キャンセルしています…" /> : null}
    </PageShell>
  )
}

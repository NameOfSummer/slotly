import type { MouseEvent } from "react"

import { BookingFacts } from "@/components/booking-facts"
import { PageShell, Spinner } from "@/components/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatRange } from "@/lib/booking"
import { safeHref } from "@/lib/booking"
import type { PublicBooking } from "@/lib/types"

/**
 * 予約確定画面を表示する。
 * @param props 予約と共通操作。
 * @returns 確定画面。
 */
export function DonePage({
  booking,
  bookingHref,
  submitting,
  onBrandClick,
  onHelp,
}: {
  booking: PublicBooking | null
  bookingHref: string
  submitting: boolean
  onBrandClick: (event: MouseEvent<HTMLAnchorElement>) => void
  onHelp: () => void
}) {
  return (
    <PageShell
      lede="予約が確定しました"
      bookingHref={bookingHref}
      submitting={submitting}
      onBrandClick={onBrandClick}
      onHelp={onHelp}
    >
      <Card>
        <CardContent>
          {!booking ? (
            <Spinner />
          ) : (
            <>
              <Badge>確定</Badge>
              <h2 className="mt-3 text-lg font-medium">
                {formatRange(booking.startIso, booking.endIso)}
              </h2>
              <BookingFacts booking={booking} />
              <div className="grid gap-2 text-sm">
                {safeHref(booking.icsUrl) ? (
                  <a className="underline underline-offset-2" href={safeHref(booking.icsUrl)}>
                    その他のカレンダー用に ICS ファイルをダウンロード
                  </a>
                ) : null}
                {safeHref(booking.cancelUrl) ? (
                  <a className="underline underline-offset-2" href={safeHref(booking.cancelUrl)}>
                    この予約をキャンセルする
                  </a>
                ) : null}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                確定メールを送りました。メール内のリンクからもキャンセルできます。
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}

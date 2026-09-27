import type { ReactNode } from "react"

import { formatDuration, safeHref } from "@/lib/booking"
import type { PublicBooking } from "@/lib/types"

/**
 * 確定・キャンセル画面の予約内容を並べる。
 * @param props 予約。
 * @returns 項目一覧。
 */
export function BookingFacts({ booking }: { booking: PublicBooking }) {
  const meetHref = safeHref(booking.meetUrl)
  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: "予定のタイトル", value: booking.title },
    { label: "所要時間", value: formatDuration(booking.durationMin) },
    {
      label: "場所",
      value: booking.withMeet ? (
        meetHref ? (
          <>
            Google Meet (
            <a className="underline underline-offset-2" href={meetHref}>
              {booking.meetUrl}
            </a>
            )
          </>
        ) : (
          "Google Meet"
        )
      ) : (
        "Meetなし"
      ),
    },
    { label: "予約者", value: booking.guestName },
    { label: "説明", value: booking.note },
  ]

  return (
    <ul className="my-4 grid gap-2 text-sm">
      {rows.map((row) =>
        row.value ? (
          <li className="grid grid-cols-[7rem_1fr] gap-3" key={row.label}>
            <span className="text-muted-foreground">{row.label}</span>
            <span className="min-w-0 break-words">{row.value}</span>
          </li>
        ) : null
      )}
    </ul>
  )
}

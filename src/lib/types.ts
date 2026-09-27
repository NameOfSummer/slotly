/**
 * 予約ページの公開設定。
 */
export type PublicConfig = {
  configured: boolean
  appName: string
  hostName: string
  timezone: string
  durations: number[]
  maxDaysAhead: number
  minNoticeMin: number
  allowedEmailDomains: string[]
}

/**
 * ゲストに見せる予約の内容。
 */
export type PublicBooking = {
  token: string
  status: string
  title: string
  guestName: string
  guestEmail: string
  startIso: string
  endIso: string
  durationMin: number
  withMeet: boolean
  meetUrl: string
  note: string
  icsUrl?: string
  cancelUrl?: string
  googleUrl?: string
}

/**
 * 空き枠の一覧。
 */
export type SlotList = {
  timezone: string
  durationMin: number
  starts: string[]
}

/**
 * 1日の受付時間帯。
 */
export type HourRange = {
  start: string
  end: string
}

/**
 * 管理画面の設定。
 */
export type AdminSettings = {
  hostName: string
  timezone: string
  bufferMin: number
  minNoticeMin: number
  maxDaysAhead: number
  writeCalendarId: string
  busyCalendarIds: string[]
  weekHours: Record<string, HourRange[] | null>
  allowedEmailDomains: string[] | string
}

/**
 * 管理画面に出すカレンダー。
 */
export type AdminCalendar = {
  id: string
  name: string
  primary?: boolean
  owned?: boolean
}

/**
 * 管理画面の読み込み結果。
 */
export type AdminState = {
  settings: AdminSettings
  calendars: AdminCalendar[]
}

/**
 * 予約を作るときに送る値。
 */
export type CreateBookingPayload = {
  durationMin: number
  withMeet: boolean
  startIso: string
  name: string
  eventTitle: string
  email: string
  note: string
}

/**
 * 画面の種類。
 */
export type AppView = "book" | "done" | "cancel" | "admin"

/**
 * GAS から渡された初期値。
 */
export type Bootstrap = {
  page: AppView
  token: string
  adminKey: string
  webAppUrl: string
}

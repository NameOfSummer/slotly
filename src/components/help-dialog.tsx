import type { ReactNode } from "react"
import {
  ArrowDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  Link2,
  Lock,
  Mail,
  Send,
  Settings,
  User,
  Video,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AppView } from "@/lib/types"

/**
 * 使い方の1段。
 */
type HelpStep = {
  title: string
  text: string
  icons: ReactNode[]
}

/**
 * 画面に応じた使い方を返す。
 * @param view いまの画面。
 * @returns 手順。
 */
function helpCopy(view: AppView): HelpStep[] {
  if (view === "admin") {
    return [
      {
        title: "設定を保存",
        text: "表示名・受付時間・カレンダーなどを確認して、設定を保存します。",
        icons: [<Settings key="settings" />],
      },
      {
        title: "URL だけ渡す",
        text: "相手には予約ページの URL だけを渡します。管理キーは渡さないでください。",
        icons: [<Link2 key="link" />, <Lock key="lock" />],
      },
      {
        title: "カレンダーに入る",
        text: "予約が入ると書き込み先カレンダーに予定が増えます。日常の操作はカレンダー側です。",
        icons: [<CalendarDays key="event" />],
      },
    ]
  }
  return [
    {
      title: "時間と場所",
      text: "所要時間と、Google Meet の有無を選びます。",
      icons: [<Clock key="schedule" />, <Video key="videocam" />],
    },
    {
      title: "日付と時刻",
      text: "点が付いている日から、空き時間を選びます。",
      icons: [<CalendarDays key="calendar" />],
    },
    {
      title: "お名前とメール",
      text: "お名前とメールアドレスを入れて予約を確定します。予定のタイトルと説明は任意です。",
      icons: [<User key="person" />, <Mail key="mail" />],
    },
    {
      title: "確定メール",
      text: "確定メールが届きます。メールのリンクからキャンセルもできます。",
      icons: [<Send key="send" />, <CheckCircle2 key="check" />],
    },
  ]
}

/**
 * 使い方のダイアログを表示する。
 * @param props 開閉と画面の種類。
 * @returns ダイアログ。
 */
export function HelpDialog({
  open,
  onOpenChange,
  view,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: AppView
}) {
  const steps = helpCopy(view)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>使い方</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {steps.map((step, index) => (
            <div key={step.title}>
              <div className="flex gap-3">
                <div className="flex gap-1 text-muted-foreground" aria-hidden>
                  {step.icons.map((icon, iconIndex) => (
                    <span
                      className="flex size-8 items-center justify-center rounded-lg bg-muted [&_svg]:size-4"
                      key={iconIndex}
                    >
                      {icon}
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {step.text.replace(/。/g, "。\n").replace(/\n+$/, "")}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div className="my-2 flex justify-center text-muted-foreground" aria-hidden>
                  <ArrowDown className="size-4" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

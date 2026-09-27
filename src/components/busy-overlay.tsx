/**
 * 操作を止めるマスクを表示する。
 * @param props 表示する文言と配置。
 * @returns マスク。
 */
export function BusyOverlay({
  text,
  placement = "page",
}: {
  text: string
  placement?: "page" | "dialog"
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        placement === "page"
          ? "fixed inset-0 z-[80] flex items-center justify-center bg-background/70 text-sm font-medium"
          : "absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 text-sm font-medium"
      }
    >
      {text}
    </div>
  )
}

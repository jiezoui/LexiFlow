"use client"

import Link from "next/link"
import { SearchIcon, VideoIcon, LineChartIcon } from "lucide-react"

export function QuickActionDock() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Action 1: Lookup word */}
      <button
        onClick={() => {
          const event = new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          })
          document.dispatchEvent(event)
        }}
        className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-zinc-400 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <SearchIcon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <strong className="block text-xs sm:text-sm font-bold text-foreground">
            查一个词
          </strong>
          <span className="block mt-0.5 text-[11px] text-muted-foreground truncate">
            本地 ECDICT 词典 5ms 秒级瞬时返回
          </span>
        </div>
      </button>

      {/* Action 2: Import Video */}
      <Link
        href="/videos"
        className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-zinc-400 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <VideoIcon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <strong className="block text-xs sm:text-sm font-bold text-foreground">
            导入精听视频
          </strong>
          <span className="block mt-0.5 text-[11px] text-muted-foreground truncate">
            从 YouTube / B站 语料采词
          </span>
        </div>
      </Link>

      {/* Action 3: Analytics */}
      <Link
        href="/vocab"
        className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-zinc-400 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <LineChartIcon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <strong className="block text-xs sm:text-sm font-bold text-foreground">
            FSRS 记忆热度
          </strong>
          <span className="block mt-0.5 text-[11px] text-muted-foreground truncate">
            查看真实遗忘率与稳定性曲线
          </span>
        </div>
      </Link>
    </div>
  )
}

"use client"

import { useState } from "react"
import { FlameIcon, CalendarIcon } from "lucide-react"
import { mockHeatmapMatrix, mockTodayStats } from "@/data/mock-lexiflow"

export function LearningHeatmap() {
  const [hoveredDay, setHoveredDay] = useState<{ index: number; count: number } | null>(null)

  const getColorClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
      case 2:
        return "bg-zinc-500 dark:bg-zinc-500 hover:bg-zinc-600"
      case 3:
        return "bg-zinc-700 dark:bg-zinc-300 hover:bg-zinc-800"
      case 4:
        return "bg-zinc-950 dark:bg-zinc-100 hover:bg-black"
      default:
        return "bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200"
    }
  }

  return (
    <article className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm">
      <div>
        {/* Header & Legend */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              研习心流与节奏
            </span>
            <h3 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <CalendarIcon className="size-4 text-foreground" />
              保持轻，但别断
            </h3>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <span>少</span>
            <span className="size-2.5 rounded-[3px] bg-zinc-100 dark:bg-zinc-800" />
            <span className="size-2.5 rounded-[3px] bg-zinc-300 dark:bg-zinc-700" />
            <span className="size-2.5 rounded-[3px] bg-zinc-500 dark:bg-zinc-500" />
            <span className="size-2.5 rounded-[3px] bg-zinc-700 dark:bg-zinc-300" />
            <span className="size-2.5 rounded-[3px] bg-zinc-950 dark:bg-zinc-100" />
            <span>多</span>
          </div>
        </div>

        {/* Heatmap Grid (13 weeks x 7 days) */}
        <div className="mt-6">
          <div className="grid grid-cols-13 gap-1.5 sm:gap-2">
            {mockHeatmapMatrix.map((level, i) => {
              const reviews = level === 0 ? 0 : level * 8 + 3
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredDay({ index: i, count: reviews })}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`aspect-square w-full rounded-[4px] transition-transform duration-150 cursor-pointer ${getColorClass(
                    level
                  )} hover:scale-125 hover:z-10`}
                  title={`第 ${i + 1} 天: ${reviews > 0 ? `${reviews} 次复习` : "休息日"}`}
                />
              )
            })}
          </div>

          {/* Dynamic hover tip */}
          <div className="mt-3 min-h-[20px] text-xs font-mono text-muted-foreground">
            {hoveredDay ? (
              <span className="text-foreground font-semibold">
                选定记录：{hoveredDay.count > 0 ? `${hoveredDay.count} 次 FSRS 记忆反馈` : "心流沉淀休息日"}
              </span>
            ) : (
              <span>近 13 周打卡与记忆沉淀矩阵</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-border flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1 text-foreground font-semibold text-xs">
            <FlameIcon className="size-3.5" />
            <span>连击中</span>
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-foreground">
            {mockTodayStats.streakDays} <span className="font-sans text-xs font-normal text-muted-foreground">天连续</span>
          </div>
        </div>

        <div className="text-right text-[11px] text-muted-foreground leading-relaxed">
          过去 13 周累计完成<br />
          <strong className="font-mono text-foreground font-bold text-sm">
            {mockTodayStats.totalReviews.toLocaleString()} 次
          </strong>{" "}
          记忆反馈
        </div>
      </div>
    </article>
  )
}

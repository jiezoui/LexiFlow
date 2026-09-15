"use client"

import { useState, useMemo } from "react"
import { FlameIcon, CalendarIcon, TrophyIcon, SparklesIcon, CheckCircle2Icon } from "lucide-react"

// Generate 52 weeks (364 days) of realistic review contribution data
function generateYearContributionData() {
  const data: { date: string; count: number; level: number }[] = []
  const today = new Date(2026, 8, 11) // 2026-09-11

  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]

    // Simulate review distribution with recent active streak
    let count = 0
    let level = 0
    if (i < 14) {
      // Current active streak (last 12-14 days)
      count = Math.floor(Math.random() * 25) + 8
    } else if (Math.random() > 0.35) {
      count = Math.floor(Math.random() * 32)
    }

    if (count > 20) level = 4
    else if (count > 12) level = 3
    else if (count > 5) level = 2
    else if (count > 0) level = 1

    data.push({ date: dateStr, count, level })
  }
  return data
}

const months = ["10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月"]

export function GithubHeatmap() {
  const yearData = useMemo(() => generateYearContributionData(), [])
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null)
  const [selectedYear, setSelectedYear] = useState("2026")

  const totalReviews = useMemo(
    () => yearData.reduce((sum, item) => sum + item.count, 0),
    [yearData]
  )

  // GitHub contribution color classes (supporting both classic GitHub emerald and dark mode)
  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-[#9be9a8] dark:bg-[#0e4429] hover:ring-1 hover:ring-black dark:hover:ring-white"
      case 2:
        return "bg-[#40c463] dark:bg-[#006d32] hover:ring-1 hover:ring-black dark:hover:ring-white"
      case 3:
        return "bg-[#30a14e] dark:bg-[#26a641] hover:ring-1 hover:ring-black dark:hover:ring-white"
      case 4:
        return "bg-[#216e39] dark:bg-[#39d353] hover:ring-1 hover:ring-black dark:hover:ring-white"
      default:
        return "bg-[#ebedf0] dark:bg-[#161b22] hover:bg-zinc-200 dark:hover:bg-zinc-800"
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
      {/* ── 1. Header Row (GitHub style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {totalReviews.toLocaleString()} 次记忆复习与语境采词
            </h3>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
              年度贡献图
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            记录你过去一年的真实记忆反馈、词书背诵与视频字幕采词足迹。
          </p>
        </div>

        {/* Year Selector Pills */}
        <div className="inline-flex items-center rounded-xl border border-border bg-secondary p-1 text-xs font-mono">
          <button
            onClick={() => setSelectedYear("2026")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              selectedYear === "2026"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2026
          </button>
          <button
            onClick={() => setSelectedYear("2025")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              selectedYear === "2025"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2025
          </button>
        </div>
      </div>

      {/* ── 2. GitHub 52-Week Matrix ── */}
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Month Labels along the top */}
          <div className="grid grid-cols-12 text-[11px] font-mono text-muted-foreground pl-7 pb-2">
            {months.map((m, idx) => (
              <span key={idx}>{m}</span>
            ))}
          </div>

          {/* Calendar Grid with Day of Week labels on left */}
          <div className="flex gap-2 items-start">
            {/* Weekdays */}
            <div className="flex flex-col justify-between text-[9px] font-mono text-muted-foreground pt-1 h-[94px] w-6 shrink-0 select-none">
              <span>周一</span>
              <span>周三</span>
              <span>周五</span>
            </div>

            {/* 52 Columns Grid */}
            <div className="grid grid-flow-col grid-rows-7 gap-[3px] flex-1">
              {yearData.map((item, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredDay({ date: item.date, count: item.count })}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`size-[11px] rounded-[2.5px] cursor-pointer transition-transform duration-100 ${getCellColor(
                    item.level
                  )} hover:scale-125 z-0 hover:z-10`}
                  title={`${item.date}: ${item.count} 次研习反馈`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Tooltip & Legend */}
          <div className="mt-4 flex items-center justify-between text-xs font-mono text-muted-foreground pt-2 border-t border-border">
            <div className="min-h-[18px]">
              {hoveredDay ? (
                <span className="font-semibold text-foreground">
                  📅 {hoveredDay.date} · <strong>{hoveredDay.count} 次</strong> FSRS 记忆反馈与语境采词
                </span>
              ) : (
                <span>悬停方格查看每日研习明细</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px]">
              <span>少</span>
              <span className="size-2.5 rounded-[2px] bg-[#ebedf0] dark:bg-[#161b22]" />
              <span className="size-2.5 rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]" />
              <span className="size-2.5 rounded-[2px] bg-[#40c463] dark:bg-[#006d32]" />
              <span className="size-2.5 rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]" />
              <span className="size-2.5 rounded-[2px] bg-[#216e39] dark:bg-[#39d353]" />
              <span>多</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. GitHub Profile Style Highlights Cards ── */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-border">
        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <FlameIcon className="size-3.5 text-foreground" />
            当前连续研习
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-foreground">
            12 <span className="text-xs font-normal font-sans text-muted-foreground">天</span>
          </div>
          <span className="block mt-1 text-[10px] text-muted-foreground font-mono">保持日更心流</span>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <TrophyIcon className="size-3.5 text-foreground" />
            历史最高连击
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-foreground">
            28 <span className="text-xs font-normal font-sans text-muted-foreground">天</span>
          </div>
          <span className="block mt-1 text-[10px] text-muted-foreground font-mono">2026 年春季创造</span>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <CheckCircle2Icon className="size-3.5 text-foreground" />
            FSRS 记忆留存率
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-foreground">
            94.2%
          </div>
          <span className="block mt-1 text-[10px] text-muted-foreground font-mono">预期遗忘阈值 10%</span>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <SparklesIcon className="size-3.5 text-foreground" />
            语境采词总量
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-foreground">
            84 <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </div>
          <span className="block mt-1 text-[10px] text-muted-foreground font-mono">绑定 26 个视频片段</span>
        </div>
      </div>
    </div>
  )
}

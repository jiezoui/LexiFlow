"use client"

import * as React from "react"
import { Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { statsApi, type HeatmapCalendar, type HeatmapDay } from "@/lib/api-client"

/** 网格按「周一」为第一行排布，与左侧的 周一/周三/周五 标签对齐 */
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

const CELL_SIZE = 14
const CELL_GAP = 4

/** 把 YYYY-MM-DD 解析为本地日期，避免 new Date(str) 按 UTC 解析导致的整体偏移一天 */
function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

interface WeekCell {
  day: HeatmapDay | null
}

/**
 * 把「1月1日 ~ 12月31日」的日均摊进周一到周日的 7 行矩阵。
 * 开头按元旦是星期几补空格，结尾补齐最后一周，保证列数与星期标签严格对应。
 */
function buildWeeks(days: HeatmapDay[]): WeekCell[][] {
  if (days.length === 0) return []

  const firstWeekday = (parseLocalDate(days[0].date).getDay() + 6) % 7 // 周一=0
  const slots: WeekCell[] = []

  for (let i = 0; i < firstWeekday; i++) {
    slots.push({ day: null })
  }
  days.forEach((day) => slots.push({ day }))
  while (slots.length % 7 !== 0) {
    slots.push({ day: null })
  }

  const weeks: WeekCell[][] = []
  for (let i = 0; i < slots.length; i += 7) {
    weeks.push(slots.slice(i, i + 7))
  }
  return weeks
}

/** 每个月份标签落在它首次出现的周列上 */
function buildMonthLabels(weeks: WeekCell[][]): { label: string; column: number }[] {
  const labels: { label: string; column: number }[] = []
  let lastMonth = -1

  weeks.forEach((week, columnIndex) => {
    const firstDay = week.find((cell) => cell.day)?.day
    if (!firstDay) return

    const month = parseLocalDate(firstDay.date).getMonth()
    if (month !== lastMonth) {
      labels.push({ label: `${month + 1}月`, column: columnIndex })
      lastMonth = month
    }
  })

  return labels
}

/** GitHub 贡献图同款绿色梯度，明暗两套主题各取一组 */
function getCellClass(level: number): string {
  switch (level) {
    case 1:
      return "bg-[#9be9a8] dark:bg-[#0e4429] hover:ring-1 hover:ring-black/40 dark:hover:ring-white/60"
    case 2:
      return "bg-[#40c463] dark:bg-[#006d32] hover:ring-1 hover:ring-black/40 dark:hover:ring-white/60"
    case 3:
      return "bg-[#30a14e] dark:bg-[#26a641] hover:ring-1 hover:ring-black/40 dark:hover:ring-white/60"
    case 4:
      return "bg-[#216e39] dark:bg-[#39d353] hover:ring-1 hover:ring-black/40 dark:hover:ring-white/60"
    default:
      return "bg-[#ebedf0] dark:bg-[#161b22]"
  }
}

export function GithubHeatmap() {
  const [calendar, setCalendar] = React.useState<HeatmapCalendar | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null)
  const [hoveredDay, setHoveredDay] = React.useState<HeatmapDay | null>(null)

  // 记录当前查看的年份，供静默刷新复用，避免后台刷新把用户切到的年份重置回默认
  const activeYearRef = React.useRef<number | undefined>(undefined)

  const loadYear = React.useCallback(async (year?: number, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await statsApi.getHeatmap(year)
      setCalendar(data)
      setSelectedYear(data.year)
      activeYearRef.current = data.year
      setError(null)
    } catch (e) {
      // 静默刷新失败时保留原有图表，不把已经显示的年度数据擦掉
      if (!silent) {
        setError(e instanceof Error ? e.message : "研习数据加载失败")
        setCalendar(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadYear()
  }, [loadYear])

  /**
   * 实时同步：复习、采词等行为发生在其它标签页或其它模块时，
   * 页面本身不会重新挂载，因此这里在窗口重新获得焦点、标签页切回前台时静默重取一次。
   * 静默刷新不显示骨架屏，避免正在看的图表闪烁。
   */
  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return
      void loadYear(activeYearRef.current, { silent: true })
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [loadYear])

  const weeks = React.useMemo(
    () => buildWeeks(calendar?.days ?? []),
    [calendar?.days]
  )
  const monthLabels = React.useMemo(() => buildMonthLabels(weeks), [weeks])

  const availableYears = calendar?.availableYears ?? []
  const gridWidth = weeks.length * CELL_SIZE + Math.max(0, weeks.length - 1) * CELL_GAP

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
      {/* ── 1. Header Row (GitHub style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            {loading && !calendar ? (
              <span className="inline-block h-6 w-56 animate-pulse rounded bg-muted align-middle" />
            ) : (
              `${(calendar?.totalCount ?? 0).toLocaleString()} 次记忆复习与语境采词`
            )}
          </h3>
          <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
            年度贡献图
          </span>
        </div>

        {/* Year Selector Pills — 年份来自账号真实产生过记录的年份 */}
        {availableYears.length > 0 && (
          <div className="inline-flex items-center rounded-xl border border-border bg-secondary p-1 text-xs font-mono">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => year !== selectedYear && loadYear(year)}
                disabled={loading}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer disabled:cursor-wait ${
                  selectedYear === year
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. GitHub 52-Week Matrix ── */}
      <div className="mt-5 overflow-x-auto pb-2">
        {error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <TriangleAlertIcon className="size-4 text-amber-500" />
            <span>{error}</span>
          </div>
        ) : loading && !calendar ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            <span>正在读取研习足迹…</span>
          </div>
        ) : (
          /* 内容宽度由格子决定，用 w-max + mx-auto 让整块在卡片内水平居中 */
          <div className="mx-auto w-max">
            {/* Month Labels：按各月落在的周列对齐，而不是均分整行 */}
            <div className="relative h-4 mb-1.5 text-xs font-mono text-muted-foreground" style={{ width: gridWidth }}>
              {monthLabels.map(({ label, column }) => (
                <span
                  key={label}
                  className="absolute top-0 whitespace-nowrap"
                  style={{ left: column * (CELL_SIZE + CELL_GAP) }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-2">
              {/* Weekdays：周一为第一行，只标注隔行的 周一/周三/周五/周日 */}
              <div
                className="flex w-8 shrink-0 select-none flex-col text-[10px] font-mono text-muted-foreground"
                style={{ height: 7 * CELL_SIZE + 6 * CELL_GAP }}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <span
                    key={label}
                    className="flex items-center leading-none"
                    style={{ height: CELL_SIZE, marginBottom: index === 6 ? 0 : CELL_GAP }}
                  >
                    {index % 2 === 0 ? label : ""}
                  </span>
                ))}
              </div>

              {/* 7 行 × N 周的矩阵 */}
              <div
                className="grid grid-rows-7 grid-flow-col"
                style={{ gap: CELL_GAP, gridAutoColumns: CELL_SIZE }}
              >
                {weeks.flatMap((week, weekIndex) =>
                  week.map((cell, dayIndex) => {
                    if (!cell.day) {
                      return (
                        <div
                          key={`blank-${weekIndex}-${dayIndex}`}
                          style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        />
                      )
                    }
                    const day = cell.day
                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        className={`rounded-[3px] cursor-pointer transition-transform duration-100 ${getCellClass(
                          day.level
                        )} hover:scale-125 z-0 hover:z-10`}
                        title={`${day.date}: 复习 ${day.reviewCount} 次 · 采词 ${day.collectedCount} 个`}
                      />
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. 悬停明细与色阶图例 ──
          放在横向滚动区之外，窄屏下左右滚动日历格时这一行始终可见 */}
      {!error && calendar && (
        <div className="mt-4 flex flex-col gap-2 text-xs font-mono text-muted-foreground pt-3 border-t border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[18px]">
            {hoveredDay ? (
              <span className="font-semibold text-foreground">
                {hoveredDay.date} · 复习 <strong>{hoveredDay.reviewCount}</strong> 次 · 采词{" "}
                <strong>{hoveredDay.collectedCount}</strong> 个
                {hoveredDay.durationMinutes > 0 && <> · 研习 {hoveredDay.durationMinutes} 分钟</>}
              </span>
            ) : calendar.activeDays > 0 ? (
              <span>
                悬停方格查看每日研习明细 · 全年活跃 {calendar.activeDays} 天 · 最长连续{" "}
                {calendar.longestStreak} 天 · 累计 {calendar.totalDurationMinutes} 分钟
              </span>
            ) : (
              <span>该年度尚无研习记录，复习闪卡或采摘生词后这里会自动亮起</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
            <span>少</span>
            <span className="size-3 rounded-[2px] bg-[#ebedf0] dark:bg-[#161b22]" />
            <span className="size-3 rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]" />
            <span className="size-3 rounded-[2px] bg-[#40c463] dark:bg-[#006d32]" />
            <span className="size-3 rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]" />
            <span className="size-3 rounded-[2px] bg-[#216e39] dark:bg-[#39d353]" />
            <span>多</span>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Headphones,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import {
  statsApi,
  planApi,
  type HeatmapCalendar,
  type HeatmapDay,
  type LearningOverviewStats,
  type StudyPlanOverview,
  type FsrsStats,
  type MultimodalStats,
} from "@/lib/api-client"
import styles from "./analytics-dashboard.module.css"

type Range = 30 | 90 | 365
type CountKey = "count" | "reviewCount" | "collectedCount" | "durationMinutes" | "newCards" | "reviewCards"

const nf = new Intl.NumberFormat("zh-CN")
const weekNames = ["一", "二", "三", "四", "五", "六", "日"]

// 只为数据编码加入低饱和色，页面结构与文字仍沿用黑白灰。
const heatColors = [
  "var(--analytics-heat-0)",
  "var(--analytics-heat-1)",
  "var(--analytics-heat-2)",
  "var(--analytics-heat-3)",
  "var(--analytics-heat-4)",
]

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function sum(days: HeatmapDay[], key: CountKey) {
  return days.reduce((total, day) => total + (day[key] ?? 0), 0)
}

function groupTrend(days: HeatmapDay[], range: Range) {
  const step = range === 365 ? 7 : range === 90 ? 3 : 1
  const groups = []
  for (let index = 0; index < days.length; index += step) {
    const group = days.slice(index, index + step)
    groups.push({
      label: group[0].date.slice(5).replace("-", "/"),
      period: group.length === 1 ? group[0].date : `${group[0].date} — ${group[group.length - 1].date}`,
      reviews: sum(group, "reviewCount"),
      collected: sum(group, "collectedCount"),
      minutes: sum(group, "durationMinutes"),
    })
  }
  return groups
}

const chartTick = { fontSize: 10, fill: "var(--muted-foreground)" }
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  subLabel,
  dark = false,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
  unit: string
  subLabel?: React.ReactNode
  dark?: boolean
}) {
  return (
    <div
      className={`flex min-h-32 flex-col justify-between rounded-lg p-5 transition-all duration-150 ${
        dark
          ? "bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
          : "border border-border/70 bg-card hover:border-border"
      }`}
    >
      <div
        className={`flex items-center justify-between text-xs font-medium ${
          dark ? "text-zinc-400 dark:text-zinc-500" : "text-muted-foreground"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 opacity-80" />}
          {label}
        </span>
        <span className="font-mono text-[11px] opacity-40">—</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <strong className="font-mono text-[clamp(1.75rem,2.5vw,2.4rem)] font-semibold leading-none tracking-[-.05em] tabular-nums">
            {value}
          </strong>
          <span className="text-xs font-normal opacity-70">{unit}</span>
        </div>
        {subLabel && (
          <div
            className={`mt-2 text-[11px] leading-tight truncate ${
              dark ? "text-zinc-400 dark:text-zinc-500" : "text-muted-foreground"
            }`}
          >
            {subLabel}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------
// P1.2 全年活跃热力图
// ---------------------------------------------------------
function ActivityHeatmap({ calendar }: { calendar: HeatmapCalendar }) {
  const [hoveredDay, setHoveredDay] = React.useState<{
    day: HeatmapDay
    x: number
    y: number
  } | null>(null)

  const weeks = React.useMemo(() => {
    if (!calendar.days.length) return [] as (HeatmapDay | null)[][]
    const offset = (localDate(calendar.days[0].date).getDay() + 6) % 7
    const slots: (HeatmapDay | null)[] = [...Array(offset).fill(null), ...calendar.days]
    while (slots.length % 7 !== 0) slots.push(null)
    return Array.from({ length: slots.length / 7 }, (_, index) => slots.slice(index * 7, index * 7 + 7))
  }, [calendar.days])

  const months = React.useMemo(
    () =>
      weeks.flatMap((week, index) => {
        const day = week.find(Boolean)
        if (!day) return []
        const month = localDate(day.date).getMonth()
        const previous = weeks[index - 1]?.find(Boolean)
        return previous && localDate(previous.date).getMonth() === month ? [] : [{ month, index }]
      }),
    [weeks]
  )

  // 星期维度统计
  const weekdayStats = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0] // 0=周一, 6=周日
    for (const day of calendar.days) {
      const wd = (localDate(day.date).getDay() + 6) % 7
      counts[wd] += day.count ?? 0
    }
    const maxCount = Math.max(1, ...counts)
    return weekNames.map((name, i) => ({
      name,
      count: counts[i],
      pct: Math.max(12, Math.round((counts[i] / maxCount) * 100)),
    }))
  }, [calendar.days])

  const mostActiveWeekday = React.useMemo(() => {
    let best = weekdayStats[0]
    for (const w of weekdayStats) {
      if (w.count > best.count) best = w
    }
    return best.count > 0 ? `周${best.name}` : "暂无"
  }, [weekdayStats])

  // 强度天数统计
  const intensityStats = React.useMemo(() => {
    let high = 0
    let mid = 0
    let zero = 0
    for (const day of calendar.days) {
      const lvl = day.level ?? 0
      if (lvl >= 3) high++
      else if (lvl >= 1) mid++
      else zero++
    }
    return { high, mid, zero }
  }, [calendar.days])

  const handleCellMouseEnter = (day: HeatmapDay, event: React.MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredDay({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  const handleCellMouseLeave = () => {
    setHoveredDay(null)
  }

  const attendanceRate = Math.round((calendar.activeDays / (calendar.days.length || 365)) * 1000) / 10
  const annualHours = Math.round((calendar.totalDurationMinutes / 60) * 10) / 10

  return (
    <section className="relative rounded-xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">
        {/* 左侧：365天热力图方阵 */}
        <div className="min-w-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">全年学习足迹</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              365 天持续记录 · 色阶深浅对应当日复习、采词与研习投入量
            </p>
          </div>

          <div className="mt-6 overflow-x-auto pb-2">
            <div className="min-w-max">
              <div
                className="relative mb-2 ml-7 h-4 text-[10px] text-muted-foreground"
                style={{ width: weeks.length * 17 }}
              >
                {months.map(({ month, index }) => (
                  <span key={index} className="absolute" style={{ left: index * 17 }}>
                    {month + 1}月
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="grid w-5 grid-rows-7 gap-[3px] text-[10px] leading-[14px] text-muted-foreground">
                  {weekNames.map((name, index) => (
                    <span key={name}>{index % 2 === 0 ? name : ""}</span>
                  ))}
                </div>
                <div className="flex gap-[3px]">
                  {weeks.map((week, index) => (
                    <div key={index} className="grid grid-rows-7 gap-[3px]">
                      {week.map((day, row) =>
                        day ? (
                          <span
                            key={day.date}
                            onMouseEnter={(e) => handleCellMouseEnter(day, e)}
                            onMouseLeave={handleCellMouseLeave}
                            className="size-[14px] rounded-[2px] border border-border/30 cursor-pointer transition-transform hover:scale-125 hover:z-10"
                            style={{ backgroundColor: heatColors[Math.min(4, Math.max(0, day.level ?? 0))] }}
                          />
                        ) : (
                          <span key={`blank-${row}`} className="size-[14px]" />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span>
              {calendar.year} 年累计打卡 {nf.format(calendar.activeDays)} 天 · 共记录 {nf.format(calendar.totalCount)} 次活动
            </span>
            <div className="flex items-center gap-1.5">
              <span>少</span>
              <div className="flex items-center gap-1">
                {heatColors.map((color, index) => (
                  <span key={index} className="size-2.5 rounded-[2px] border border-border/30" style={{ backgroundColor: color }} />
                ))}
              </div>
              <span>多</span>
            </div>
          </div>
        </div>

        {/* 右侧：年度研习画像与节律洞察 (完美填充右侧空白) */}
        <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-border/60 pt-5 lg:pt-0 lg:pl-7">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">年度研习提炼</span>
              <span className="font-mono text-[11px] text-muted-foreground">{calendar.year} 年度</span>
            </div>

            {/* 4 项核心数据网格 */}
            <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border/40 bg-secondary/15 p-2.5">
                <span className="text-[11px] text-muted-foreground block">最长连续</span>
                <strong className="mt-1 block font-mono text-base font-semibold text-foreground">
                  {calendar.longestStreak} <small className="text-xs font-normal text-muted-foreground">天</small>
                </strong>
              </div>
              <div className="rounded-lg border border-border/40 bg-secondary/15 p-2.5">
                <span className="text-[11px] text-muted-foreground block">年度时长</span>
                <strong className="mt-1 block font-mono text-base font-semibold text-foreground">
                  {annualHours} <small className="text-xs font-normal text-muted-foreground">小时</small>
                </strong>
              </div>
              <div className="rounded-lg border border-border/40 bg-secondary/15 p-2.5">
                <span className="text-[11px] text-muted-foreground block">出勤比例</span>
                <strong className="mt-1 block font-mono text-base font-semibold text-foreground">
                  {attendanceRate}%
                </strong>
              </div>
              <div className="rounded-lg border border-border/40 bg-secondary/15 p-2.5">
                <span className="text-[11px] text-muted-foreground block">最高单日</span>
                <strong className="mt-1 block font-mono text-base font-semibold text-foreground">
                  {calendar.maxDailyCount} <small className="text-xs font-normal text-muted-foreground">次</small>
                </strong>
              </div>
            </div>

            {/* 周打卡偏好微柱状图 */}
            <div className="mt-4 rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">周内习惯节奏</span>
                <span className="font-mono text-[11px] text-foreground font-medium">偏好 {mostActiveWeekday}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-1.5 h-12">
                {weekdayStats.map((item) => (
                  <div key={item.name} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className="w-full rounded-[1px] transition-all duration-300"
                      style={{
                        height: `${item.pct}%`,
                        opacity: item.count > 0 ? 0.85 : 0.15,
                        backgroundColor: "var(--analytics-teal)",
                      }}
                      title={`周${item.name}: ${item.count} 次活动`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 投入强度分布 */}
            <div className="mt-3.5 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: "var(--analytics-teal)" }} />
                  深度研习 (高频/高时长)
                </span>
                <span className="font-mono text-foreground font-medium">{intensityStats.high} 天</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: "var(--analytics-amber)" }} />
                  常规复查 (日常巩固)
                </span>
                <span className="font-mono text-foreground font-medium">{intensityStats.mid} 天</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  未打卡休息
                </span>
                <span className="font-mono text-muted-foreground">{intensityStats.zero} 天</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 中性高对比悬浮卡片 */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md text-xs transition-opacity"
          style={{ left: hoveredDay.x, top: hoveredDay.y }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 font-mono">
            <span className="font-medium text-foreground">{hoveredDay.day.date}</span>
            <span className="text-[10px] text-muted-foreground">等级 {hoveredDay.day.level ?? 0}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">复习:</span>
              <strong className="font-mono tabular-nums text-foreground">{hoveredDay.day.reviewCount} 次</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">采词:</span>
              <strong className="font-mono tabular-nums text-foreground">{hoveredDay.day.collectedCount} 词</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">新卡:</span>
              <strong className="font-mono tabular-nums text-foreground">{hoveredDay.day.newCards} 张</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">时长:</span>
              <strong className="font-mono tabular-nums text-foreground">{hoveredDay.day.durationMinutes} 分钟</strong>
            </div>
          </div>
          {hoveredDay.day.retentionRate !== null && hoveredDay.day.retentionRate !== undefined && (
            <div className="mt-1.5 border-t border-border/50 pt-1.5 flex justify-between text-[11px]">
              <span className="text-muted-foreground">当日保持率:</span>
              <span className="font-mono font-medium text-foreground">
                {Math.round(hoveredDay.day.retentionRate * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------
// P1.1 学习计划目标追踪 (轻量、紧凑、无冗余卡片)
// ---------------------------------------------------------
function StudyPlanGoalTracking({ plan }: { plan: StudyPlanOverview }) {
  const { macro, today } = plan

  const items = [
    {
      label: "词汇闪卡",
      current: today.vocab.learned,
      target: today.vocab.target,
      unit: "词",
      backlog: `${today.vocab.dueReview} 待复习`,
      isDone: today.vocab.isCompleted,
      href: "/cards",
      color: "var(--analytics-teal)",
    },
    {
      label: "影子跟读",
      current: today.shadowing.completed,
      target: today.shadowing.target,
      unit: "句",
      backlog: "声学跟读",
      isDone: today.shadowing.isCompleted,
      href: "/practice/shadowing",
      color: "var(--analytics-blue)",
    },
    {
      label: "综合学习时长",
      current: today.context.currentMinutes,
      target: today.context.targetMinutes,
      unit: "分钟",
      backlog: "含阅读、复习与跟读",
      isDone: today.context.isCompleted,
      href: "/reading",
      color: "var(--analytics-amber)",
    },
  ]

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">学习计划达成</span>
          <span className="text-xs text-muted-foreground truncate">
            主词书: <strong className="text-foreground">{macro.wordbookTitle}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            总进度 <strong className="font-mono text-foreground">{macro.progressPercent}%</strong> ({nf.format(macro.masteredWords)} / {nf.format(macro.totalWords)})
          </span>
          <span className="font-mono text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {macro.daysRemaining > 0 ? `未学词覆盖约需 ${macro.daysRemaining} 天 (${macro.estimatedDate})` : "新词已覆盖"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const pct = item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0
          return (
            <div
              key={item.label}
              className="flex flex-col justify-between rounded-lg border border-border/50 bg-secondary/15 p-3.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{item.label}</span>
                {item.isDone ? (
                  <span className="font-mono text-[11px] text-foreground font-medium">已完成</span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">{pct}%</span>
                )}
              </div>

              <div className="mt-2.5 flex items-baseline gap-1 font-mono">
                <strong className="text-2xl font-semibold text-foreground tabular-nums">
                  {item.current}
                </strong>
                <span className="text-xs text-muted-foreground">
                  / {item.target} {item.unit}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                <span className="text-muted-foreground">{item.backlog}</span>
                <Link
                  href={item.href}
                  className="flex items-center gap-0.5 text-foreground hover:underline font-medium"
                >
                  <span>前往</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------
// P0.1 多模态投入全景
// ---------------------------------------------------------
function MultimodalSection({ data }: { data: MultimodalStats }) {
  const flashcardMins = data.timeDistribution?.find((t) => t.category.includes("闪卡"))?.minutes ?? 0
  const shadowingMins = data.shadowing?.totalPracticeMinutes ?? 0
  const readingMins = data.context?.totalMinutes ?? 0
  const totalMins = flashcardMins + shadowingMins + readingMins
  const totalHours = Math.round((totalMins / 60) * 10) / 10

  const timeBreakdown = [
    {
      name: "闪卡复习",
      minutes: flashcardMins,
      pct: totalMins > 0 ? Math.round((flashcardMins / totalMins) * 1000) / 10 : 0,
      countDesc: `${nf.format(data.flashcards?.totalReviews ?? 0)} 次复习`,
      barColor: "var(--analytics-teal)",
    },
    {
      name: "影子跟读",
      minutes: shadowingMins,
      pct: totalMins > 0 ? Math.round((shadowingMins / totalMins) * 1000) / 10 : 0,
      countDesc: `${nf.format(data.shadowing?.totalAttempts ?? 0)} 句跟读`,
      barColor: "var(--analytics-blue)",
    },
    {
      name: "语境阅读",
      minutes: readingMins,
      pct: totalMins > 0 ? Math.round((readingMins / totalMins) * 1000) / 10 : 0,
      countDesc: `${nf.format(data.context?.totalStories ?? 0)} 篇语境文章`,
      barColor: "var(--analytics-amber)",
    },
  ]

  const trendPoints = data.shadowing?.recentTrend ?? []
  const hasTrend = trendPoints.length > 0
  const trendData = trendPoints.map((t, idx) => ({
    session: idx + 1,
    date: t.date?.slice(0, 5) ?? `${idx + 1}`,
    accuracy: Math.round(t.accuracyScore ?? 0),
    fluency: Math.round(t.fluencyScore ?? 0),
    overall: Math.round(t.overallScore ?? 0),
  }))

  const avgOverall = Math.round((data.shadowing?.averageOverallScore ?? 0) * 10) / 10
  const avgAccuracy = Math.round((data.shadowing?.averageAccuracyScore ?? 0) * 10) / 10
  const avgFluency = Math.round((data.shadowing?.averageFluencyScore ?? 0) * 10) / 10
  const lastWpm = trendPoints.length > 0 ? Math.round(trendPoints[trendPoints.length - 1].wordsPerMinute ?? 0) : 0

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* 模块 1: 三维时间分配 */}
      <section className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 sm:p-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              三维研习时间分配
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              累计 <strong className="text-foreground">{totalHours}</strong> 小时
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            闪卡时长按复习次数估算，跟读按录音时长统计，其余学习时长计入语境输入
          </p>

          {/* 分段比例条 */}
          <div className="mt-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
              {timeBreakdown.map((item) => (
                <div
                  key={item.name}
                  className="h-full transition-all duration-300"
                  style={{ width: `${item.pct}%`, minWidth: item.minutes > 0 ? 4 : 0, backgroundColor: item.barColor }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              {timeBreakdown.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.barColor }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-mono text-foreground font-medium">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 精炼 3 列明细 */}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
          {timeBreakdown.map((item) => (
            <div key={item.name}>
              <div className="font-mono text-xl font-semibold text-foreground">
                {item.minutes} <small className="text-[11px] font-normal text-muted-foreground">min</small>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{item.countDesc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 模块 2: 影子跟读声学质量轨迹 */}
      <section className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 sm:p-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              影子跟读声学质量
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              均分 <strong className="text-foreground">{avgOverall > 0 ? avgOverall : "—"}</strong>
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            发音准确度（实线）与语流连贯度（虚线）演进
          </p>

          {/* 4 项紧凑声学指标 */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-md border border-border/40 bg-secondary/15 py-1.5">
              <span className="text-[10px] text-muted-foreground block">综合均分</span>
              <strong className="font-mono text-sm text-foreground">{avgOverall > 0 ? avgOverall : "—"}</strong>
            </div>
            <div className="rounded-md border border-border/40 bg-secondary/15 py-1.5">
              <span className="text-[10px] text-muted-foreground block">准确率</span>
              <strong className="font-mono text-sm text-foreground">{avgAccuracy > 0 ? `${avgAccuracy}%` : "—"}</strong>
            </div>
            <div className="rounded-md border border-border/40 bg-secondary/15 py-1.5">
              <span className="text-[10px] text-muted-foreground block">连贯度</span>
              <strong className="font-mono text-sm text-foreground">{avgFluency > 0 ? `${avgFluency}%` : "—"}</strong>
            </div>
            <div className="rounded-md border border-border/40 bg-secondary/15 py-1.5">
              <span className="text-[10px] text-muted-foreground block">最近日均语速</span>
              <strong className="font-mono text-sm text-foreground">{lastWpm > 0 ? `${lastWpm} WPM` : "—"}</strong>
            </div>
          </div>
        </div>

        {/* 趋势图 */}
        <div className="mt-4 h-[160px] w-full">
          {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={chartTick} />
                <Tooltip
                  formatter={(val, name) => [`${val}%`, name]}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="发音准确率"
                  stroke="var(--analytics-teal)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="fluency"
                  name="语流连贯度"
                  stroke="var(--analytics-blue)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-secondary/30 text-xs text-muted-foreground">
              暂无跟读流水，可在影子练习中录制评测
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------
// P0.2 FSRS 记忆深度与负荷预测
// ---------------------------------------------------------
function FsrsSection({ fsrs }: { fsrs: FsrsStats }) {
  const total = fsrs.totalCards || 1
  const stages = [
    { name: "新词阶段", count: fsrs.newCards, pct: Math.round((fsrs.newCards / total) * 100), color: "var(--analytics-heat-2)" },
    { name: "初步习得", count: fsrs.learningCards, pct: Math.round((fsrs.learningCards / total) * 100), color: "var(--analytics-amber)" },
    { name: "复习巩固", count: fsrs.reviewingCards, pct: Math.round((fsrs.reviewingCards / total) * 100), color: "var(--analytics-blue)" },
    { name: "稳定记忆", count: fsrs.stableCards, pct: Math.round((fsrs.stableCards / total) * 100), color: "var(--analytics-plum)" },
    { name: "完全掌握", count: fsrs.masteredCards, pct: Math.round((fsrs.masteredCards / total) * 100), color: "var(--analytics-teal)" },
  ]

  const forecast = fsrs.dueForecast ?? []
  const dueToday = forecast?.[0]?.dueCount ?? 0

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* 模块 1: FSRS 记忆深度分布 */}
      <section className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 sm:p-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              FSRS 记忆深度分布
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              总纳管 <strong className="text-foreground">{nf.format(fsrs.totalCards)}</strong> 词
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            依据 DSR 遗忘模型科学刻画词汇从初识到完全掌握的层级
          </p>

          {/* 堆叠横条 */}
          <div className="mt-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
              {stages.map((st) => (
                <div
                  key={st.name}
                  className="h-full transition-all duration-300"
                  style={{ width: `${st.pct}%`, backgroundColor: st.color }}
                  title={`${st.name}: ${st.count} 词 (${st.pct}%)`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between text-xs">
              {stages.map((st) => (
                <div key={st.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: st.color }} />
                  <span className="text-muted-foreground">{st.name}</span>
                  <span className="font-mono font-medium text-foreground">{st.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 紧凑层级数据列表 */}
        <div className="mt-5 divide-y divide-border/40 border-t border-border/60 text-xs">
          {stages.map((st) => (
            <div key={st.name} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{st.name}</span>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-foreground font-medium">{nf.format(st.count)} 词</span>
                <span className="text-muted-foreground w-8 text-right">{st.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 模块 2: 未来 7 天到期预测 */}
      <section className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 sm:p-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              未来 7 天到期负荷预测
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              今日待复习: <strong className="text-foreground">{dueToday}</strong> 词
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            基于复习间隔推演未来一周待复核卡片数
          </p>
        </div>

        {/* 柱状预测图 */}
        <div className="mt-5 h-[180px] w-full">
          {forecast.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
                <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={chartTick} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
                <Tooltip
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ?? ""}
                  formatter={(value) => [`${value} 张`, "到期卡片"]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--secondary)" }}
                />
                <Bar dataKey="dueCount" name="到期卡片" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {forecast.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "var(--analytics-amber)" : "var(--analytics-teal)"}
                      opacity={index === 0 ? 1 : 0.72}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary/30 text-xs text-muted-foreground rounded-lg">
              暂无到期排程记录
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>高亮柱为今日待复习量</span>
          <Link href="/cards" className="flex items-center gap-1 text-foreground hover:underline font-medium">
            <span>开始复习</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------
// 主仪表盘组件
// ---------------------------------------------------------
export function AnalyticsDashboard() {
  const [year, setYear] = React.useState(() => new Date().getFullYear())
  const [years, setYears] = React.useState<number[]>(() => [new Date().getFullYear()])
  const [range, setRange] = React.useState<Range>(30)
  const [calendar, setCalendar] = React.useState<HeatmapCalendar | null>(null)
  const [overview, setOverview] = React.useState<LearningOverviewStats | null>(null)
  const [fsrs, setFsrs] = React.useState<FsrsStats | null>(null)
  const [multimodal, setMultimodal] = React.useState<MultimodalStats | null>(null)
  const [plan, setPlan] = React.useState<StudyPlanOverview | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reload, setReload] = React.useState(0)

  React.useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      const [calRes, ovRes, fsrsRes, multiRes, planRes] = await Promise.allSettled([
        statsApi.getHeatmap(year),
        statsApi.getOverview(),
        statsApi.getFsrs(),
        statsApi.getMultimodal(),
        planApi.getTodayOverview(),
      ])

      if (!active) return

      if (calRes.status === "fulfilled" && Array.isArray(calRes.value.days)) {
        setCalendar(calRes.value)
        setYears(calRes.value.availableYears ?? [year])
      } else {
        setCalendar(null)
        setError("统计数据加载失败，请重试")
      }

      if (ovRes.status === "fulfilled") setOverview(ovRes.value)
      else setOverview(null)

      if (fsrsRes.status === "fulfilled") setFsrs(fsrsRes.value)
      else setFsrs(null)

      if (multiRes.status === "fulfilled") setMultimodal(multiRes.value)
      else setMultimodal(null)

      if (planRes.status === "fulfilled") setPlan(planRes.value)
      else setPlan(null)

      setLoading(false)
    }

    void fetchData()
    return () => {
      active = false
    }
  }, [year, reload])

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const elapsed = React.useMemo(() => (calendar?.days ?? []).filter((day) => day.date <= todayKey), [calendar, todayKey])
  const period = React.useMemo(() => elapsed.slice(-range), [elapsed, range])
  const trend = React.useMemo(() => groupTrend(period, range), [period, range])
  const recent = elapsed.slice(-7)
  const previous = elapsed.slice(-14, -7)
  const recentCount = sum(recent, "count")
  const previousCount = sum(previous, "count")
  const change = previousCount > 0 ? Math.round(((recentCount - previousCount) / previousCount) * 100) : null
  const retention = overview && overview.totalReviews > 0 ? Math.round(overview.overallRetentionRate * 100) : null
  const mastered = Math.max(0, overview?.masteredWords ?? (fsrs?.masteredCards ?? 0))
  const totalVocab = Math.max(0, overview?.totalVocabulary ?? (fsrs?.totalCards ?? 0))
  const masteredShare = totalVocab ? Math.min(100, Math.round((mastered / totalVocab) * 100)) : 0
  const hasChartData = period.some((day) => day.count > 0 || day.durationMinutes > 0)
  const activePeriodDays = period.filter((day) => day.count > 0).length

  return (
    <main className={`${styles.analyticsDashboard} analytics-dashboard mx-auto w-full max-w-[1600px] space-y-5 px-4 pb-14 pt-6 sm:px-7 lg:px-9`}>
      {/* 头部标题与年份选择器 */}
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            学习数据与多模态全景
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <select
              aria-label="统计年份"
              value={year}
              onChange={(e) => {
                setCalendar(null)
                setYear(Number(e.target.value))
              }}
              className="bg-transparent font-mono outline-none cursor-pointer"
            >
              {[...new Set([year, today.getFullYear(), ...years])]
                .sort((a, b) => b - a)
                .map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} 年
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            disabled={loading}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs transition-colors hover:bg-secondary cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-xs text-muted-foreground"
        >
          <span>{error}</span>
          <button
            onClick={() => setReload((v) => v + 1)}
            className="font-medium underline text-foreground cursor-pointer"
          >
            重试
          </button>
        </div>
      )}

      {loading && !calendar ? (
        <div role="status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-lg bg-secondary/40" />
          ))}
        </div>
      ) : (
        <>
          {/* 5 张核心 KPI 统计卡片 (每张卡片展示精准二级数据，杜绝无意义占位语) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              dark
              icon={Activity}
              label={`${year} 活跃天数`}
              value={calendar ? nf.format(calendar.activeDays) : "—"}
              unit="天"
              subLabel={calendar ? `最长连续 ${calendar.longestStreak} 天 · 最高单日 ${calendar.maxDailyCount} 次` : "等待记录"}
            />
            <Metric
              icon={Sparkles}
              label="闪卡复习"
              value={multimodal ? nf.format(multimodal.flashcards?.totalReviews ?? 0) : (calendar ? nf.format(calendar.totalReviews) : "—")}
              unit="次"
              subLabel={retention !== null ? `历史平均保持率 ${retention}%` : `采词 ${multimodal?.flashcards?.totalCollected ?? 0} 词`}
            />
            <Metric
              icon={Headphones}
              label="影子跟读"
              value={multimodal ? nf.format(multimodal.shadowing?.totalAttempts ?? 0) : "—"}
              unit="句"
              subLabel={multimodal && multimodal.shadowing?.averageOverallScore > 0 ? `发音均分 ${Math.round(multimodal.shadowing.averageOverallScore * 10) / 10} · ${Math.round(multimodal.shadowing.averageAccuracyScore)}% 准确` : "暂无评测记录"}
            />
            <Metric
              icon={BookOpen}
              label="我的语境文章"
              value={multimodal ? nf.format(multimodal.context?.totalStories ?? 0) : "—"}
              unit="篇"
              subLabel={multimodal ? `可用外刊素材 ${nf.format(multimodal.context?.totalArticles ?? 0)} 篇` : "故事与外刊阅读"}
            />
            <Metric
              icon={Brain}
              label="已掌握词汇"
              value={mastered > 0 ? nf.format(mastered) : "—"}
              unit="词"
              subLabel={totalVocab > 0 ? `词库总纳管 ${nf.format(totalVocab)} 词 (占比 ${masteredShare}%)` : "词库总览"}
            />
          </div>

          {/* P1.1: 学习计划目标追踪 */}
          {plan && <StudyPlanGoalTracking plan={plan} />}

          {/* P0.1: 多模态投入全景 (时间分配 + 跟读声学) */}
          {multimodal && <MultimodalSection data={multimodal} />}

          {/* P0.2: FSRS 记忆深度与到期负荷预测 */}
          {fsrs && <FsrsSection fsrs={fsrs} />}

          {/* P1.2: 全年学习足迹 */}
          {calendar && <ActivityHeatmap calendar={calendar} />}

          {/* 学习节奏趋势图 与 最近 7 日流水明细 */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(310px,1.1fr)]">
            <section className="min-w-0 rounded-xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    学习节奏与时间投入
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    柱形：复习与采词 · 折线：研习分钟数
                  </p>
                </div>
                <div
                  role="group"
                  aria-label="图表时间范围"
                  className="flex rounded-md border border-border bg-secondary/40 p-0.5 text-xs"
                >
                  {([30, 90, 365] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setRange(days)}
                      aria-pressed={range === days}
                      className={`rounded px-2.5 py-0.5 transition-colors cursor-pointer ${
                        range === days
                          ? "bg-foreground text-background font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {days === 365 ? "全年" : `${days} 天`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: "var(--analytics-teal)" }} />
                  复习次数
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: "var(--analytics-amber)" }} />
                  语境采词
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3" style={{ backgroundColor: "var(--analytics-blue)" }} />
                  学习分钟
                </span>
              </div>

              <div className="mt-4 h-[280px] w-full">
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trend}
                      margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={chartTick} />
                      <YAxis yAxisId="act" allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
                      <YAxis yAxisId="tm" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
                      <Tooltip
                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.period ?? ""}
                        formatter={(val, name) => [
                          `${nf.format(Number(val ?? 0))}${name === "学习分钟" ? " 分钟" : " 次"}`,
                          name,
                        ]}
                        contentStyle={tooltipStyle}
                        cursor={{ fill: "var(--secondary)" }}
                      />
                      <Bar yAxisId="act" dataKey="reviews" name="复习次数" stackId="a" fill="var(--analytics-teal)" maxBarSize={16} radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="act" dataKey="collected" name="语境采词" stackId="a" fill="var(--analytics-amber)" maxBarSize={16} radius={[2, 2, 0, 0]} />
                      <Line yAxisId="tm" type="monotone" dataKey="minutes" name="学习分钟" stroke="var(--analytics-blue)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg bg-secondary/30 text-xs text-muted-foreground">
                    所选时段暂无研习流水
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">观察周期</span>
                  <strong className="font-mono text-foreground font-semibold">{period.length} 天</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">日均活动</span>
                  <strong className="font-mono text-foreground font-semibold">
                    {period.length ? Math.round(sum(period, "count") / period.length) : 0} 次
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">活跃打卡率</span>
                  <strong className="font-mono text-foreground font-semibold">
                    {period.length ? Math.round((activePeriodDays / period.length) * 100) : 0}%
                  </strong>
                </div>
              </div>
            </section>

            {/* 最近 7 日流水明细 */}
            <section className="min-w-0 rounded-xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">最近 7 日明细</h2>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{year}</span>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[360px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                      <th className="pb-2 font-medium">日期</th>
                      <th className="pb-2 text-right font-medium">复习</th>
                      <th className="pb-2 text-right font-medium">采词</th>
                      <th className="pb-2 text-right font-medium">新卡</th>
                      <th className="pb-2 text-right font-medium">时长</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[...recent].reverse().map((day) => (
                      <tr key={day.date} className="hover:bg-secondary/20">
                        <td className="py-2 font-mono font-medium text-foreground">{day.date.slice(5)}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-foreground">{day.reviewCount}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{day.collectedCount}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{day.newCards}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-foreground">{day.durationMinutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {recent.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">暂无流水明细</div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                <span>近 7 天共 {nf.format(recentCount)} 次活动</span>
                <span className="font-medium text-foreground">
                  {change === null ? "前期无记录" : `较上周 ${change >= 0 ? "+" : ""}${change}%`}
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  )
}

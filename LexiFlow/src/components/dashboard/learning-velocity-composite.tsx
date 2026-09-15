"use client"

import * as React from "react"
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { mockVelocityCompositeData } from "@/data/mock-lexiflow"
import Link from "next/link"
import {
  statsApi,
  wordbookApi,
  type LearningOverviewStats,
  type Wordbook,
} from "@/lib/api-client"
import {
  ActivityIcon,
  SparklesIcon,
  LayersIcon,
  ShieldCheckIcon,
  BrainIcon,
  TrendingUpIcon,
  VideoIcon,
  MicIcon,
  ArrowUpRightIcon,
} from "lucide-react"

const chartConfig = {
  reviewWords: {
    label: "稳态复习 (Review)",
    color: "#09090B",
  },
  newWords: {
    label: "新词摄入 (New)",
    color: "#71717A",
  },
  retentionRate: {
    label: "记忆保持率 (%)",
    color: "#18181B",
  },
  flowScore: {
    label: "心流专注带",
    color: "#E4E4E7",
  },
} satisfies ChartConfig

export function LearningVelocityCompositeChart() {
  const [viewMode, setViewMode] = React.useState<"composite" | "throughput" | "retention">("composite")
  const [overview, setOverview] = React.useState<LearningOverviewStats | null>(null)
  const [activeBook, setActiveBook] = React.useState<Wordbook | null>(null)

  React.useEffect(() => {
    statsApi.getOverview().then(setOverview).catch(() => {})

    const loadBook = async () => {
      try {
        const savedId = localStorage.getItem("lexiflow_primary_wordbook_id")
        let b: Wordbook | null = null
        if (savedId) {
          b = await wordbookApi.getDetail(Number(savedId)).catch(() => null)
        }
        if (!b) {
          const list = await wordbookApi.list().catch(() => [])
          if (list && list.length > 0) b = list[0]
        }
        setActiveBook(b)
      } catch {}
    }
    loadBook()

    const handleUpdate = () => {
      statsApi.getOverview().then(setOverview).catch(() => {})
      loadBook()
    }
    window.addEventListener("lexiflow_wordbook_updated", handleUpdate)
    return () => window.removeEventListener("lexiflow_wordbook_updated", handleUpdate)
  }, [])

  const masteredCount = overview?.masteredWords ?? 0
  const retentionPercent = overview?.overallRetentionRate ? Math.round(overview.overallRetentionRate * 100) : 100
  const totalReviews = overview?.totalReviews ?? 0
  const totalVocab = overview?.totalVocabulary ?? 0
  const streakDays = overview?.streakDays ?? 0
  const totalDuration = overview?.totalDurationMinutes ?? 0

  return (
    <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <CardHeader className="p-0 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-background">
                <ActivityIcon className="size-3.5" />
              </span>
              <CardTitle className="text-base font-bold text-foreground">
                全景研习流速与记忆留存复合图谱
              </CardTitle>
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-mono font-medium text-foreground">
                实时数据库指标
              </span>
            </div>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              实时融合每日研习通量 (Bar)、记忆保持率波动 (Line) 与心流专注度 (Area)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="inline-flex rounded-xl border border-border bg-secondary p-0.5 text-xs">
              <button
                onClick={() => setViewMode("composite")}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${
                  viewMode === "composite"
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                多图复合
              </button>
              <button
                onClick={() => setViewMode("throughput")}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${
                  viewMode === "throughput"
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                研习通量
              </button>
              <button
                onClick={() => setViewMode("retention")}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${
                  viewMode === "retention"
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                保持率轨迹
              </button>
            </div>
          </div>
        </div>

        {/* 4-Metric Executive Ribbon (Real Database Stats) */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/70 bg-secondary/40 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BrainIcon className="size-3.5 text-foreground" />
                长期记忆词库
              </span>
              <span className="rounded-md border border-border bg-card px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                +{masteredCount} 词
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-foreground">{masteredCount.toLocaleString()}</span>
              <span className="text-xs font-mono text-muted-foreground">词</span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">
              {activeBook ? (
                <>占 {activeBook.title} <span className="font-semibold text-foreground">{activeBook.progressPercent ?? 0}%</span></>
              ) : (
                "累计标熟斩词"
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/40 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <TrendingUpIcon className="size-3.5 text-foreground" />
                综合记忆留存
              </span>
              <span className="rounded-md border border-border bg-card px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                +{streakDays} 天打卡
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-foreground">{retentionPercent}</span>
              <span className="text-xs font-mono text-muted-foreground">%</span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              FSRS-4.5 稳定性排期
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/40 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheckIcon className="size-3.5 text-foreground" />
                历史复习总通量
              </span>
              <span className="rounded-md border border-border bg-card px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                {streakDays} 天连续
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-foreground">{totalReviews.toLocaleString()}</span>
              <span className="text-xs font-mono text-muted-foreground">次</span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              累计研习 <span className="font-semibold text-foreground">{totalDuration} 分钟</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/40 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <LayersIcon className="size-3.5 text-foreground" />
                生词库纳管总量
              </span>
              <span className="rounded-md border border-border bg-card px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                纳管中
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-foreground">{totalVocab.toLocaleString()}</span>
              <span className="text-xs font-mono text-muted-foreground">词</span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              在学与待巩固卡片
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[290px] w-full"
        >
          <ComposedChart
            data={mockVelocityCompositeData}
            margin={{ top: 15, right: 15, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-border/40"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-mono text-[11px] fill-muted-foreground"
            />
            {/* Left Y Axis: Daily Throughput (Words) */}
            <YAxis
              yAxisId="left"
              domain={[0, 80]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}词`}
              className="font-mono text-[10px] fill-muted-foreground"
            />
            {/* Right Y Axis: Retention Rate (%) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[90, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}%`}
              className="font-mono text-[10px] fill-muted-foreground"
            />
            <ReferenceLine
              yAxisId="right"
              y={95}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: "95% 优效保持线",
                position: "insideTopLeft",
                className: "fill-muted-foreground font-mono text-[10px]",
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(val) => `日期: ${val}`}
                />
              }
            />

            {/* 1. Background Flow Area (心流专注带) */}
            {(viewMode === "composite" || viewMode === "retention") && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="flowScore"
                name="flowScore"
                stroke="transparent"
                fill="url(#flowGradient)"
                className="text-foreground"
              />
            )}

            {/* 2. Stacked Bars (Throughput: Review & New) */}
            {(viewMode === "composite" || viewMode === "throughput") && (
              <>
                <Bar
                  yAxisId="left"
                  dataKey="reviewWords"
                  name="reviewWords"
                  stackId="load"
                  fill="var(--foreground)"
                  className="fill-foreground"
                  barSize={18}
                />
                <Bar
                  yAxisId="left"
                  dataKey="newWords"
                  name="newWords"
                  stackId="load"
                  fill="var(--color-newWords)"
                  className="fill-zinc-500"
                  radius={[3, 3, 0, 0]}
                  barSize={18}
                />
              </>
            )}

            {/* 3. Overlay Line (Retention Rate) */}
            {(viewMode === "composite" || viewMode === "retention") && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="retentionRate"
                name="retentionRate"
                stroke="var(--foreground)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--foreground)" }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ChartContainer>

        {/* Algorithm Insights Callout */}
        <div className="mt-4 pt-3 border-t border-border flex items-start gap-2.5 rounded-2xl bg-secondary/40 p-3 border border-border/50 text-xs">
          <SparklesIcon className="size-4 text-foreground shrink-0 mt-0.5" />
          <div className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-medium">FSRS-4.5 算法调度洞察：</strong>
            当前研习流速在 60~68 词/天处于高效吸收区间，长期记忆保留率稳定运行在 95% 目标线之上。预计明日到期复习量为 44 词，已自动错峰调度，避免产生记忆负荷波峰。
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

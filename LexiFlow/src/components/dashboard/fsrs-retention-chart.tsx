"use client"

import * as React from "react"
import {
  AreaChart,
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
import { mockFsrsRetentionData } from "@/data/mock-lexiflow"
import { ZapIcon } from "lucide-react"

const chartConfig = {
  fsrs: {
    label: "FSRS-4.5 动态保持率",
    color: "var(--foreground)",
  },
  ebbinghaus: {
    label: "自然遗忘衰减基线",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig

export function FsrsRetentionChart() {
  const [timeRange, setTimeRange] = React.useState<"30d" | "7d">("30d")

  const displayData = React.useMemo(() => {
    if (timeRange === "7d") {
      return mockFsrsRetentionData.slice(0, 4)
    }
    return mockFsrsRetentionData
  }, [timeRange])

  return (
    <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="p-0 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-background">
                <ZapIcon className="size-3.5" />
              </span>
              <CardTitle className="text-base font-bold text-foreground">
                FSRS 记忆保持率与衰减对比
              </CardTitle>
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-mono font-medium text-foreground">
                v4.5 矩阵
              </span>
            </div>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              实时追踪艾宾浩斯自然遗忘与 FSRS 算法间隔调度后的记忆固化轨迹
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex rounded-xl border border-border bg-secondary p-0.5 text-xs">
              <button
                onClick={() => setTimeRange("7d")}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${
                  timeRange === "7d"
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7 天微观
              </button>
              <button
                onClick={() => setTimeRange("30d")}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${
                  timeRange === "30d"
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                30 天全景
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <AreaChart
            data={displayData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fsrsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-border/40"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-mono text-[11px] fill-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}%`}
              className="font-mono text-[11px] fill-muted-foreground"
            />
            <ReferenceLine
              y={90}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: "90% 期望召回目标",
                position: "insideTopRight",
                className: "fill-muted-foreground font-mono text-[10px]",
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(val) => `周期: ${val}`}
                />
              }
            />
            {/* Natural Decay Baseline */}
            <Area
              type="monotone"
              dataKey="ebbinghaus"
              name="ebbinghaus"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="transparent"
            />
            {/* FSRS Retention Curve */}
            <Area
              type="monotone"
              dataKey="fsrs"
              name="fsrs"
              stroke="var(--foreground)"
              strokeWidth={2.5}
              fill="url(#fsrsGradient)"
              className="text-foreground"
            />
          </AreaChart>
        </ChartContainer>

        {/* Metric Annotations Footer */}
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">当前总体召回率</span>
            <span className="text-sm font-bold text-foreground">96.0%</span>
          </div>
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">抗遗忘增益 (Δ)</span>
            <span className="text-sm font-bold text-foreground">+83.0%</span>
          </div>
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">下次强化拐点</span>
            <span className="text-sm font-bold text-foreground">2.4 天后</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

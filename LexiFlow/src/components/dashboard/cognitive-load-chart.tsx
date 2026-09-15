"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
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
import { mockCognitiveLoadData } from "@/data/mock-lexiflow"
import { LayersIcon } from "lucide-react"

const chartConfig = {
  review: {
    label: "稳态复习 (Review)",
    color: "#18181B",
  },
  newWords: {
    label: "新词摄入 (New)",
    color: "#71717A",
  },
  lapse: {
    label: "遗忘重学 (Lapse)",
    color: "#D4D4D8",
  },
} satisfies ChartConfig

export function CognitiveLoadChart() {
  return (
    <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="p-0 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-background">
                <LayersIcon className="size-3.5" />
              </span>
              <CardTitle className="text-base font-bold text-foreground">
                14 天认知负荷与复习通量
              </CardTitle>
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-mono font-medium text-foreground">
                通量监控
              </span>
            </div>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              跟踪每日稳态复习、新词摄入与遗忘重学的认知压力分配
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-foreground" />
              <span className="text-muted-foreground text-[11px]">复习</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-500" />
              <span className="text-muted-foreground text-[11px]">新词</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span className="text-muted-foreground text-[11px]">重学</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <BarChart
            data={mockCognitiveLoadData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
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
            <YAxis
              tickLine={false}
              axisLine={false}
              className="font-mono text-[11px] fill-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(label) => `日期: ${label}`}
                />
              }
            />
            <Bar
              dataKey="review"
              stackId="load"
              fill="var(--color-review)"
              className="fill-foreground"
            />
            <Bar
              dataKey="newWords"
              stackId="load"
              fill="var(--color-newWords)"
              className="fill-zinc-500"
            />
            <Bar
              dataKey="lapse"
              stackId="load"
              radius={[4, 4, 0, 0]}
              fill="var(--color-lapse)"
              className="fill-zinc-300 dark:fill-zinc-600"
            />
          </BarChart>
        </ChartContainer>

        {/* Cognitive Metric Annotations */}
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">日均研习通量</span>
            <span className="text-sm font-bold text-foreground">70.4 词/天</span>
          </div>
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">遗忘反弹率</span>
            <span className="text-sm font-bold text-foreground">7.8% (优)</span>
          </div>
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">负荷稳定性</span>
            <span className="text-sm font-bold text-foreground">98.2% 心流</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

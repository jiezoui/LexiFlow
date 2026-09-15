"use client"

import * as React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
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
import { mockCorpusDistributionData } from "@/data/mock-lexiflow"
import { VideoIcon, BookOpenIcon, HeadphonesIcon, GlobeIcon, PieChartIcon } from "lucide-react"

const DONUT_COLORS = ["#18181B", "#52525B", "#71717A", "#A1A1AA"]

const chartConfig = {
  count: {
    label: "采摘切片数",
  },
  youtube: {
    label: "YouTube 播客",
    color: "#18181B",
  },
  bilibili: {
    label: "B站原声演讲",
    color: "#52525B",
  },
  articles: {
    label: "外刊深度长文",
    color: "#71717A",
  },
  wordbook: {
    label: "大纲词书",
    color: "#A1A1AA",
  },
} satisfies ChartConfig

export function CorpusDonutChart() {
  const totalSlices = React.useMemo(() => {
    return mockCorpusDistributionData.reduce((acc, curr) => acc + curr.count, 0)
  }, [])

  return (
    <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-background">
              <PieChartIcon className="size-3.5" />
            </span>
            <CardTitle className="text-base font-bold text-foreground">
              语境切片来源分布
            </CardTitle>
          </div>
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-mono font-bold text-foreground">
            多源渗透
          </span>
        </div>
        <CardDescription className="mt-1 text-xs text-muted-foreground">
          统计当前语境库真实影视、播客与外刊的采摘比率
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        {/* Donut Chart with Center Metric */}
        <div className="relative flex items-center justify-center py-1">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[175px] w-full"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={mockCorpusDistributionData}
                dataKey="count"
                nameKey="source"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                strokeWidth={2}
                stroke="var(--background)"
              >
                {mockCorpusDistributionData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          {/* Center Hole Text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {totalSlices}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              总切片数
            </span>
          </div>
        </div>

        {/* Source Breakdown Table */}
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {mockCorpusDistributionData.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                />
                <span className="text-muted-foreground truncate max-w-[140px]">
                  {item.source}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{item.count} 条</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

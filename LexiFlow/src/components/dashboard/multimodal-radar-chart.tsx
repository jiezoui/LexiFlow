"use client"

import * as React from "react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
import { mockRadarData } from "@/data/mock-lexiflow"
import { CompassIcon } from "lucide-react"

const chartConfig = {
  userScore: {
    label: "当前多模态能力",
    color: "var(--foreground)",
  },
  average: {
    label: "同级学习者均值",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig

export function MultimodalRadarChart() {
  return (
    <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-background">
              <CompassIcon className="size-3.5" />
            </span>
            <CardTitle className="text-base font-bold text-foreground">
              6 维声学与认知雷达
            </CardTitle>
          </div>
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-mono font-bold text-foreground">
            综合: S级 (88.0)
          </span>
        </div>
        <CardDescription className="mt-1 text-xs text-muted-foreground">
          基于 SLA 多模态假说评估听、读、音、稳全维度能力
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <RadarChart
            data={mockRadarData}
            margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
          >
            <PolarGrid stroke="var(--border)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{
                fill: "var(--foreground)",
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              stroke="var(--border)"
              tick={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {/* Cohort average baseline */}
            <Radar
              name="average"
              dataKey="average"
              stroke="var(--muted-foreground)"
              fill="var(--muted-foreground)"
              fillOpacity={0.08}
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            {/* User score */}
            <Radar
              name="userScore"
              dataKey="userScore"
              stroke="var(--foreground)"
              fill="var(--foreground)"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>

        {/* Radar Insights Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
          <div className="text-muted-foreground truncate">
            峰值: <span className="font-bold text-foreground">记忆稳定性 (95)</span>
          </div>
          <div className="text-muted-foreground truncate">
            强化项: <span className="font-bold text-foreground">真题覆盖</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

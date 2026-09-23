"use client"

import Link from "next/link"
import { ActivityIcon, ArrowRightIcon, ClockIcon } from "lucide-react"

interface MemoryStateCardProps {
  retentionRate?: number
  learningCount?: number
  dueSoonCount?: number
  relearningCount?: number
  stableCount?: number
  nextWindowTime?: string
}

export function MemoryStateCard({
  retentionRate = 82,
  learningCount = 26,
  dueSoonCount = 6,
  relearningCount = 4,
  stableCount = 18,
  nextWindowTime = "19:40",
}: MemoryStateCardProps) {
  const strokeWidth = 7
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (retentionRate / 100) * circumference

  return (
    <article className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm flex flex-col justify-between transition-all">
      {/* ── 1. Top Header Row ── */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <ActivityIcon className="size-4 text-zinc-900 dark:text-zinc-100" />
          <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
            记忆状态
          </h2>
        </div>
      </div>

      {/* ── 2. Center: Ring Gauge & Metrics List ── */}
      <div className="my-3 grid grid-cols-12 gap-3 items-center">
        {/* 左侧：环形进度仪表盘 */}
        <div className="col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex size-24 items-center justify-center">
            <svg className="size-full -rotate-90 transform" viewBox="0 0 96 96">
              {/* 底轨 */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="#F4F4F5"
                strokeWidth={strokeWidth}
                fill="none"
                className="dark:stroke-zinc-800"
              />
              {/* 进度弧线 */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="#18181B"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="dark:stroke-zinc-100 transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                {retentionRate}%
              </span>
              <span className="mt-1 text-[9.5px] text-zinc-400 font-sans leading-none">
                记忆稳定度
              </span>
            </div>
          </div>
        </div>

        {/* 右侧：4 细分指标纵向列表 */}
        <div className="col-span-7 flex flex-col justify-center gap-1.5 pl-2">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs w-6 text-left">
              {learningCount}
            </span>
            <span className="text-zinc-400 flex-1 text-right">今日学习词</span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs w-6 text-left">
              {dueSoonCount}
            </span>
            <span className="text-zinc-400 flex-1 text-right">即将遗忘 (24h 内)</span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs w-6 text-left">
              {relearningCount}
            </span>
            <span className="text-zinc-400 flex-1 text-right">需要重点强化</span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs w-6 text-left">
              {stableCount}
            </span>
            <span className="text-zinc-400 flex-1 text-right">记忆稳定</span>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom: Next Review Window ── */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <ClockIcon className="size-3 text-zinc-700 dark:text-zinc-300" />
          <span>下一个最佳复习窗口</span>
          <strong className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{nextWindowTime}</strong>
        </div>

        <Link
          href="/dashboard/analytics"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-500 transition-colors shrink-0"
        >
          <span>查看详情</span>
          <ArrowRightIcon className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  )
}

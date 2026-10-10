"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRightIcon, SlidersHorizontalIcon, BookOpenIcon } from "lucide-react"
import { LanguageGlobe } from "@/components/language-globe/LanguageGlobe"
import { type StudyPlanOverview } from "@/lib/api-client"
import { PlanConfigDialog } from "@/components/plan/plan-config-dialog"

interface TodayHeroBannerProps {
  userName?: string
  plan?: StudyPlanOverview | null
  dueCount?: number
  newCount?: number
  completedToday?: number
  estimatedMinutes?: number
  onPlanUpdated?: (newPlan: StudyPlanOverview) => void
}

export function TodayHeroBanner({
  userName = "Lin",
  plan,
  dueCount = 0,
  newCount = 20,
  completedToday = 0,
  estimatedMinutes = 15,
  onPlanUpdated,
}: TodayHeroBannerProps) {
  const [greeting, setGreeting] = useState("Good evening")
  const [planDialogOpen, setPlanDialogOpen] = useState(false)

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const hour = new Date().getHours()
      if (hour >= 5 && hour < 12) {
        setGreeting("Good morning")
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Good afternoon")
      } else {
        setGreeting("Good evening")
      }
    })
    return () => cancelAnimationFrame(frameId)
  }, [])

  // 提取或回退计划数据
  const macro = plan?.macro
  const todayTasks = plan?.today

  const vocabLearned = todayTasks?.vocab.learned ?? completedToday
  const vocabTarget = todayTasks?.vocab.target ?? (newCount > 0 ? Math.min(newCount, 20) : 20)
  const vocabDue = todayTasks?.vocab.dueReview ?? dueCount

  const shadowingDone = todayTasks?.shadowing.completed ?? 0
  const shadowingTarget = todayTasks?.shadowing.target ?? 3

  const contextMinutes = todayTasks?.context.currentMinutes ?? 0
  const contextTargetMinutes = todayTasks?.context.targetMinutes ?? 15

  const wordbookTitle = macro?.wordbookTitle || "主修词书"
  const progressPercent = macro?.progressPercent ?? 0
  const estimatedDate = macro?.estimatedDate || "测算中"

  return (
    <>
      <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#000000] text-white p-5 sm:p-6 lg:p-7 shadow-2xl transition-all">
        {/* 细腻微光暗纹背景 */}
        <div className="pointer-events-none absolute right-0 top-0 size-[540px] rounded-full bg-gradient-to-br from-zinc-700/10 via-zinc-800/5 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute left-0 bottom-0 size-[360px] rounded-full bg-gradient-to-tr from-zinc-800/10 to-transparent blur-3xl" />

        {/* 顶部主攻计划状态胶囊 */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="flex items-center gap-1 font-medium text-white">
              <BookOpenIcon className="size-3.5 text-zinc-400" />
              {wordbookTitle}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-zinc-300">掌握度 {progressPercent}%</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">预计 {estimatedDate} 完成</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
            >
              <span>计划中心</span>
            </Link>
            <button
              type="button"
              onClick={() => setPlanDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
            >
              <SlidersHorizontalIcon className="size-3 text-zinc-400" />
              <span>快速调整</span>
            </button>
          </div>
        </div>

        {/* 主体两栏布局：左叙事 + 右 3D 语言粒子球体 */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* 左侧主要叙事区 */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between z-40 relative py-1 sm:py-2 lg:translate-y-10">
            <div>
              {/* 时间问候语 */}
              <p className="font-serif italic text-zinc-400 text-sm sm:text-base tracking-wide">
                {greeting}, {userName}.
              </p>

              {/* 大标题 */}
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-white leading-[1.15]">
                今日计划
              </h1>
            </div>

            {/* 行动按钮 */}
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/cards"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-950 shadow-md transition-all duration-200 hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>开始今日学习</span>
                <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* 右侧：3D 语言粒子球体展示区 */}
          <div className="lg:col-span-7 xl:col-span-7 relative flex items-center justify-center min-h-[260px] sm:min-h-[300px] lg:min-h-[340px] h-[300px] sm:h-[330px] lg:h-[350px] overflow-visible z-30">
            <LanguageGlobe className="w-full h-full" translateX="75px" />
          </div>
        </div>

        {/* 底部多模块三维研习指标 (清晰对齐，无冗余，无 emoji) */}
        <div className="relative z-20 mt-3 pt-4 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* 维度 1: 词汇内化 */}
          <div className="flex flex-col">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
              {vocabLearned} / {vocabTarget}
            </span>
            <span className="mt-1.5 text-xs text-zinc-400 font-sans">
              新词研习 · {vocabDue} 待复习
            </span>
          </div>

          {/* 维度 2: 发音输出 */}
          <div className="flex flex-col">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
              {shadowingDone} / {shadowingTarget}
            </span>
            <span className="mt-1.5 text-xs text-zinc-400 font-sans">
              影子跟读 (句)
            </span>
          </div>

          {/* 维度 3: 语境输入 */}
          <div className="flex flex-col">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
              {contextMinutes} / {contextTargetMinutes}m
            </span>
            <span className="mt-1.5 text-xs text-zinc-400 font-sans">
              视听读时长
            </span>
          </div>

          {/* 维度 4: 预估耗时 */}
          <div className="flex flex-col">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
              {estimatedMinutes}m
            </span>
            <span className="mt-1.5 text-xs text-zinc-400 font-sans">
              预计总用时
            </span>
          </div>
        </div>
      </article>

      {/* 计划调整弹窗 */}
      <PlanConfigDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        currentPlan={plan}
        onSuccess={(newPlan) => onPlanUpdated?.(newPlan)}
      />
    </>
  )
}

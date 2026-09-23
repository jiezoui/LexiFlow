"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { LanguageGlobe } from "@/components/language-globe/LanguageGlobe"

interface TodayHeroBannerProps {
  userName?: string
  dueCount: number
  newCount: number
  completedToday: number
  estimatedMinutes: number
  focusWords?: string[]
}

export function TodayHeroBanner({
  userName = "Lin",
  dueCount,
  newCount,
  completedToday,
  estimatedMinutes,
}: TodayHeroBannerProps) {
  const [greeting, setGreeting] = useState("Good evening")

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      setGreeting("Good morning")
    } else if (hour >= 12 && hour < 18) {
      setGreeting("Good afternoon")
    } else {
      setGreeting("Good evening")
    }
  }, [])

  return (
    <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#000000] text-white p-5 sm:p-6 lg:p-7 shadow-2xl transition-all">
      {/* 细腻微光暗纹背景 */}
      <div className="pointer-events-none absolute right-0 top-0 size-[540px] rounded-full bg-gradient-to-br from-zinc-700/10 via-zinc-800/5 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute left-0 bottom-0 size-[360px] rounded-full bg-gradient-to-tr from-zinc-800/10 to-transparent blur-3xl" />

      {/* 主体两栏布局：左叙事 (5 列) + 右 3D 语言粒子球体 (7 列，最高优先级，全景舒展不被框裁切) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* 左侧主要叙事区 */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between z-40 relative py-1 sm:py-2">
          <div>
            {/* 时间问候语 */}
            <p className="font-serif italic text-zinc-400 text-sm sm:text-base tracking-wide">
              {greeting}, {userName}.
            </p>

            {/* 大标题 */}
            <h1 className="mt-2.5 text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-white leading-[1.15]">
              让语言
              <br />
              在真实世界中流动。
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

        {/* 右侧：3D 语言粒子球体展示区（显著提高高度至 350-370px，气势磅礴，粒子舒展） */}
        <div className="lg:col-span-7 xl:col-span-7 relative flex items-center justify-center min-h-[280px] sm:min-h-[320px] lg:min-h-[360px] h-[320px] sm:h-[350px] lg:h-[370px] overflow-visible z-30 lg:-ml-2 xl:-ml-3">
          {/* 原装 3D 语言粒子球体（独立模块，优先级顶层） */}
          <LanguageGlobe className="w-full h-full" />
        </div>
      </div>

      {/* 底部 4 列核心大指标 */}
      <div className="relative z-20 mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* 指标 1 */}
        <div className="flex flex-col">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
            {dueCount}
          </span>
          <span className="mt-1.5 text-xs text-zinc-400 font-sans">到期复习</span>
        </div>

        {/* 指标 2 */}
        <div className="flex flex-col">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
            {newCount.toLocaleString()}
          </span>
          <span className="mt-1.5 text-xs text-zinc-400 font-sans">新词待学</span>
        </div>

        {/* 指标 3 */}
        <div className="flex flex-col">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
            {completedToday}
          </span>
          <span className="mt-1.5 text-xs text-zinc-400 font-sans">今日学习量</span>
        </div>

        {/* 指标 4 */}
        <div className="flex flex-col">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
            {estimatedMinutes}m
          </span>
          <span className="mt-1.5 text-xs text-zinc-400 font-sans">预计耗时</span>
        </div>
      </div>
    </article>
  )
}

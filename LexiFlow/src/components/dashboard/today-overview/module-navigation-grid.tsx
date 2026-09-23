"use client"

import Link from "next/link"
import Image from "next/image"
import {
  ArrowRightIcon,
  PlayIcon,
  BookOpenIcon,
  VideoIcon,
  MicIcon,
  LayersIcon,
} from "lucide-react"

interface ModuleNavigationGridProps {
  dueCardsCount: number
  articlesCount: number
  videosCount: number
  shadowingCount: number
  sampleWord?: {
    lemma: string
    phonetic?: string
  }
}

export function ModuleNavigationGrid({
  dueCardsCount = 6,
  articlesCount = 12,
  videosCount = 8,
  shadowingCount = 4,
  sampleWord = { lemma: "abandon", phonetic: "/ə'bændən/" },
}: ModuleNavigationGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full">
      {/* ── 卡片 1: 闪卡复习 ── */}
      <Link
        href="/cards"
        className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-lg min-h-[168px] sm:min-h-[176px]"
      >
        <div>
          {/* Header */}
          <div className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-5.5 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm">
                  <LayersIcon className="size-3" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  闪卡复习
                </h2>
              </div>
              <ArrowRightIcon className="size-3.5 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400 font-normal">
              基于 FSRS，科学安排记忆
            </p>
          </div>

          {/* 拟物单词叠卡展示 (紧凑高度) */}
          <div className="relative my-2 w-full h-[68px] sm:h-[72px] flex items-center justify-center overflow-hidden">
            {/* 底层阴影卡片 1 */}
            <div
              className="absolute left-2.5 top-1.5 h-[56px] w-[86%] rounded-xl border border-zinc-200/80 bg-zinc-100/90 dark:border-zinc-700 dark:bg-zinc-800/60 shadow-sm"
              style={{ transform: "rotate(-3.5deg)" }}
            />
            {/* 中层阴影卡片 2 */}
            <div
              className="absolute left-4 top-1 h-[58px] w-[88%] rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 shadow-sm"
              style={{ transform: "rotate(-1deg)" }}
            />
            {/* 顶层主卡片 */}
            <div className="relative z-10 ml-auto mr-1 h-[62px] w-[90%] rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 shadow-sm flex flex-col justify-center transition-transform duration-300 group-hover:scale-[1.01]">
              <div className="text-center my-auto">
                <p className="font-extrabold text-sm sm:text-[15px] text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight">
                  {sampleWord.lemma || "abandon"}
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5 leading-none">
                  {sampleWord.phonetic || "/ə'bændən/"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部统计 */}
        <div className="shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400 font-sans flex items-center justify-between">
          <span>{dueCardsCount} 个单词待复习</span>
          <span className="text-[10px] font-mono text-zinc-400">FSRS v5</span>
        </div>
      </Link>

      {/* ── 卡片 2: 语境文章 ── */}
      <Link
        href="/reading/story"
        className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-lg min-h-[168px] sm:min-h-[176px]"
      >
        <div>
          {/* Header */}
          <div className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-5.5 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm">
                  <BookOpenIcon className="size-3" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  语境文章
                </h2>
              </div>
              <ArrowRightIcon className="size-3.5 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400 font-normal">
              在真实语境中理解与记忆
            </p>
          </div>

          {/* 典雅雪山名言画幅 (紧凑高度) */}
          <div className="relative my-2 w-full h-[68px] sm:h-[72px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner flex items-center justify-center">
            <div className="absolute inset-0">
              <Image
                src="/images/dashboard/mountain_reading_hd.png"
                alt="Context Reading Mountain Background"
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[0.5px]" />
            </div>

            <div className="relative z-10 px-2.5 text-center">
              <p className="font-serif italic text-white text-[11px] sm:text-xs leading-snug drop-shadow-md">
                “Language is not a set of words,
                <br />
                but a way of seeing the world.”
              </p>
            </div>
          </div>
        </div>

        {/* 底部统计 */}
        <div className="shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400 font-sans flex items-center justify-between">
          <span>{articlesCount} 篇精选文章</span>
          <span className="text-[10px] font-mono text-zinc-400">Curated</span>
        </div>
      </Link>

      {/* ── 卡片 3: 视频精听 ── */}
      <Link
        href="/videos"
        className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-lg min-h-[168px] sm:min-h-[176px]"
      >
        <div>
          {/* Header */}
          <div className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-5.5 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm">
                  <VideoIcon className="size-3" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  视频精听
                </h2>
              </div>
              <ArrowRightIcon className="size-3.5 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400 font-normal">
              从兴趣内容中高效输入
            </p>
          </div>

          {/* 拟真雪山视频播放器 UI (紧凑高度) */}
          <div className="relative my-2 w-full h-[68px] sm:h-[72px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner flex flex-col justify-between p-1.5 sm:p-2">
            <div className="absolute inset-0">
              <Image
                src="/images/dashboard/mountain_video_hd.png"
                alt="Video Listening Mountain Background"
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/35" />
            </div>

            <div className="relative z-10 my-auto flex items-center justify-center">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-950/90 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
                <PlayIcon className="size-3 fill-current ml-0.5 text-white" />
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-[7.5px] font-mono text-zinc-200 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
              <span>00:00</span>
              <div className="mx-1.5 h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full w-2/5 bg-white rounded-full" />
              </div>
              <span>06:24</span>
            </div>
          </div>
        </div>

        {/* 底部统计 */}
        <div className="shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400 font-sans flex items-center justify-between">
          <span>{videosCount} 个推荐视频</span>
          <span className="text-[10px] font-mono text-zinc-400">Immersion</span>
        </div>
      </Link>

      {/* ── 卡片 4: 影子跟读 ── */}
      <Link
        href="/practice/shadowing"
        className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-lg min-h-[168px] sm:min-h-[176px]"
      >
        <div>
          {/* Header */}
          <div className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-5.5 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm">
                  <MicIcon className="size-3" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  影子跟读
                </h2>
              </div>
              <ArrowRightIcon className="size-3.5 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400 font-normal">
              听·模仿·内化·流利表达
            </p>
          </div>

          {/* 拟真声学波形 (紧凑高度) */}
          <div className="relative my-2 w-full h-[68px] sm:h-[72px] overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-800/50 shadow-inner flex items-center justify-between px-3">
            <div className="relative flex items-center justify-center h-full w-[45%]">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="size-11 rounded-full border border-zinc-300/60 dark:border-zinc-600/40" />
                <div className="size-15 rounded-full border border-zinc-300/30 dark:border-zinc-600/20" />
              </div>

              <div className="relative z-10 flex items-center gap-[2px]">
                {[6, 12, 10, 18, 14, 22, 18, 24, 20, 22, 15, 18, 11, 15, 9, 5].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-[2px] rounded-full bg-zinc-400 dark:bg-zinc-500 transition-all duration-300 group-hover:bg-zinc-800 dark:group-hover:bg-zinc-200"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-center pl-2 text-left">
              <span className="font-serif font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                Practice
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans leading-tight mt-0.5">
                makes natural.
              </span>
              <div className="w-5 h-[2px] bg-zinc-800 dark:bg-zinc-300 mt-1" />
            </div>
          </div>
        </div>

        {/* 底部统计 */}
        <div className="shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400 font-sans flex items-center justify-between">
          <span>{shadowingCount} 个推荐片段</span>
          <span className="text-[10px] font-mono text-zinc-400">Acoustic</span>
        </div>
      </Link>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  PlayIcon,
  BookOpenIcon,
  ArrowRightLeftIcon,
  SlidersHorizontalIcon,
  ArrowUpRightIcon,
  XIcon,
} from "lucide-react"
import { wordbookApi, type Wordbook, type WordbookStatusCounts } from "@/lib/api-client"

export function HeroMissionCard({ minimal = false }: { minimal?: boolean }) {
  const [activeBook, setActiveBook] = useState<Wordbook | null>(null)
  const [counts, setCounts] = useState<WordbookStatusCounts | null>(null)
  const [dailyTarget, setDailyTarget] = useState<number>(20)
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false)
  const [customTargetInput, setCustomTargetInput] = useState<string>("20")

  // 从 localStorage 获取当前主词书 ID 与每日目标
  const fetchActiveWordbookData = useCallback(async () => {
    try {
      const savedPrimaryId = localStorage.getItem("lexiflow_primary_wordbook_id")
      const bookId = savedPrimaryId ? Number(savedPrimaryId) : 1

      const savedTarget = localStorage.getItem("lexiflow_daily_target")
      if (savedTarget) {
        const num = Number(savedTarget)
        if (num > 0) {
          setDailyTarget(num)
          setCustomTargetInput(String(num))
        }
      }

      const [bookData, countData] = await Promise.all([
        wordbookApi.getDetail(bookId).catch(() => null),
        wordbookApi.getStatusCounts(bookId).catch(() => null),
      ])

      if (bookData) setActiveBook(bookData)
      if (countData) setCounts(countData)
    } catch (err) {
      console.warn("Failed to fetch active wordbook overview:", err)
    }
  }, [])

  useEffect(() => {
    fetchActiveWordbookData()

    const handleUpdate = () => fetchActiveWordbookData()
    const handleFocus = () => fetchActiveWordbookData()

    window.addEventListener("lexiflow_wordbook_updated", handleUpdate)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("storage", handleUpdate)

    return () => {
      window.removeEventListener("lexiflow_wordbook_updated", handleUpdate)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [fetchActiveWordbookData])

  // 保存每日新词研习目标
  const handleSaveTarget = (targetNum: number) => {
    if (targetNum <= 0) return
    setDailyTarget(targetNum)
    setCustomTargetInput(String(targetNum))
    try {
      localStorage.setItem("lexiflow_daily_target", String(targetNum))
    } catch {}
    setShowTargetModal(false)
  }

  // 动态数据计算
  const title = activeBook?.title || "CET-4 四级高频词汇"
  const totalWords = activeBook?.totalWords ?? counts?.allCount ?? 0
  const masteredWords = activeBook?.masteredWords ?? counts?.masteredCount ?? 0
  const learnedWords = activeBook?.learnedWords ?? 0
  const progressPercent = activeBook
    ? (activeBook.progressPercent ?? 0)
    : totalWords > 0
    ? Math.round((masteredWords / totalWords) * 1000) / 10
    : 0

  // 到期复习、新词待学与预估耗时
  const dueReview = counts?.dueCount ?? (counts?.reviewingCount || 0)
  const newWords = counts?.unlearnedCount ?? Math.max(0, totalWords - learnedWords)
  const estimatedMinutes = Math.max(
    3,
    Math.ceil(dueReview * 0.6 + Math.min(newWords, dailyTarget) * 0.9)
  )

  // 预计完成日期计算
  const remainingUnmastered = Math.max(0, totalWords - masteredWords)
  const daysNeeded = dailyTarget > 0 ? Math.ceil(remainingUnmastered / dailyTarget) : 0
  const targetDateObj = new Date(Date.now() + daysNeeded * 86400000)
  const targetDateStr = daysNeeded === 0 ? "今日已全通" : `${targetDateObj.getMonth() + 1}月${targetDateObj.getDate()}日`

  return (
    <article className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-50 p-6 sm:p-8 md:p-9 shadow-sm flex flex-col justify-between transition-all">
      {/* ── 1. Top Header Row: Active Wordbook Pill ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-end gap-3 text-zinc-400 font-mono text-[11px] tracking-wider uppercase pb-5 border-b border-zinc-800/80">
        {/* Unified Active Wordbook Tag (动态展示当前主词书与真实标熟进度) */}
        <div className="flex items-center gap-2">
          <Link
            href={`/wordbooks?bookId=${activeBook?.id || 1}`}
            className="group inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs font-mono text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
            title="点击展开当前主研习词书"
          >
            <BookOpenIcon className="size-3.5 text-zinc-400 group-hover:text-white" />
            <span className="font-sans font-medium text-white">{title}</span>
            <span className="text-zinc-500">•</span>
            <span className="font-bold text-zinc-200">{progressPercent}%</span>
            <ArrowUpRightIcon className="size-3 text-zinc-500 group-hover:text-white" />
          </Link>
        </div>
      </div>

      {/* ── 2. Main Title & Description ── */}
      <div className="relative z-10 my-6 sm:my-7">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white max-w-[640px]">
          把今天该记住的，<br />
          交给今天的你。
        </h2>
        <p className="mt-2.5 max-w-[560px] text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
          今日研习队列深度融合了当前主词书「<span className="text-zinc-200 font-semibold">{title}</span>」、视频语境切片与生词本。由 FSRS 记忆间隔算法统一计算衰减，动态感知学习流。
        </p>
      </div>

      {/* ── 3. Integrated Dual Metrics Row: Task Stats + Wordbook Progress ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 border-t border-zinc-800/80 items-end">
        {/* Left: Today's FSRS Numbers (7 cols) */}
        <div className="lg:col-span-6 flex items-center gap-6 sm:gap-9">
          <div>
            <span className="block font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {dueReview}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400 font-sans">到期复习</span>
          </div>
          <div>
            <span className="block font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {newWords}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400 font-sans">新词待学</span>
          </div>
          <div>
            <span className="block font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {estimatedMinutes}m
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400 font-sans">预计耗时</span>
          </div>
        </div>

        {/* Right: Integrated Wordbook Progress & Actions (6 cols) */}
        <div className="lg:col-span-6 flex flex-col justify-end gap-2 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/70">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
            <span className="flex items-center gap-1.5 font-sans font-medium text-white">
              <BookOpenIcon className="size-3.5 text-zinc-400" />
              标熟掌握：{masteredWords.toLocaleString()} / {totalWords.toLocaleString()} 词
            </span>
            <span className="font-bold text-white">{progressPercent}%</span>
          </div>

          {/* Sleek Progress Bar (原声纯白优雅动态推进) */}
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1">
            <span>预计 {targetDateStr} 完成 · 在学 {learnedWords} 词</span>
            <div className="flex items-center gap-3">
              <Link
                href="/wordbooks"
                className="hover:text-white transition-colors flex items-center gap-1 font-sans"
              >
                <ArrowRightLeftIcon className="size-2.5" /> 切换主词书
              </Link>
              <span>•</span>
              <button
                onClick={() => setShowTargetModal(true)}
                className="hover:text-white transition-colors flex items-center gap-1 font-sans cursor-pointer text-zinc-300 hover:underline"
              >
                <SlidersHorizontalIcon className="size-2.5" /> 每日 {dailyTarget} 词
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Bottom Action Bar ── */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-800/60">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span>主词书标熟掌握度</span>
          <strong className="text-white font-bold">{progressPercent}%</strong>
          <span className="text-zinc-600">|</span>
          <span>今日待学总量</span>
          <strong className="text-white font-bold">{dueReview + Math.min(newWords, dailyTarget)} 词</strong>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/cards"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-zinc-950 shadow transition-all hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlayIcon className="size-3.5 fill-current text-zinc-950" />
            <span>进入 FSRS 闪卡研习</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.2 font-mono text-[9px] text-zinc-700">
              Space
            </kbd>
          </Link>

          {/* Minimalist Progress Ring (反映当前词书标熟掌握度) */}
          <div className="relative flex items-center justify-center">
            <svg className="size-14 -rotate-90 transform" viewBox="0 0 92 92">
              <circle
                cx="46"
                cy="46"
                r="34"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="46"
                cy="46"
                r="34"
                stroke="#FFFFFF"
                strokeWidth="6"
                strokeDasharray="213.6"
                strokeDashoffset={213.6 * (1 - progressPercent / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-semibold text-zinc-200">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 每日学习目标调整弹窗 */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setShowTargetModal(false)}
              className="absolute right-4 top-4 p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <XIcon className="size-4" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4 text-zinc-300" />
              调整每日新词研习量
            </h3>
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
              设定主词书「{title}」每天分配的新词目标，系统将实时更新通关预计完成日。
            </p>

            {/* Quick Presets */}
            <div className="mt-4 flex items-center gap-2">
              {[10, 15, 20, 30, 50].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSaveTarget(preset)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    dailyTarget === preset
                      ? "bg-white text-zinc-950 shadow"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="200"
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-zinc-400"
                placeholder="自定义新词数..."
              />
              <button
                onClick={() => {
                  const num = Number(customTargetInput)
                  if (num > 0) handleSaveTarget(num)
                }}
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-bold hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

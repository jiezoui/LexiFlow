"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  ArrowRightIcon,
  Volume2Icon,
  CheckCircle2Icon,
} from "lucide-react"

interface MemoryFlowNode {
  time: string
  title: string
  wordCount: number
  status: "done" | "current" | "pending"
  href: string
}

interface TodayMemoryFlowProps {
  nodes?: MemoryFlowNode[]
  focusWords?: string[]
}

const DEFAULT_NODES: MemoryFlowNode[] = [
  { time: "08:30", title: "闪卡复习", wordCount: 6, status: "done", href: "/cards" },
  { time: "12:40", title: "语境重遇", wordCount: 12, status: "current", href: "/reading/story" },
  { time: "16:20", title: "视频精听", wordCount: 8, status: "pending", href: "/videos" },
  { time: "19:30", title: "影子跟读", wordCount: 4, status: "pending", href: "/practice/shadowing" },
]

const DEFAULT_FOCUS_WORDS = [
  "abandon",
  "perceive",
  "significant",
  "retain",
  "context",
  "fluent",
]

export function TodayMemoryFlow({
  nodes = DEFAULT_NODES,
  focusWords = DEFAULT_FOCUS_WORDS,
}: TodayMemoryFlowProps) {
  const [speakingWord, setSpeakingWord] = useState<string | null>(null)

  const handleSpeak = (word: string) => {
    setSpeakingWord(word)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(word)
      u.lang = "en-US"
      u.rate = 0.95
      u.onend = () => setSpeakingWord(null)
      u.onerror = () => setSpeakingWord(null)
      window.speechSynthesis.speak(u)
    } else {
      setTimeout(() => setSpeakingWord(null), 800)
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm flex flex-col justify-between transition-all">
      {/* ── 1. Top Header Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
              <CalendarDaysIcon className="size-3.5" />
            </div>
            <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
              今日记忆流
            </h2>
          </div>
        </div>

        <Link
          href="/cards"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-500 transition-colors self-start sm:self-auto"
        >
          <span>查看完整计划</span>
          <ArrowRightIcon className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── 2. Center: Continuous Wave Timeline ── */}
      <div className="relative my-4 px-2 sm:px-4">
        {/* 背景平滑波浪连线 */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 w-full">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 400 50"
          >
            <path
              d="M 20 32 C 90 8, 140 42, 200 20 C 260 4, 310 38, 380 16"
              fill="none"
              stroke="#D4D4D8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="dark:stroke-zinc-700"
            />
          </svg>
        </div>

        {/* 4 个时段步进节点 */}
        <div className="relative z-10 grid grid-cols-4 gap-2 text-center items-center">
          {nodes.map((node) => {
            const isDone = node.status === "done"
            const isCurrent = node.status === "current"

            return (
              <Link
                key={node.time}
                href={node.href}
                className="group flex flex-col items-center focus:outline-none"
              >
                {/* 时间 */}
                <span className="font-mono text-[10.5px] text-zinc-400 tracking-tight group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  {node.time}
                </span>

                {/* 节点光标指示器 */}
                <div className="my-2 flex items-center justify-center">
                  {isDone ? (
                    <div className="flex size-5 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm transition-transform duration-200 group-hover:scale-110">
                      <CheckCircle2Icon className="size-3" />
                    </div>
                  ) : isCurrent ? (
                    <div className="relative flex size-5 items-center justify-center">
                      <span className="absolute size-4 rounded-full bg-zinc-900/20 dark:bg-zinc-100/20 animate-ping" />
                      <div className="size-3 rounded-full bg-zinc-950 dark:bg-zinc-100 ring-2 ring-white dark:ring-zinc-900" />
                    </div>
                  ) : (
                    <div className="size-2.5 rounded-full border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition-transform duration-200 group-hover:scale-110 group-hover:border-zinc-950" />
                  )}
                </div>

                {/* 环节标题与词数 */}
                <strong className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline">
                  {node.title}
                </strong>
                <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  {node.wordCount} words
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 3. Bottom: Today's Focus Words ── */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-400 shrink-0 font-medium">
          今日重点词汇：
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {focusWords.slice(0, 5).map((word) => {
            const isSpeaking = speakingWord === word
            return (
              <button
                key={word}
                type="button"
                onClick={() => handleSpeak(word)}
                title={`点击朗读: ${word}`}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-all duration-200 cursor-pointer ${
                  isSpeaking
                    ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 scale-105 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60"
                }`}
              >
                {isSpeaking && <Volume2Icon className="size-2.5 animate-pulse" />}
                <span>{word}</span>
              </button>
            )
          })}

          {/* 更多按钮 */}
          <Link
            href="/vocab"
            title="查看完整生词库"
            className="inline-flex items-center justify-center size-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 text-[10px] font-mono transition-colors"
          >
            ···
          </Link>
        </div>
      </div>
    </article>
  )
}

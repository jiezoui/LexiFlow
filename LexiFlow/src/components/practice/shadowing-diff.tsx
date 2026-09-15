"use client"

import { useState } from "react"
import { Volume2Icon, AlertCircleIcon, CheckIcon, HelpCircleIcon } from "lucide-react"
import type { AlignedToken } from "@/lib/word-aligner"

interface ShadowingDiffProps {
  tokens: AlignedToken[]
  onPlayWord?: (word: string) => void
  className?: string
}

export function ShadowingDiff({ tokens, onPlayWord, className = "" }: ShadowingDiffProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handlePlayWordAudio = (word: string) => {
    if (onPlayWord) {
      onPlayWord(word)
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const cleanWord = word.replace(/^[+“"']+|[”"',.?!:;]+$/g, "")
      const u = new SpeechSynthesisUtterance(cleanWord)
      u.lang = "en-US"
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 词块胶囊流 (Word Chips Stream) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 p-4 sm:p-5 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xs leading-loose">
        {tokens.map((token, idx) => {
          const isCorrect = token.status === "CORRECT"
          const isSub = token.status === "SUBSTITUTION"
          const isOmission = token.status === "OMISSION"
          const isInsertion = token.status === "INSERTION"

          return (
            <div
              key={`${token.word}-${idx}`}
              className="relative inline-flex items-center group"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 词块胶囊主体 */}
              <button
                type="button"
                onClick={() => handlePlayWordAudio(token.word)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-serif text-sm sm:text-base font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isCorrect
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                    : isSub
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50"
                    : isOmission
                    ? "bg-muted/40 text-muted-foreground/60 border border-dashed border-border line-through hover:text-muted-foreground"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                }`}
                title="点击试听该词标准原声"
              >
                <span>{token.word}</span>
                {isCorrect && (
                  <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0 opacity-80" />
                )}
                {isSub && (
                  <span className="text-[10px] font-mono px-1 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                    错
                  </span>
                )}
                {isInsertion && (
                  <span className="text-[10px] font-mono px-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                    多读
                  </span>
                )}
              </button>

              {/* 悬浮微型浮层 (Tooltip / Popover) */}
              {hoveredIndex === idx && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs shadow-xl font-mono whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <Volume2Icon className="size-3 text-emerald-400 dark:text-emerald-600 shrink-0" />
                  {isCorrect && <span>发音吻合 · 100%</span>}
                  {isSub && (
                    <span>
                      误读为: &ldquo;{token.actualWord || "未识别"}&rdquo;
                    </span>
                  )}
                  {isOmission && <span>吞音/漏读该词</span>}
                  {isInsertion && (
                    <span>多读语气词: &ldquo;{token.actualWord}&rdquo;</span>
                  )}
                  <span className="opacity-60 text-[10px]">[点击试听]</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 底部四态图例说明栏 (Legend) */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono px-2 text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>准确发音 (Match)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            <span>发音偏差 (Substitution)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            <span>漏读吞音 (Omission)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>多读杂音 (Insertion)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <HelpCircleIcon className="size-3.5" />
          <span>点击任意词块均可单独点听标准原声发音</span>
        </div>
      </div>
    </div>
  )
}

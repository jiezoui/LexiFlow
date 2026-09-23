"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Volume2Icon, ArrowRightIcon, SparklesIcon, VideoIcon } from "lucide-react"
import { wordbookApi } from "@/lib/api-client"

interface CuratedWord {
  lemma: string
  phonetic: string
  sentence: string
  translation: string
  bookTitle: string
  audioUrl?: string
}

export function DailyCuratedQuote() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [curatedWord, setCuratedWord] = useState<CuratedWord | null>(null)

  const fetchQuoteFromActiveBook = useCallback(async (): Promise<CuratedWord | null> => {
    try {
      const savedPrimaryId = localStorage.getItem("lexiflow_primary_wordbook_id")
      const bookId = savedPrimaryId ? Number(savedPrimaryId) : 1

      const [book, viewRes] = await Promise.all([
        wordbookApi.getDetail(bookId).catch(() => null),
        wordbookApi.getStudyView(bookId, { page: 1, size: 10 }).catch(() => null),
      ])

      const list = viewRes?.records || []
      const matched = list.find((w) => w.sampleSentence && w.sampleSentence.trim().length > 0)
      if (matched && book) {
        return {
          lemma: matched.lemma,
          phonetic: matched.phoneticUs || matched.phoneticUk || "",
          sentence: matched.sampleSentence!,
          translation: matched.sampleTranslation || "暂无翻译",
          bookTitle: book.title,
          audioUrl: matched.audioUs,
        }
      }
    } catch {}
    return null
  }, [])

  useEffect(() => {
    let cancelled = false
    const refreshQuote = () => {
      void fetchQuoteFromActiveBook().then((quote) => {
        if (!cancelled && quote) setCuratedWord(quote)
      })
    }

    refreshQuote()

    const handleUpdate = () => refreshQuote()
    window.addEventListener("lexiflow_wordbook_updated", handleUpdate)
    window.addEventListener("storage", handleUpdate)

    return () => {
      cancelled = true
      window.removeEventListener("lexiflow_wordbook_updated", handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [fetchQuoteFromActiveBook])

  if (!curatedWord) {
    return (
      <article className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pb-3 border-b border-border/60">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-foreground">
            <SparklesIcon className="size-3.5 text-zinc-500" /> 今日高光语境 · 原声切片
          </span>
          <span className="text-[11px] text-muted-foreground">暂无词汇切片</span>
        </div>
        <div className="py-6 text-center text-xs text-muted-foreground">
          主词书中暂无带语境例句的词汇。在词书库导入词书或在阅读中采词后，此处将自动呈现高质量原声例句切片。
        </div>
      </article>
    )
  }

  const handlePlay = () => {
    setIsPlaying(true)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(curatedWord.sentence)
      u.lang = "en-US"
      u.rate = 0.95
      u.onend = () => setIsPlaying(false)
      u.onerror = () => setIsPlaying(false)
      window.speechSynthesis.speak(u)
    } else {
      setTimeout(() => setIsPlaying(false), 1400)
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pb-4 border-b border-border">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-foreground">
          <SparklesIcon className="size-3.5 text-zinc-500" /> 今日高光语境 · 原声切片
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <VideoIcon className="size-3 text-zinc-500" /> 主词书 · {curatedWord.bookTitle} 精选切片
        </span>
      </div>

      <div className="mt-5">
        <blockquote className="text-base sm:text-xl font-medium tracking-tight text-foreground leading-relaxed">
          &ldquo;{curatedWord.sentence}&rdquo;
        </blockquote>

        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          {curatedWord.translation}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlay}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-mono font-medium text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Volume2Icon className={`size-3.5 ${isPlaying ? "animate-pulse text-zinc-900 dark:text-white" : ""}`} />
              朗读原声切片
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              重点词：<strong className="text-foreground">{curatedWord.lemma}</strong> {curatedWord.phonetic} ({curatedWord.bookTitle})
            </span>
          </div>

          <Link
            href="/videos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline hover:underline-offset-4"
          >
            在视频精听中回溯原句 <ArrowRightIcon className="size-3" />
          </Link>
        </div>
      </div>
    </article>
  )
}

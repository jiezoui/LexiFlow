"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowUpRightIcon, BookOpenIcon, SlidersHorizontalIcon, ArrowRightLeftIcon, PlusCircleIcon, Loader2Icon } from "lucide-react"
import { wordbookApi, type Wordbook } from "@/lib/api-client"

export function ActiveWordbookCard() {
  const [activeBook, setActiveBook] = useState<Wordbook | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActiveBook = async () => {
    try {
      setLoading(true)
      const savedPrimaryId = localStorage.getItem("lexiflow_primary_wordbook_id")
      let book: Wordbook | null = null

      if (savedPrimaryId) {
        try {
          book = await wordbookApi.getDetail(Number(savedPrimaryId))
        } catch {
          book = null
        }
      }

      // 若未设置或设定词书已被删除，自动对齐词书库中的第 1 本真实词书
      if (!book) {
        const list = await wordbookApi.list().catch(() => [])
        if (list && list.length > 0) {
          book = list[0]
          try {
            localStorage.setItem("lexiflow_primary_wordbook_id", String(book.id))
          } catch {}
        }
      }

      setActiveBook(book)
    } catch (err) {
      console.warn("加载主研习词书失败:", err)
      setActiveBook(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveBook()

    const handleWordbookUpdate = () => {
      fetchActiveBook()
    }
    const handleFocus = () => {
      fetchActiveBook()
    }

    window.addEventListener("lexiflow_wordbook_updated", handleWordbookUpdate)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("lexiflow_wordbook_updated", handleWordbookUpdate)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  if (loading && !activeBook) {
    return (
      <article className="flex flex-col justify-center items-center rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm min-h-[220px]">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        <span className="mt-2 text-xs text-muted-foreground font-mono">正在连接真实词库...</span>
      </article>
    )
  }

  // 无主研习词书时的空状态引导
  if (!activeBook) {
    return (
      <article className="flex flex-col justify-between rounded-3xl border border-dashed border-border bg-card/60 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col items-center justify-center py-5 text-center">
          <div className="p-3.5 rounded-2xl bg-muted/70 text-muted-foreground mb-3">
            <BookOpenIcon className="size-6 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-foreground">暂无进行中的主研习词书</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
            前往词书库选择一本考纲词书或导入专属词表，并将其设为「主研习词书」，即可在此实时跟踪掌握度
          </p>
          <Link
            href="/wordbooks"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            <PlusCircleIcon className="size-3.5" />
            <span>前往词书库选书或导入</span>
          </Link>
        </div>
      </article>
    )
  }

  const title = activeBook.title
  const progressPercent = activeBook.progressPercent ?? 0
  const learnedWords = activeBook.learnedWords ?? 0
  const totalWords = activeBook.totalWords ?? 0
  const masteredWords = activeBook.masteredWords ?? 0

  return (
    <article className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              当前主研习词书
            </span>
            <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpenIcon className="size-4 text-primary" />
              {title}
            </h3>
          </div>
          <Link
            href="/wordbooks"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            详情 <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </div>

        {/* Big Number & Progress */}
        <div className="mt-8 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold tracking-tighter text-foreground">
            {progressPercent}%
          </span>
          <span className="text-xs text-muted-foreground">标熟掌握度 · 建立长期记忆</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        {/* Stats line */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>
            已标熟 {masteredWords.toLocaleString()} / {totalWords.toLocaleString()} 词
          </span>
          <span className="font-sans text-[10px] text-muted-foreground font-medium">
            在学 {learnedWords} 词
          </span>
        </div>
      </div>

      {/* Quick Operations */}
      <div className="mt-8 flex items-center gap-3 border-t border-border pt-4 text-xs font-semibold">
        <Link
          href="/wordbooks"
          className="inline-flex items-center gap-1 text-foreground hover:underline hover:underline-offset-4 transition-all"
        >
          <ArrowRightLeftIcon className="size-3" />
          切换主词书
        </Link>
        <span className="text-muted-foreground/40">•</span>
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontalIcon className="size-3" />
          前往复习闪卡
        </Link>
      </div>
    </article>
  )
}


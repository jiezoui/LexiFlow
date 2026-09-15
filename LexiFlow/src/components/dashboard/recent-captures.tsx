"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRightIcon,
  VideoIcon,
  BookOpenIcon,
  BookmarkIcon,
  Volume2Icon,
  SparklesIcon,
} from "lucide-react"
import { mockContextCaptures } from "@/data/mock-lexiflow"

export function RecentCaptures() {
  const [playingId, setPlayingId] = useState<string | null>(null)

  const handlePlayAudio = (id: string) => {
    setPlayingId(id)
    setTimeout(() => setPlayingId(null), 1600)
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm">
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              最近语境快照 (Context Harvest)
            </h3>
            <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground font-semibold">
              {mockContextCaptures.length} 条新语料
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            你在真实视频与阅读中采摘的生词，与词书共用 FSRS 记忆间隔排期。
          </p>
        </div>
        <Link
          href="/reading"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          查看全部 <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {mockContextCaptures.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            暂无语境快照切片。在真实外刊阅读或视频精听中标记生词后，将自动在此生成语境记忆快照。
          </div>
        ) : (
          mockContextCaptures.map((item) => (
          <div
            key={item.id}
            className="group py-4.5 first:pt-4 last:pb-1 flex flex-col gap-2 transition-colors hover:bg-secondary/60 rounded-xl px-2.5 -mx-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Minimalist Monochrome Thumbnail */}
                <div className="size-10 shrink-0 rounded-xl border border-border bg-zinc-900 text-zinc-100 flex items-center justify-center">
                  {item.type === "VIDEO" ? (
                    <VideoIcon className="size-4" />
                  ) : item.type === "ARTICLE" ? (
                    <BookOpenIcon className="size-4" />
                  ) : (
                    <BookmarkIcon className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                      {item.title}
                    </h4>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[9px] font-bold tracking-wider text-foreground uppercase px-1.5 py-0.2 rounded bg-secondary border border-border">
                      {item.type}
                    </span>
                    <span>•</span>
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.timeAgo}</span>
                  </div>
                </div>
              </div>

              {/* Right Count & Audio Play */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handlePlayAudio(item.id)}
                  title="试听原生语境切片"
                  className="size-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-zinc-400 transition-all active:scale-95"
                >
                  <Volume2Icon
                    className={`size-3.5 ${playingId === item.id ? "text-foreground animate-pulse" : ""}`}
                  />
                </button>
                <span className="font-mono text-xs font-semibold text-foreground rounded-full bg-secondary border border-border px-2.5 py-0.5">
                  +{item.capturedCount} 词
                </span>
              </div>
            </div>

            {/* Context sentence preview */}
            <div className="ml-13 pl-0.5 text-xs text-muted-foreground leading-relaxed">
              <span className="font-mono text-[11px] text-foreground font-medium">
                &ldquo;{item.sentence}&rdquo;
              </span>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <SparklesIcon className="size-3 text-zinc-400" />
                <span>采自重点词：<strong className="text-foreground font-mono">{item.sampleWord}</strong></span>
              </div>
            </div>
          </div>
        )))}
      </div>
    </article>
  )
}

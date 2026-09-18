"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  SparklesIcon,
  PlusIcon,
  ClockIcon,
  ChevronRightIcon,
  Loader2Icon,
  ArrowLeftIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { contextStoryApi, type ContextStory } from "@/lib/api-client"
import { ContextStoryGeneratorModal } from "@/components/reading/context-story-generator-modal"

export default function ContextStoryListPage() {
  const router = useRouter()
  const [stories, setStories] = useState<ContextStory[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [total, setTotal] = useState<number>(0)
  const [generatorOpen, setGeneratorOpen] = useState<boolean>(false)

  const loadStories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await contextStoryApi.list({ page: 1, size: 20 })
      setStories(res.records || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error("加载语境故事列表失败:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      {/* 顶部 Header & 操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/reading"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeftIcon className="size-3" /> 阅读库
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-medium text-foreground">语境短文</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            语境文章
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            根据复习生词生成定制短文，在语境中进行双语研读与记忆激活。
          </p>
        </div>

        <Button
          onClick={() => setGeneratorOpen(true)}
          className="gap-2 text-xs font-medium h-9 px-4 rounded-xl"
        >
          <SparklesIcon className="size-3.5" />
          生成语境文章
        </Button>
      </div>

      {/* 文章列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground font-mono">
            历史文章 ({total})
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 min-h-[25vh] gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            <p className="text-xs">加载中...</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
            <p className="text-xs text-muted-foreground">暂无语境文章，点击下方按钮开始生成。</p>
            <Button
              onClick={() => setGeneratorOpen(true)}
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5 rounded-lg text-xs"
            >
              <PlusIcon className="size-3.5" /> 生成第一篇文章
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stories.map((st) => (
              <div
                key={st.publicId}
                onClick={() => router.push(`/reading/story/${st.publicId}`)}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-primary/40 hover:bg-secondary/20 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold bg-primary/10 text-primary">
                      {st.targetLevel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {st.topic}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {st.title}
                  </h4>

                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <span>{st.wordCount} 词</span>
                    <span>·</span>
                    <span>{st.targetWordsCount} 个目标生词</span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {st.createdAt ? new Date(st.createdAt).toLocaleDateString() : "刚刚"}
                  </span>
                  <span className="flex items-center gap-0.5 text-primary text-xs font-medium group-hover:translate-x-0.5 transition-transform">
                    阅读 <ChevronRightIcon className="size-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 生成弹窗 */}
      <ContextStoryGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onSuccess={(story) => {
          setGeneratorOpen(false)
          router.push(`/reading/story/${story.publicId}`)
        }}
      />
    </div>
  )
}

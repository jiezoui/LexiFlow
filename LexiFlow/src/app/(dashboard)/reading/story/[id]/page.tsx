"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { contextStoryApi, type ContextStoryDetail } from "@/lib/api-client"
import { ContextStoryReader } from "@/components/reading/context-story-reader"
import { Loader2Icon, AlertCircleIcon, ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [story, setStory] = useState<ContextStoryDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
      setLoading(true)
    contextStoryApi
      .getDetail(id)
      .then((res) => {
        setStory(res)
        setError(null)
      })
      .catch((err) => {
        console.error("加载语境文章失败:", err)
        setError(err instanceof Error ? err.message : "文章不存在或加载失败")
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 min-h-[50vh] gap-3 text-muted-foreground">
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <p className="text-xs font-medium">正在加载语境文章与目标生词卡片...</p>
      </div>
    )
  }

  if (error || !story) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 min-h-[50vh] gap-4 text-center max-w-md mx-auto">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircleIcon className="size-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">无法加载文章</h3>
          <p className="text-xs text-muted-foreground mt-1">{error || "文章未找到"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/reading")} className="gap-2">
          <ArrowLeftIcon className="size-4" /> 返回外刊与故事阅读
        </Button>
      </div>
    )
  }

  return <ContextStoryReader story={story} onBack={() => router.push("/reading")} />
}

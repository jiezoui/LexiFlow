"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircleIcon, ArrowLeftIcon, LoaderCircleIcon } from "lucide-react"
import { podcastApi } from "@/lib/api-client"
import { MediaStudyWorkspace } from "@/components/video/media-study-workspace"
import { useBreadcrumbTitle } from "@/components/breadcrumb-title-context"

export function PodcastStudyEntry({ episodeId }: { episodeId: string }) {
  const [mediaId, setMediaId] = useState<string | null>(null)
  const [episodeTitle, setEpisodeTitle] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  useBreadcrumbTitle(episodeTitle)

  const openEpisode = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const episode = await podcastApi.getEpisode(episodeId)
      setEpisodeTitle(episode.title)
      if (episode.mediaId) {
        setMediaId(episode.mediaId)
      } else {
        const media = await podcastApi.prepare(episodeId)
        setMediaId(media.id)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "无法创建这期播客的精听任务。")
    } finally {
      setIsLoading(false)
    }
  }, [episodeId])

  useEffect(() => { void openEpisode() }, [openEpisode])

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <LoaderCircleIcon className="size-7 animate-spin text-primary" />
        <div>
          <h1 className="text-sm font-bold text-foreground">正在打开播客精听</h1>
          <p className="mt-1 text-xs text-muted-foreground">首次打开会创建音频转写任务。</p>
        </div>
      </div>
    )
  }

  if (errorMessage || !mediaId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <AlertCircleIcon className="size-7 text-destructive" />
        <h1 className="mt-3 text-base font-bold text-foreground">无法打开这期播客</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage || "没有找到对应的播客单集。"}</p>
        <div className="mt-5 flex items-center gap-2">
          <Link href="/podcasts" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-muted">
            <ArrowLeftIcon className="size-3.5" />返回播客库
          </Link>
          <button type="button" onClick={() => void openEpisode()} className="min-h-10 rounded-xl bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90">重新尝试</button>
        </div>
      </div>
    )
  }

  return <MediaStudyWorkspace mediaId={mediaId} mode="podcast" />
}

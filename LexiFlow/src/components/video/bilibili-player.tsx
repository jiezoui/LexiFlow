"use client"

import { forwardRef, useImperativeHandle, useState } from "react"
import type { MediaPlayerHandle } from "@/components/video/media-player"

interface BilibiliPlayerProps {
  bvid: string
  page: number
  title: string
  onReady: () => void
}

export const BilibiliPlayer = forwardRef<MediaPlayerHandle, BilibiliPlayerProps>(
  function BilibiliPlayer({ bvid, page, title, onReady }, ref) {
    const [start, setStart] = useState(0)
    const [autoplay, setAutoplay] = useState(false)
    const [seekNonce, setSeekNonce] = useState(0)
    useImperativeHandle(ref, () => ({
      seekTo: (seconds, shouldPlay = true) => {
        setStart(Math.max(0, Math.floor(seconds)))
        setAutoplay(shouldPlay)
        setSeekNonce((value) => value + 1)
      },
    }), [])
    const src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&p=${page}&t=${start}&autoplay=${autoplay ? 1 : 0}&danmaku=0`
    return (
      <div className="w-full max-w-5xl">
        <iframe
          key={`${src}:${seekNonce}`}
          src={src}
          title={`${title} 视频播放器`}
          className="aspect-video w-full rounded-xl bg-zinc-950"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={onReady}
        />
        <a
          href={`https://www.bilibili.com/video/${encodeURIComponent(bvid)}${page > 1 ? `?p=${page}` : ""}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-right text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          播放受限时打开原视频
        </a>
      </div>
    )
  },
)

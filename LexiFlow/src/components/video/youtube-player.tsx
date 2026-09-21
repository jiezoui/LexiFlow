"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { MediaCue } from "@/lib/api-client"
import type { MediaPlayerHandle } from "@/components/video/media-player"

interface YouTubePlayerProps {
  videoId: string
  title: string
  activeCue: MediaCue | null
  onPlaybackTime: (seconds: number) => void
  onError: (message: string) => void
  onReady: () => void
}

interface YouTubePlayerInstance {
  destroy: () => void
  playVideo: () => void
  pauseVideo?: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
}

interface YouTubePlayerEvent {
  target: YouTubePlayerInstance
  data: number
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      host?: string
      playerVars: Record<string, string | number>
      events: {
        onReady: (event: YouTubePlayerEvent) => void
        onStateChange: (event: YouTubePlayerEvent) => void
        onError: (event: YouTubePlayerEvent) => void
      }
    }
  ) => YouTubePlayerInstance
  ready?: (fn: () => void) => void
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeApi(timeoutMs = 4000): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR not supported"))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    let timeoutTimer: number | null = null

    const cleanup = () => {
      if (timeoutTimer !== null) {
        window.clearTimeout(timeoutTimer)
        timeoutTimer = null
      }
    }

    const checkReady = () => {
      if (window.YT?.Player) {
        cleanup()
        resolve(window.YT)
        return true
      }
      return false
    }

    if (checkReady()) return

    if (window.YT?.ready) {
      window.YT.ready(() => {
        if (checkReady()) return
      })
    }

    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      checkReady()
    }

    const pollTimer = window.setInterval(() => {
      if (checkReady()) {
        window.clearInterval(pollTimer)
      }
    }, 150)

    timeoutTimer = window.setTimeout(() => {
      window.clearInterval(pollTimer)
      cleanup()
      apiPromise = null
      reject(new Error("YouTube 播放器脚本加载超时"))
    }, timeoutMs)

    const existing = document.querySelector<HTMLScriptElement>('script[src*="youtube.com/iframe_api"]')
    if (existing) {
      existing.addEventListener("error", () => {
        window.clearInterval(pollTimer)
        cleanup()
        apiPromise = null
        reject(new Error("YouTube 播放器脚本加载失败"))
      }, { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      window.clearInterval(pollTimer)
      cleanup()
      apiPromise = null
      reject(new Error("YouTube 播放器脚本加载失败"))
    }
    document.head.appendChild(script)
  }).catch((err) => {
    apiPromise = null
    throw err
  })

  return apiPromise
}

function playerErrorMessage(code: number) {
  if (code === 101 || code === 150) return "视频作者不允许在站外播放，请前往 YouTube 观看。"
  if (code === 100) return "这个 YouTube 视频不存在或已被设为私密。"
  if (code === 2) return "YouTube 视频编号无效。"
  return "YouTube 播放器暂时无法加载，请检查网络后重试。"
}

export const YouTubePlayer = forwardRef<MediaPlayerHandle, YouTubePlayerProps>(function YouTubePlayer({
  videoId,
  title,
  activeCue,
  onPlaybackTime,
  onError,
  onReady,
}, forwardedRef) {
  const mountRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const clockRef = useRef<number | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // Imperative handle: supports both standard YT.Player and fallback iframe via postMessage
  useImperativeHandle(forwardedRef, () => ({
    seekTo: (seconds, autoplay = true) => {
      const targetSeconds = Math.max(0, seconds)
      if (useFallback) {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [targetSeconds, true],
            }),
            "*"
          )
          if (autoplay) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                event: "command",
                func: "playVideo",
                args: [],
              }),
              "*"
            )
          }
        }
        onPlaybackTime(targetSeconds)
        return
      }

      const player = playerRef.current
      if (player && typeof player.seekTo === "function") {
        try {
          player.seekTo(targetSeconds, true)
          onPlaybackTime(targetSeconds)
          if (autoplay && typeof player.playVideo === "function") {
            player.playVideo()
          }
        } catch (err) {
          console.warn("[YouTubePlayer] seekTo error:", err)
        }
      }
    },
    pause: () => {
      if (useFallback) {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "pauseVideo",
              args: [],
            }),
            "*"
          )
        }
        return
      }

      if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
        try {
          playerRef.current.pauseVideo()
        } catch (err) {
          console.warn("[YouTubePlayer] pauseVideo error:", err)
        }
      }
    },
  }), [useFallback, onPlaybackTime])

  // Fallback iframe message listener (for receiving playback time from iframe enablejsapi)
  useEffect(() => {
    if (!useFallback) return

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (!data) return
        if (data.event === "infoDelivery" && typeof data.info?.currentTime === "number") {
          onPlaybackTime(data.info.currentTime)
        } else if (data.event === "onReady" || data.event === "initialDelivery") {
          onReady()
        }
      } catch {
        // Not a JSON message from YouTube iframe
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [useFallback, onPlaybackTime, onReady])

  // Main effect: attempt to initialize standard YT.Player, fallback to direct iframe on failure
  useEffect(() => {
    let disposed = false

    const stopClock = () => {
      if (clockRef.current !== null) {
        window.clearInterval(clockRef.current)
        clockRef.current = null
      }
    }
    const startClock = () => {
      stopClock()
      clockRef.current = window.setInterval(() => {
        const seconds = playerRef.current?.getCurrentTime()
        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          onPlaybackTime(seconds)
        }
      }, 100)
    }

    loadYouTubeApi(3500)
      .then((YT) => {
        if (disposed || !mountRef.current) return
        playerRef.current = new YT.Player(mountRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target
              onReady()
              onPlaybackTime(event.target.getCurrentTime())
            },
            onStateChange: (event) => {
              if (event.data === 1) startClock()
              else stopClock()
              onPlaybackTime(event.target.getCurrentTime())
            },
            onError: (event) => {
              stopClock()
              onError(playerErrorMessage(event.data))
            },
          },
        })
      })
      .catch((error: unknown) => {
        if (disposed) return
        console.warn("[YouTubePlayer] YouTube API failed to load, falling back to direct iframe:", error)
        // Switch to direct iframe fallback without showing fatal error dialog
        setUseFallback(true)
        onReady()
      })

    return () => {
      disposed = true
      stopClock()
      try {
        playerRef.current?.destroy()
      } catch {}
      playerRef.current = null
    }
  }, [onError, onPlaybackTime, onReady, videoId, retryNonce])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const fallbackSrc = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1&rel=0`

  return (
    <div
      className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-zinc-950 shadow-xl shadow-zinc-950/20"
      aria-label={`${title} YouTube 播放器`}
    >
      {useFallback ? (
        <iframe
          ref={iframeRef}
          src={fallbackSrc}
          title={`${title} 播放器`}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => {
            onReady()
            try {
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*")
            } catch {}
          }}
        />
      ) : (
        <div ref={mountRef} className="size-full" />
      )}

      {useFallback && (
        <div className="pointer-events-auto absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400 backdrop-blur-xs transition hover:text-zinc-200">
          <span>直连播放模式</span>
          <button
            type="button"
            onClick={() => {
              setUseFallback(false)
              setRetryNonce((v) => v + 1)
            }}
            className="ml-1 text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
          >
            重试API
          </button>
        </div>
      )}

      {activeCue && (
        <div className="pointer-events-none absolute inset-x-8 bottom-16 text-center text-zinc-50 [text-shadow:0_2px_7px_rgba(0,0,0,.98),0_0_2px_rgba(0,0,0,.95)]">
          <p className="text-sm font-semibold leading-6 sm:text-base">{activeCue.sourceText}</p>
          {activeCue.translation && (
            <p className="mt-0.5 text-xs font-medium leading-5 sm:text-sm">{activeCue.translation}</p>
          )}
        </div>
      )}
    </div>
  )
})

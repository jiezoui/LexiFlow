"use client"

/**
 * YouTube 内嵌播放器
 *
 * 用途：播放以 `playback.type === "YOUTUBE_IFRAME"` 导入的外部视频。
 * 通过官方 IFrame Player API（`window.YT`）获得与本地 `<video>` 等价的控制能力，
 * 并对外暴露与 `MediaPlayer` 相同的 `MediaPlayerHandle` 接口，
 * 使 `MediaStudyWorkspace` 可以用同一个 ref 驱动字幕跟随与定位。
 *
 * 关键点
 * ------
 * 1. **单例脚本加载**：IFrame API 脚本全页只能加载一次，用模块级 Promise 缓存，
 *    避免每条视频都插一遍 `<script>`。
 * 2. **时间上报**：`requestAnimationFrame` 轮询 `getCurrentTime()`，把秒级播放
 *    进度回调给上层，用于字幕高亮。比 `setInterval` 更贴合刷新节奏。
 * 3. **销毁安全**：卸载时取消 rAF 并 `destroy()` 播放器，防止切换视频后旧实例
 *    继续上报时间造成字幕跳动。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { LoaderCircleIcon, VideoIcon } from "lucide-react"
import type { MediaCue } from "@/lib/api-client"
import type { MediaPlayerHandle } from "@/components/video/media-player"

/* ── IFrame API 最小类型声明（只声明用到的部分） ────────────────────────── */

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  destroy: () => void
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YTPlayer }) => void
        onError?: (event: { data: number }) => void
        onStateChange?: (event: { data: number }) => void
      }
    }
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** 幂等地加载 YouTube IFrame API。 */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API 仅可在浏览器中加载"))
  }
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error("YouTube IFrame API 加载完成但命名空间缺失"))
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-lexiflow-youtube-api="1"]'
    )
    if (!existing) {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      script.dataset.lexiflowYoutubeApi = "1"
      script.onerror = () => reject(new Error("YouTube IFrame API 脚本加载失败"))
      document.head.appendChild(script)
    }

    // 网络受限时给出明确失败，而不是无限等待
    window.setTimeout(() => {
      if (!window.YT?.Player) reject(new Error("YouTube IFrame API 加载超时"))
    }, 15_000)
  })

  // 失败后允许下次重试
  apiPromise.catch(() => {
    apiPromise = null
  })
  return apiPromise
}

/** 把 YouTube 的错误码转成可读提示。 */
const YT_ERRORS: Record<number, string> = {
  2: "视频 ID 无效",
  5: "HTML5 播放器无法播放该视频",
  100: "视频不存在、已删除或设为私享",
  101: "视频所有者不允许内嵌播放",
  150: "视频所有者不允许内嵌播放",
}

interface YouTubePlayerProps {
  videoId: string
  title: string
  activeCue?: MediaCue | null
  onPlaybackTime?: (seconds: number) => void
  onReady?: () => void
  onError?: (message: string) => void
}

export const YouTubePlayer = forwardRef<MediaPlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, title, activeCue, onPlaybackTime, onReady, onError },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const rafRef = useRef<number | null>(null)
    const readyRef = useRef(false)

    // 用 ref 持有回调，避免父组件每次重渲染都重建播放器
    const callbacksRef = useRef({ onPlaybackTime, onReady, onError })
    useEffect(() => {
      callbacksRef.current = { onPlaybackTime, onReady, onError }
    }, [onPlaybackTime, onReady, onError])

    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [errorText, setErrorText] = useState<string>("")

    const stopPolling = useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }, [])

    // 创建播放器
    useEffect(() => {
      let disposed = false
      const host = hostRef.current
      if (!host) return

      setStatus("loading")
      setErrorText("")

      void (async () => {
        try {
          const YT = await loadYouTubeApi()
          if (disposed || !hostRef.current) return

          // 播放器需要一个真实存在的子节点作为挂载点
          host.innerHTML = ""
          const mount = document.createElement("div")
          mount.style.width = "100%"
          mount.style.height = "100%"
          host.appendChild(mount)

          const player = new YT.Player(mount, {
            videoId,
            playerVars: {
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              // 需要 IFrame API 才能用 seekTo 精确定位字幕
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (disposed) return
                playerRef.current = event.target
                readyRef.current = true
                setStatus("ready")
                callbacksRef.current.onReady?.()

                // 轮询播放进度驱动字幕高亮
                const tick = () => {
                  if (disposed) return
                  const target = playerRef.current
                  if (target) {
                    try {
                      callbacksRef.current.onPlaybackTime?.(target.getCurrentTime())
                    } catch {
                      /* 播放器销毁瞬间可能抛错，忽略 */
                    }
                  }
                  rafRef.current = requestAnimationFrame(tick)
                }
                stopPolling()
                rafRef.current = requestAnimationFrame(tick)
              },
              onError: (event) => {
                if (disposed) return
                const message = YT_ERRORS[event.data] || `YouTube 播放错误 (${event.data})`
                setStatus("error")
                setErrorText(message)
                callbacksRef.current.onError?.(message)
              },
            },
          })

          // 在 onReady 之前就持有实例，保证 ref 方法可用
          playerRef.current = player
        } catch (err: unknown) {
          if (disposed) return
          const message = err instanceof Error ? err.message : "YouTube 播放器初始化失败"
          setStatus("error")
          setErrorText(message)
          callbacksRef.current.onError?.(message)
        }
      })()

      return () => {
        disposed = true
        readyRef.current = false
        stopPolling()
        try {
          playerRef.current?.destroy()
        } catch {
          /* 已销毁 */
        }
        playerRef.current = null
      }
    }, [videoId, stopPolling])

    // 对外暴露与本地播放器一致的接口
    useImperativeHandle(
      ref,
      (): MediaPlayerHandle => ({
        seekTo: (seconds: number, autoplay = false) => {
          const player = playerRef.current
          if (!player) return
          try {
            player.seekTo(seconds, true)
            if (autoplay) player.playVideo()
          } catch {
            /* 播放器尚未就绪 */
          }
        },
        play: () => {
          try {
            playerRef.current?.playVideo()
          } catch {
            /* 播放器尚未就绪 */
          }
        },
        pause: () => {
          try {
            playerRef.current?.pauseVideo()
          } catch {
            /* 播放器尚未就绪 */
          }
        },
      }),
      []
    )

    return (
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-zinc-950">
        <div ref={hostRef} className="h-full w-full" title={title} />

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <LoaderCircleIcon className="size-7 animate-spin" />
            <p className="text-xs">正在连接 YouTube 播放器…</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-zinc-300">
            <VideoIcon className="size-8 text-zinc-500" />
            <p className="text-sm font-semibold">无法内嵌播放该视频</p>
            <p className="max-w-md text-xs text-zinc-500">{errorText}</p>
          </div>
        )}

        {activeCue && status === "ready" && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-black/70 px-3 py-2 text-center text-sm text-white backdrop-blur-sm">
            {activeCue.sourceText}
          </div>
        )}
      </div>
    )
  }
)

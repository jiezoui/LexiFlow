"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { CaptionsIcon, LocateFixedIcon } from "lucide-react"
import type { MediaCue } from "@/lib/api-client"

interface TranscriptRailProps {
  cues: MediaCue[]
  activeIndex: number
  onCueSelect: (cue: MediaCue) => void
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

export function TranscriptRail({ cues, activeIndex, onCueSelect }: TranscriptRailProps) {
  const [manualMode, setManualMode] = useState(false)
  const [topFadeVisible, setTopFadeVisible] = useState(false)
  const [bottomFadeVisible, setBottomFadeVisible] = useState(true)
  const [tailSpace, setTailSpace] = useState(180)

  const viewportRef = useRef<HTMLDivElement>(null)
  const cueRefs = useRef<Array<HTMLButtonElement | null>>([])
  const followStartedRef = useRef(false)
  const manualModeRef = useRef(false)
  const targetScrollRef = useRef(0)
  const velocityRef = useRef(0)
  const animationRef = useRef<number | null>(null)
  const previousFrameRef = useRef<number | null>(null)
  const activeIndexRef = useRef(activeIndex)

  const updateFades = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setTopFadeVisible(viewport.scrollTop > 12)
    setBottomFadeVisible(viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 12)
  }, [])

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    previousFrameRef.current = null
  }, [])

  const animateToTarget = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || animationRef.current !== null) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewport.scrollTop = targetScrollRef.current
      velocityRef.current = 0
      updateFades()
      return
    }

    const step = (time: number) => {
      const currentViewport = viewportRef.current
      if (!currentViewport || manualModeRef.current) {
        animationRef.current = null
        previousFrameRef.current = null
        return
      }

      const previousTime = previousFrameRef.current ?? time
      const deltaTime = Math.min(0.032, Math.max(0.001, (time - previousTime) / 1000))
      previousFrameRef.current = time

      const current = currentViewport.scrollTop
      const distance = targetScrollRef.current - current
      const acceleration = distance * 230 - velocityRef.current * 30
      velocityRef.current += acceleration * deltaTime
      const next = current + velocityRef.current * deltaTime
      currentViewport.scrollTop = next

      if (Math.abs(distance) < 0.35 && Math.abs(velocityRef.current) < 2) {
        currentViewport.scrollTop = targetScrollRef.current
        velocityRef.current = 0
        animationRef.current = null
        previousFrameRef.current = null
        updateFades()
        return
      }

      animationRef.current = window.requestAnimationFrame(step)
    }

    animationRef.current = window.requestAnimationFrame(step)
  }, [updateFades])

  const setFollowTarget = useCallback((index: number, force = false) => {
    const viewport = viewportRef.current
    const cue = cueRefs.current[index]
    if (!viewport || !cue || index < 0) return

    const viewportRect = viewport.getBoundingClientRect()
    const cueRect = cue.getBoundingClientRect()
    const cueCenter = cueRect.top - viewportRect.top + viewport.scrollTop + cueRect.height / 2
    const viewportCenter = viewport.clientHeight / 2
    const visibleCueCenter = cueCenter - viewport.scrollTop

    if (!followStartedRef.current) {
      if (!force && visibleCueCenter < viewportCenter) return
      followStartedRef.current = true
    }
    if (manualModeRef.current && !force) return

    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    targetScrollRef.current = Math.max(0, Math.min(maxScroll, cueCenter - viewportCenter))
    animateToTarget()
  }, [animateToTarget])

  const enterManualMode = useCallback(() => {
    manualModeRef.current = true
    setManualMode(true)
    velocityRef.current = 0
    stopAnimation()
  }, [stopAnimation])

  const resumeFollowing = useCallback(() => {
    manualModeRef.current = false
    setManualMode(false)
    followStartedRef.current = true
    setFollowTarget(activeIndex, true)
  }, [activeIndex, setFollowTarget])

  useLayoutEffect(() => {
    cueRefs.current.length = cues.length
    followStartedRef.current = false
    targetScrollRef.current = 0
    velocityRef.current = 0
    viewportRef.current?.scrollTo({ top: 0 })
  }, [cues])

  useEffect(() => {
    activeIndexRef.current = activeIndex
    setFollowTarget(activeIndex)
  }, [activeIndex, setFollowTarget])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver(() => {
      setTailSpace(Math.max(96, viewport.clientHeight / 2))
      if (followStartedRef.current && !manualModeRef.current) setFollowTarget(activeIndexRef.current, true)
      updateFades()
    })
    observer.observe(viewport)
    setTailSpace(Math.max(96, viewport.clientHeight / 2))
    updateFades()

    return () => {
      observer.disconnect()
      stopAnimation()
    }
  }, [setFollowTarget, stopAnimation, updateFades])

  return (
    <aside className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-background" aria-label="双语字幕栏">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <CaptionsIcon className="size-4" />
          <span className="text-sm font-bold">双语字幕</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{cues.length} 句</span>
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 [scrollbar-gutter:stable]"
        onScroll={updateFades}
        onWheelCapture={(event) => {
          event.stopPropagation()
          enterManualMode()
        }}
        onTouchStart={enterManualMode}
      >
        {cues.length ? (
          <div className="flex flex-col gap-1.5">
            {cues.map((cue, index) => (
              <button
                ref={(element) => { cueRefs.current[index] = element }}
                key={cue.id}
                type="button"
                data-cue-index={index}
                onClick={() => {
                  manualModeRef.current = false
                  setManualMode(false)
                  followStartedRef.current = true
                  onCueSelect(cue)
                  setFollowTarget(index, true)
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${index === activeIndex ? "bg-muted/80 text-foreground" : "text-muted-foreground hover:bg-muted/45 hover:text-foreground"}`}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={`${formatTime(cue.startMs / 1000)}，${cue.sourceText}`}
              >
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{formatTime(cue.startMs / 1000)}</span>
                <p className={`mt-1 text-sm leading-5 ${index === activeIndex ? "font-semibold" : "font-medium"}`}>{cue.sourceText}</p>
                {cue.translation && <p className="mt-1 text-xs leading-5 text-muted-foreground">{cue.translation}</p>}
              </button>
            ))}
            <div aria-hidden="true" style={{ height: tailSpace }} />
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <CaptionsIcon className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">字幕仍在处理中</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">视频可以先播放；识别完成后，这里会自动出现字幕。</p>
          </div>
        )}
      </div>

      <div className={`pointer-events-none absolute inset-x-0 top-14 h-12 bg-gradient-to-b from-background via-background/85 to-transparent transition-opacity duration-200 ${topFadeVisible ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-200 ${bottomFadeVisible ? "opacity-100" : "opacity-0"}`} />

      {manualMode && cues.length > 0 && (
        <button
          type="button"
          onClick={resumeFollowing}
          className="absolute bottom-4 left-1/2 z-10 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-md transition duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
        >
          <LocateFixedIcon className="size-3.5" />
          回到当前字幕
        </button>
      )}
    </aside>
  )
}

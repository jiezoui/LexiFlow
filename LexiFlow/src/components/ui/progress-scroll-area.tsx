"use client"

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from "react"
import { cn } from "@/lib/utils"

export interface ProgressScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  /** 自定义外层容器样式 */
  className?: string
  /** 自定义内部滚动视口样式 */
  viewportClassName?: string
  /** 滚动视口 Ref，支持 RefObject 或 Callback Ref（如用于 Portal 宿主） */
  viewportRef?: React.Ref<HTMLDivElement>
  /** 进度条高度，默认 h-0.5 (2px) */
  lineHeight?: string
  /** 进度条高亮颜色，默认 bg-primary */
  progressClassName?: string
  /** 进度条底槽颜色，默认 bg-border/40 */
  trackClassName?: string
  /** 是否显示底槽，默认 true */
  showTrack?: boolean
  /** 进度条位置：顶部 'top' 或 底部 'bottom'，默认 'top' */
  position?: "top" | "bottom"
  /** 内容滚动回调 */
  onScroll?: React.UIEventHandler<HTMLDivElement>
  /** 滚动视口无障碍属性 */
  role?: string
  "aria-label"?: string
}

/**
 * 极简进度线滚动区域组件 (ProgressScrollArea)
 *
 * 特性：
 * 1. 彻底隐藏系统原生粗灰滚动条与箭头（Windows / macOS / Linux 均一致纯净）。
 * 2. 在容器边缘（默认顶部）提供一条 2px 极细微光进度线，随内容滚动从 0% 平滑延伸至 100%。
 * 3. 不显示任何百分比数字或文字干扰，保持极致纯粹。
 * 4. 内置 ResizeObserver 与 MutationObserver，自动兼容动态加载、异步内容与 React Portal 挂载。
 */
export const ProgressScrollArea = forwardRef<HTMLDivElement, ProgressScrollAreaProps>(
  (
    {
      children,
      className,
      viewportClassName,
      viewportRef,
      lineHeight = "h-0.5",
      progressClassName = "bg-primary",
      trackClassName = "bg-border/40",
      showTrack = true,
      position = "top",
      onScroll,
      role,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const internalViewportRef = useRef<HTMLDivElement | null>(null)
    const [progress, setProgress] = useState(0)
    const [isScrollable, setIsScrollable] = useState(false)

    // 合并外部传递的 viewportRef 与组件内部的 internalViewportRef
    const setCombinedViewportRef = useCallback(
      (node: HTMLDivElement | null) => {
        internalViewportRef.current = node
        if (!viewportRef) return
        if (typeof viewportRef === "function") {
          viewportRef(node)
        } else if (viewportRef && "current" in viewportRef) {
          // eslint-disable-next-line react-hooks/immutability
          ;(viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }
      },
      [viewportRef]
    )

    // 计算滚动进度
    const updateProgress = useCallback(() => {
      const el = internalViewportRef.current
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll > 1) {
        setIsScrollable(true)
        const pct = Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100))
        setProgress(pct)
      } else {
        setIsScrollable(false)
        setProgress(0)
      }
    }, [])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      updateProgress()
      onScroll?.(e)
    }

    // 监听视口大小变化以及子节点增删（针对 Portal 挂载或异步内容填充）
    useEffect(() => {
      const el = internalViewportRef.current
      if (!el) return

      updateProgress()

      const ro = new ResizeObserver(() => {
        updateProgress()
      })
      ro.observe(el)

      const mo = new MutationObserver(() => {
        updateProgress()
      })
      mo.observe(el, { childList: true, subtree: true })

      return () => {
        ro.disconnect()
        mo.disconnect()
      }
    }, [updateProgress])

    const progressLineNode = (
      <div
        data-slot="scroll-progress-track"
        className={cn(
          "relative w-full shrink-0 overflow-hidden transition-opacity duration-200",
          lineHeight,
          showTrack ? trackClassName : "bg-transparent",
          isScrollable ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          data-slot="scroll-progress-bar"
          className={cn(
            "h-full transition-[width] duration-75 ease-out",
            progressClassName
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    )

    return (
      <div
        ref={ref}
        className={cn("relative flex min-h-0 flex-col overflow-hidden", className)}
        {...props}
      >
        {/* 注入确保跨浏览器 100% 隐藏原生滚动条的独立样式 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .progress-scroll-viewport {
                -ms-overflow-style: none !important;
                scrollbar-width: none !important;
              }
              .progress-scroll-viewport::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
              }
            `,
          }}
        />

        {/* 顶部进度线 */}
        {position === "top" && progressLineNode}

        {/* 滚动视口 */}
        <div
          ref={setCombinedViewportRef}
          role={role}
          aria-label={ariaLabel}
          onScroll={handleScroll}
          className={cn(
            "progress-scroll-viewport min-h-0 flex-1 overflow-y-auto overscroll-contain",
            viewportClassName
          )}
        >
          {children}
        </div>

        {/* 底部进度线 */}
        {position === "bottom" && progressLineNode}
      </div>
    )
  }
)

ProgressScrollArea.displayName = "ProgressScrollArea"

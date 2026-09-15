"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { WordbookStudyWorkspace } from "./wordbook-study-workspace"

interface WordbookStudyDrawerProps {
  bookId: number | null
  isOpen: boolean
  onClose: () => void
}

const emptySubscribe = () => () => {}

export function WordbookStudyDrawer({
  bookId,
  isOpen,
  onClose,
}: WordbookStudyDrawerProps) {
  // 1. 确保仅在客户端 DOM 树挂载后渲染 Portal (React 19 推荐无级联渲染方案)
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  // 2. 监听 Esc 键快速关闭浮层
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // 3. 锁定背景页面滚动 (防止滚动穿透与右移跳动)
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight

    // 计算系统原生滚动条宽度
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  if (!isClient || !isOpen || bookId === null) return null

  // 4. 使用 React createPortal 将浮层挂载至顶层 document.body
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200"
    >
      {/* 遮罩背景 (Backdrop Mask) - 点击关闭 */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-label="点击关闭浮层"
      />

      {/* 抽屉主面板 (Slide-over Drawer Container) */}
      <div
        className="relative z-10 w-full max-w-5xl h-full bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out"
        onClick={(e) => e.stopPropagation()} // 阻止内部点击冒泡导致遮罩触发关闭
      >
        <WordbookStudyWorkspace
          bookId={bookId}
          onClose={onClose}
          isDrawer={true}
        />
      </div>
    </div>,
    document.body
  )
}

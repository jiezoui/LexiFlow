"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  SlidersIcon,
  SparklesIcon,
  ActivityIcon,
  EyeOffIcon,
  CheckIcon,
  FlameIcon,
} from "lucide-react"

export default function ScrollbarDemoPage() {
  // 选项 2 的滚动状态（用于底部渐变淡出遮罩）
  const [maskHasMore, setMaskHasMore] = useState(true)

  // 选项 3 的滚动进度（用于顶部 2px 极细进度条）
  const [progressPercent, setProgressPercent] = useState(0)

  const handleMaskScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    setMaskHasMore(scrollHeight - scrollTop - clientHeight > 15)
  }

  const handleProgressScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const maxScroll = scrollHeight - clientHeight
    if (maxScroll > 0) {
      setProgressPercent(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)))
    }
  }

  const dummyReportContent = (
    <div className="space-y-4 p-4 text-xs">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-semibold text-emerald-800 dark:text-emerald-300">
        已记入练习历史与今日打卡 · 综合得分 82 分
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <ActivityIcon className="size-3.5 text-primary" />
            节奏分析
          </div>
          <div className="mt-2.5 space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>录音时长</span>
              <span className="font-mono font-semibold text-foreground">2.1s</span>
            </div>
            <div className="flex justify-between">
              <span>净语音时长</span>
              <span className="font-mono font-semibold text-foreground">2.01s</span>
            </div>
            <div className="flex justify-between">
              <span>语速</span>
              <span className="font-mono font-semibold text-foreground">135 WPM</span>
            </div>
            <div className="flex justify-between">
              <span>停顿次数</span>
              <span className="font-mono font-semibold text-foreground">0 处</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <SlidersIcon className="size-3.5 text-primary" />
            声学质量
          </div>
          <div className="mt-2.5 space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>响度</span>
              <span className="font-mono font-semibold text-foreground">-24.5 dBFS</span>
            </div>
            <div className="flex justify-between">
              <span>信噪比</span>
              <span className="font-mono font-semibold text-foreground">26.8 dB</span>
            </div>
            <div className="flex justify-between">
              <span>语音占比</span>
              <span className="font-mono font-semibold text-foreground">84%</span>
            </div>
            <div className="flex justify-between">
              <span>基频中值</span>
              <span className="font-mono font-semibold text-foreground">142 Hz</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <SparklesIcon className="size-3.5 text-amber-500" />
          发音教练针对性反馈
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-600 dark:text-rose-400">音素 /w/ 重点打磨</span>
              <span className="rounded bg-rose-500/20 px-1 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300">17分</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">双唇收圆前突，不接触牙齿</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">water</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">away</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">quick</span>
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-600 dark:text-rose-400">音素 /æ/ 重点打磨</span>
              <span className="rounded bg-rose-500/20 px-1 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300">18分</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">下颌充分放松放低，嘴角向两侧张开</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">cat</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">bank</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">matter</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-600 dark:text-amber-400">音素 /ə/ 弱读提示</span>
              <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">45分</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">轻读的中央元音，非重读音节自然弱化</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">about</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">support</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-600 dark:text-amber-400">音素 /ʌ/ 口型放松</span>
              <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">52分</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">口型自然放松的短元音，发音短促有力</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">cup</span>
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">country</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="font-bold text-foreground">逐词发音精细评测</div>
        <p className="mt-1 text-muted-foreground">This iconic wildlife spectacle isn&apos;t just beautiful...</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">This 92</span>
          <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-300">iconic 74</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">wildlife 88</span>
          <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-700 dark:text-rose-300">spectacle 48</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">isn&apos;t 90</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">just 86</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">beautiful 94</span>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] text-muted-foreground">
        评测标准：基于 Whisper ASR 字符音素对齐与声学特征多维打分，涵盖准确度、流畅度、节奏感与完整度。
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* 注入标准样式表，彻底避免 Next.js styled-jsx 属性丢失问题 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* 100% 彻底隐藏滚动条，保留滚轮自然滚动 */
            .real-no-scrollbar {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
            .real-no-scrollbar::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }

            /* 真正生效的 4px 悬浮半透明微光细药丸（不设置 scrollbar-width 以免覆盖 webkit 规则） */
            .real-sleek-scrollbar::-webkit-scrollbar {
              width: 4px !important;
              height: 4px !important;
            }
            .real-sleek-scrollbar::-webkit-scrollbar-track {
              background: transparent !important;
            }
            .real-sleek-scrollbar::-webkit-scrollbar-thumb {
              background: transparent !important;
              border-radius: 9999px !important;
              transition: background-color 0.25s ease !important;
            }
            .real-sleek-scrollbar:hover::-webkit-scrollbar-thumb {
              background: rgba(140, 140, 150, 0.45) !important;
            }
            .real-sleek-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(100, 100, 110, 0.8) !important;
            }

            /* 原生对照组（Windows 16px 粗灰框 + 箭头） */
            .real-native-scrollbar {
              /* 强制让浏览器走原生渲染 */
            }
          `,
        }}
      />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/practice/shadowing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              返回跟读练习
            </Link>
            <div>
              <h1 className="text-base font-bold text-foreground sm:text-lg">替代丑陋长条的 4 种现代方案体验</h1>
              <p className="text-xs text-muted-foreground">独立测试页面，不影响主应用任何现有代码</p>
            </div>
          </div>
        </div>
      </header>

      {/* 主展示区 */}
      <main className="mx-auto max-w-7xl p-6">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">

          {/* 方案 1: 完全彻底隐藏滚动条 */}
          <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-primary/50 bg-card shadow-sm">
            <div className="border-b border-border/70 p-4 bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-primary">方案 1：完全隐藏长条</span>
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                  最干净
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                彻底移除了右侧所有长条！没有灰底、没有轨道、没有箭头，纯靠鼠标滚轮或触控板滑动。
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">连续字幕 · 反馈</span>
              <span className="rounded bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-xs">完整分析</span>
            </div>

            {/* 滚动区 */}
            <div className="h-[430px] overflow-y-auto overscroll-contain real-no-scrollbar">
              {dummyReportContent}
            </div>

            <div className="border-t border-border/70 bg-muted/15 p-3 text-center text-xs font-medium text-foreground">
              请在此卡片内滑动鼠标滚轮（0 视觉长条干扰）
            </div>
          </div>

          {/* 方案 2: 底部渐变淡出遮罩（Fade Mask） */}
          <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-card shadow-sm">
            <div className="border-b border-border/70 p-4 bg-emerald-500/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">方案 2：底部淡出遮罩</span>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  顶级设计感
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                同样彻底隐藏右侧丑条！用卡片底部优雅的渐隐雾化提示“下面还有内容”，滑到底部渐隐自动消失。
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">连续字幕 · 反馈</span>
              <span className="rounded bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-xs">完整分析</span>
            </div>

            {/* 相对定位包裹层，用于承载底部渐隐遮罩 */}
            <div className="relative flex-1">
              <div
                onScroll={handleMaskScroll}
                className="h-[430px] overflow-y-auto overscroll-contain real-no-scrollbar"
              >
                {dummyReportContent}
              </div>

              {/* 底部淡出遮罩（滑到底部时淡出消失） */}
              <div
                className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/75 to-transparent transition-opacity duration-300 ${
                  maskHasMore ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground/80 tracking-wide">
                  向下滚动查看更多
                </div>
              </div>
            </div>

            <div className="border-t border-border/70 bg-muted/15 p-3 text-center text-xs font-medium text-foreground">
              滑到底部查看渐隐自动消失效果
            </div>
          </div>

          {/* 方案 3: 顶部 2px 极细微光进度条 */}
          <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-sky-500/50 bg-card shadow-sm">
            <div className="border-b border-border/70 p-4 bg-sky-500/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-sky-700 dark:text-sky-400">方案 3：顶部极细进度线</span>
                <span className="rounded-md bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  进度实时可见
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                侧边长条同样 100% 隐藏！卡片顶端有一根 2px 极细进度线，随着滑动实时延伸，完全不占右侧空间。
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">连续字幕 · 反馈</span>
              <span className="rounded bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-xs">
                进度 {Math.round(progressPercent)}%
              </span>
            </div>

            {/* 顶部 2px 极细微光进度线 */}
            <div className="h-0.5 w-full bg-border/40">
              <div
                className="h-full bg-sky-500 transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* 滚动区 */}
            <div
              onScroll={handleProgressScroll}
              className="h-[428px] overflow-y-auto overscroll-contain real-no-scrollbar"
            >
              {dummyReportContent}
            </div>

            <div className="border-t border-border/70 bg-muted/15 p-3 text-center text-xs font-medium text-foreground">
              滚动时观察顶部 2px 细线平滑延伸
            </div>
          </div>

          {/* 方案 4: 修复后的 4px 悬浮半透明微光细药丸 */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border/70 p-4 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-foreground">方案 4：4px 悬浮细药丸</span>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  可鼠标拖拽
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                平时完全隐形，鼠标移入卡片时才在右侧边缘淡入一条 4px 半透明小细条，支持直接鼠标拖拽。
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">连续字幕 · 反馈</span>
              <span className="rounded bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-xs">完整分析</span>
            </div>

            {/* 滚动区 */}
            <div className="h-[430px] overflow-y-auto overscroll-contain real-sleek-scrollbar pr-0.5">
              {dummyReportContent}
            </div>

            <div className="border-t border-border/70 bg-muted/15 p-3 text-center text-xs text-muted-foreground">
              移动光标到卡片内，在最右边缘显现 4px 细条
            </div>
          </div>

        </div>

        {/* 方案对比总结 */}
        <section className="mt-8 rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="text-sm font-bold text-foreground">您希望用哪一种效果彻底替换掉原本的原生粗灰长条？</h2>
          <div className="mt-4 grid gap-4 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="font-bold text-primary text-sm flex items-center gap-1.5">
                <CheckIcon className="size-4" />
                推荐选择：方案 1 或 方案 2
              </div>
              <p className="mt-2 text-foreground font-medium">
                彻底干掉右侧的长条！卡片内壁毫无杂物。现代 Web 产品（如 Linear / 移动端移植 / Notion 极简卡片）普遍采用这种方式，纯靠鼠标滚轮滑动，阅读感受最流畅。
              </p>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="font-bold text-foreground text-sm">
                方案 3（顶部极细进度线）
              </div>
              <p className="mt-2">
                适合如果经常需要了解“这篇长评测我看了百分之多少”，把丑陋的长条替换为顶部 2 像素的精致进度线。
              </p>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="font-bold text-foreground text-sm">
                方案 4（4px 悬浮细药丸）
              </div>
              <p className="mt-2">
                如果偶尔习惯用鼠标左键按住拖拽滚动，这种 4px 细药丸既没有粗灰槽也没有箭头，悬浮才淡入。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

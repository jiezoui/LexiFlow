"use client"

import * as React from "react"
import {
  BrainIcon,
  TrendingUpIcon,
  VideoIcon,
  MicIcon,
  CheckCircle2Icon,
  SparklesIcon,
} from "lucide-react"

export function AnalyticsKpiGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* ── Card 1: 长期记忆转化池 ────────────────────────────────────────── */}
      <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <BrainIcon className="size-4 text-foreground" />
              长期记忆词汇量
            </span>
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
              +48 词本周
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
              2,610
              <span className="ml-1 text-xs font-normal font-sans text-muted-foreground">
                词
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              占 CET-6 <strong className="text-foreground">42%</strong>
            </span>
          </div>

          {/* Micro-visual: 三段式记忆成熟度分布微型条 */}
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary flex gap-0.5 p-0.5">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: "60%" }}
                title="熟练固化 (1,580 词)"
              />
              <div
                className="h-full rounded-full bg-zinc-500 transition-all"
                style={{ width: "28%" }}
                title="稳步强化 (730 词)"
              />
              <div
                className="h-full rounded-full bg-zinc-300 dark:bg-zinc-600 transition-all"
                style={{ width: "12%" }}
                title="新词初识 (300 词)"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-foreground" />
                极熟 1.5k
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-zinc-500" />
                稳态 730
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                初稳 300
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>总库 6,218 词</span>
          <span className="text-foreground font-semibold flex items-center gap-1">
            <CheckCircle2Icon className="size-3" />
            质态健康
          </span>
        </div>
      </div>

      {/* ── Card 2: FSRS 记忆半衰期 ──────────────────────────────────────── */}
      <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <TrendingUpIcon className="size-4 text-foreground" />
              平均记忆半衰期 (S)
            </span>
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
              +2.3 天
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
              14.8
              <span className="ml-1 text-xs font-normal font-sans text-muted-foreground">
                天
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              衰减放缓 <strong className="text-foreground">18%</strong>
            </span>
          </div>

          {/* Micro-visual: 4 次复习间隔拉长阶梯柱 */}
          <div className="mt-3 flex items-end justify-between gap-2 h-7 px-1 pt-1">
            {[
              { label: "R1", days: "1.8d", height: "25%" },
              { label: "R2", days: "4.2d", height: "45%" },
              { label: "R3", days: "8.6d", height: "70%" },
              { label: "R4", days: "14.8d", height: "100%" },
            ].map((step, idx) => (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              >
                <div
                  className="w-full rounded-xs bg-foreground transition-all opacity-85 hover:opacity-100"
                  style={{ height: step.height }}
                  title={`第${idx + 1}次复习半衰期: ${step.days}`}
                />
                <span className="text-[9px] font-mono text-muted-foreground leading-none">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>FSRS-4.5 稳定性拉伸</span>
          <span className="text-foreground font-semibold">指数级抗衰</span>
        </div>
      </div>

      {/* ── Card 3: 语境切片采摘密度 ─────────────────────────────────────── */}
      <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <VideoIcon className="size-4 text-foreground" />
              语境切片采摘网络
            </span>
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
              26 部素材
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
              84
              <span className="ml-1 text-xs font-normal font-sans text-muted-foreground">
                条切片
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              关联 <strong className="text-foreground">235 词</strong>
            </span>
          </div>

          {/* Micro-visual: 多源渗透比例条与胶囊 */}
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary flex gap-0.5 p-0.5">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: "42%" }}
                title="YouTube 播客 (35条 · 42%)"
              />
              <div
                className="h-full rounded-full bg-zinc-600"
                style={{ width: "28%" }}
                title="B站演讲 (24条 · 28%)"
              />
              <div
                className="h-full rounded-full bg-zinc-400"
                style={{ width: "18%" }}
                title="外刊阅读 (15条 · 18%)"
              />
              <div
                className="h-full rounded-full bg-zinc-300 dark:bg-zinc-700"
                style={{ width: "12%" }}
                title="大纲词书 (10条 · 12%)"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>YT 35条</span>
              <span>B站 24条</span>
              <span>外刊 15条</span>
              <span>词书 10条</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>真实语料渗透度</span>
          <span className="text-foreground font-semibold">70% 原声视频</span>
        </div>
      </div>

      {/* ── Card 4: Whisper 影子跟读声学对齐 ─────────────────────────────── */}
      <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <MicIcon className="size-4 text-foreground" />
              影子跟读声学评分
            </span>
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
              评级: A+
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
              92.4
              <span className="ml-1 text-xs font-normal font-sans text-muted-foreground">
                分
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              音素准确度 <strong className="text-foreground">94.8%</strong>
            </span>
          </div>

          {/* Micro-visual: Whisper 声学频谱波形柱 (12 根高低起伏的音频波形) */}
          <div className="mt-3 flex items-end justify-between gap-1 h-7 px-1 pt-1">
            {[35, 60, 45, 85, 70, 95, 65, 80, 50, 90, 75, 40].map((val, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-full bg-foreground transition-all"
                style={{
                  height: `${val}%`,
                  opacity: idx % 2 === 0 ? 0.9 : 0.65,
                }}
                title={`频段 ${idx + 1} 匹配度: ${val}%`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>Whisper 词级对齐</span>
          <span className="text-foreground font-semibold flex items-center gap-1">
            <SparklesIcon className="size-3" />
            准母语音准
          </span>
        </div>
      </div>
    </div>
  )
}

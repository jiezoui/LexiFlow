"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  SparklesIcon,
  Volume2Icon,
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ZapIcon,
  HelpCircleIcon,
  ActivityIcon,
  KeyboardIcon,
  XIcon,
} from "lucide-react"
import type { ReviewQueueCard } from "@/lib/api-client"

interface KeystrokeTelemetry {
  reactionTimeMs: number
  typingDurationMs: number
  backspaces: number
  hints: number
  ikdStd: number
  accuracy: boolean
}

interface KeystrokeCardPanelProps {
  card: ReviewQueueCard
  currentIndex?: number
  totalCards?: number
  sourceType?: "AFTER_REVIEW" | "AFTER_LEARN"
  submitting: boolean
  onComplete: (rating: 1 | 2 | 3 | 4, telemetry: KeystrokeTelemetry) => Promise<void>
  onGiveUp: () => Promise<void>
  onExit?: () => void
  playWordAudio: (word: string) => void
  playSentenceAudio: (sentence: string) => void
}

/**
 * 清洗字符串，严格只保留小写英文字母 [a-z]，去除空格、标点、连字符、数字及输入法杂质
 */
export function sanitizeLettersOnly(text: string): string {
  return (text || "").toLowerCase().replace(/[^a-z]/g, "")
}

export function KeystrokeCardPanel({
  card,
  currentIndex,
  totalCards,
  sourceType = "AFTER_REVIEW",
  submitting,
  onComplete,
  onGiveUp,
  onExit,
  playWordAudio,
  playSentenceAudio,
}: KeystrokeCardPanelProps) {
  // 目标词严格清洗为纯字母以保证判断与槽位对齐
  const targetWord = sanitizeLettersOnly(card.lemma) || card.lemma.trim().toLowerCase()

  // 用户输入状态
  const [typedValue, setTypedValue] = useState<string>("")
  const [revealedHintChars, setRevealedHintChars] = useState<number>(0)
  const [isErrorShake, setIsErrorShake] = useState<boolean>(false)
  const [evaluatedResult, setEvaluatedResult] = useState<{
    rating: 1 | 2 | 3 | 4
    label: string
    reason: string
    rtMs: number
  } | null>(null)

  // 毫秒级击键动力学遥测采集器
  const cardStartTimeRef = useRef<number>(Date.now())
  const firstKeyTimeRef = useRef<number | null>(null)
  const keyTimestampsRef = useRef<number[]>([])
  const backspacesCountRef = useRef<number>(0)
  const hintsCountRef = useRef<number>(0)

  // 实时 HUD 指标
  const [liveRtMs, setLiveRtMs] = useState<number>(0)
  const [liveWpm, setLiveWpm] = useState<number>(0)
  const [liveBackspaces, setLiveBackspaces] = useState<number>(0)
  const [liveHesitationLabel, setLiveHesitationLabel] = useState<string>("等待输入")

  const inputRef = useRef<HTMLInputElement | null>(null)

  // 卡片切换时重置所有遥测数据并自动聚焦输入框
  useEffect(() => {
    setTypedValue("")
    setRevealedHintChars(0)
    setIsErrorShake(false)
    setEvaluatedResult(null)

    cardStartTimeRef.current = Date.now()
    firstKeyTimeRef.current = null
    keyTimestampsRef.current = []
    backspacesCountRef.current = 0
    hintsCountRef.current = 0

    setLiveRtMs(0)
    setLiveWpm(0)
    setLiveBackspaces(0)
    setLiveHesitationLabel("等待输入")

    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [card.cardId])

  // 计算键间间隔 (IKD) 标准差与流利度
  const computeIkdStats = (timestamps: number[]): { avg: number; std: number } => {
    if (timestamps.length < 2) return { avg: 0, std: 0 }
    const intervals: number[] = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance =
      intervals.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / intervals.length
    return { avg: Math.round(avg), std: Math.round(Math.sqrt(variance)) }
  }

  // 综合评价函数：根据准确率、思考用时、键间稳定性、退格次数和求助情况推算评分
  const evaluateKeystrokeDynamics = useCallback(
    (input: string) => {
      const cleanInput = sanitizeLettersOnly(input)
      const now = Date.now()
      const rtMs = firstKeyTimeRef.current
        ? firstKeyTimeRef.current - cardStartTimeRef.current
        : now - cardStartTimeRef.current

      const { std: ikdStd } = computeIkdStats(keyTimestampsRef.current)
      const backspaces = backspacesCountRef.current
      const hints = hintsCountRef.current
      const isCorrect = cleanInput.length > 0 && cleanInput === targetWord

      if (!isCorrect) {
        return {
          rating: 1 as const,
          label: "遗忘 · Again",
          reason: "拼写有误，记为遗忘状态",
          rtMs,
          ikdStd,
          backspaces,
          hints,
          accuracy: false,
        }
      }

      // 使用了提示惩罚 -> Hard
      if (hints > 0) {
        return {
          rating: 2 as const,
          label: "困难 · Hard",
          reason: `使用了字母提示 (${hints} 次求助)，纳入短周期加固`,
          rtMs,
          ikdStd,
          backspaces,
          hints,
          accuracy: true,
        }
      }

      // 提取犹豫、试错频繁或潜伏期过长 -> Hard
      if (backspaces > 2 || rtMs > 3500 || ikdStd > 350) {
        return {
          rating: 2 as const,
          label: "困难 · Hard",
          reason: `输入较为犹豫 (思考用时: ${rtMs}ms, 退格修改: ${backspaces}次)`,
          rtMs,
          ikdStd,
          backspaces,
          hints,
          accuracy: true,
        }
      }

      // 极速瞬析盲打 (思考用时 < 1200ms, 0退格, 键间平稳) -> Easy
      if (rtMs < 1200 && backspaces === 0 && ikdStd < 200) {
        return {
          rating: 4 as const,
          label: "简单 · Easy",
          reason: `盲打熟练，反应极佳 (思考用时: ${rtMs}ms)`,
          rtMs,
          ikdStd,
          backspaces,
          hints,
          accuracy: true,
        }
      }

      // 正常流利拼写 -> Good
      return {
        rating: 3 as const,
        label: "良好 · Good",
        reason: `拼写正确，表现良好 (思考用时: ${rtMs}ms, 退格: ${backspaces}次)`,
        rtMs,
        ikdStd,
        backspaces,
        hints,
        accuracy: true,
      }
    },
    [targetWord]
  )

  // 处理按键录入与动力学采集
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()

    // 记录首次敲击反应时间 (RT)
    if (firstKeyTimeRef.current === null && e.key.length === 1) {
      firstKeyTimeRef.current = now
      const rt = now - cardStartTimeRef.current
      setLiveRtMs(rt)
    }

    // 记录键间时间戳
    if (e.key.length === 1 || e.key === "Backspace") {
      keyTimestampsRef.current.push(now)
      const { std } = computeIkdStats(keyTimestampsRef.current)
      setLiveHesitationLabel(
        std < 150 ? "极流畅" : std < 300 ? "平稳" : std < 500 ? "轻微犹豫" : "显著停滞"
      )
    }

    // 统计退格
    if (e.key === "Backspace") {
      backspacesCountRef.current += 1
      setLiveBackspaces(backspacesCountRef.current)
    }

    // Tab 键触发提示求助 (揭示下一个字母)
    if (e.key === "Tab") {
      e.preventDefault()
      hintsCountRef.current += 1
      const nextHintLen = Math.min(targetWord.length, revealedHintChars + 1)
      setRevealedHintChars(nextHintLen)
      const hintSub = targetWord.slice(0, nextHintLen)
      setTypedValue(hintSub)
      return
    }

    // Escape 键支持快捷退出默写
    if (e.key === "Escape" && onExit) {
      e.preventDefault()
      onExit()
      return
    }

    // 回车提交判定
    if (e.key === "Enter") {
      e.preventDefault()
      triggerSubmit()
    }
  };

  // 提交客观判定
  const triggerSubmit = async (overrideValue?: string) => {
    if (submitting || evaluatedResult) return
    const rawVal = overrideValue !== undefined ? overrideValue : typedValue
    const cleanInput = sanitizeLettersOnly(rawVal)
    const evaluation = evaluateKeystrokeDynamics(cleanInput)

    if (!evaluation.accuracy) {
      // 拼写错误时，触发输入框震颤并展示错误
      setIsErrorShake(true)
      setTimeout(() => setIsErrorShake(false), 500)
      return
    }

    // 正确拼写：瞬间亮起客观动力学反馈
    setEvaluatedResult({
      rating: evaluation.rating,
      label: evaluation.label,
      reason: evaluation.reason,
      rtMs: evaluation.rtMs,
    })

    playWordAudio(card.lemma)

    // 触发 FSRS 自动回写
    await onComplete(evaluation.rating, {
      reactionTimeMs: evaluation.rtMs,
      typingDurationMs: Date.now() - (firstKeyTimeRef.current || cardStartTimeRef.current),
      backspaces: evaluation.backspaces,
      hints: evaluation.hints,
      ikdStd: evaluation.ikdStd,
      accuracy: true,
    })
  }

  // 放弃并查看全拼 (标为 Again)
  const handleGiveUpClick = async () => {
    if (submitting) return
    setTypedValue(targetWord)
    playWordAudio(card.lemma)
    await onGiveUp()
  }

  // 语境挖空句生成 (将当前句子中的目标词替换为下划线槽位)
  const renderClozeSentence = () => {
    const sentence = card.contextSentence
    if (!sentence) return null
    const safeLemma = card.lemma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`\\b${safeLemma}\\b`, "gi")
    const hasMatch = regex.test(sentence)
    const clozeDisplay = hasMatch
      ? sentence.replace(regex, "______")
      : `${sentence} (提示词: ${card.lemma})`

    return (
      <div className="p-3 sm:p-4 rounded-2xl bg-muted/40 border border-border/60 text-left transition-all hover:border-primary/40 max-h-[110px] sm:max-h-[130px] overflow-y-auto shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <SparklesIcon className="size-3.5 text-primary" />
            Cloze Context · 原生语境挖空填词
          </span>
          <button
            type="button"
            onClick={() => playSentenceAudio(sentence)}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
          >
            <Volume2Icon className="size-3.5" />
            <span>听原句</span>
          </button>
        </div>
        <p className="text-xs sm:text-sm font-serif text-foreground leading-relaxed">
          {clozeDisplay}
        </p>
        {card.contextTranslation && (
          <p className="mt-1 text-xs text-muted-foreground">
            {card.contextTranslation}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* 默写主卡片 (根据红色方框适度增加高度，整体舒展大气并防滚动) */}
      <div
        className={`relative flex flex-col justify-between min-h-[480px] sm:min-h-[520px] md:min-h-[540px] p-5 sm:p-6 md:p-8 rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/90 shadow-xl transition-all ${
          isErrorShake ? "animate-shake border-rose-500/80 bg-rose-500/5" : ""
        }`}
      >
        {/* 卡顶元数据与状态栏 (状态内聚于卡顶栏) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3 mb-3.5">
          {/* 左侧：模式标签 + 记忆稳定性 */}
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <ZapIcon className="size-3.5" />
              <span>{sourceType === "AFTER_REVIEW" ? "复习单词默写" : "新词拼写默写"}</span>
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              记忆稳定性 S = {card.stability}d
            </span>
          </div>

          {/* 右侧：词量进度指示 + 快捷键提示 + 退出默写按钮 */}
          <div className="flex items-center gap-2 sm:gap-3">
            {totalCards !== undefined && currentIndex !== undefined && (
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-muted text-foreground border border-border/60 shadow-2xs">
                第 {currentIndex + 1} / {totalCards} 词
              </span>
            )}
            <span className="hidden sm:inline text-xs font-mono text-muted-foreground">
              [Tab 提示 · Enter 提交]
            </span>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xs"
                title="退出当前默写，返回常规卡片学习 (快捷键 Esc)"
              >
                <XIcon className="size-3.5 text-muted-foreground" />
                <span>退出默写</span>
              </button>
            )}
          </div>
        </div>

        {/* 击键动力学遥测 HUD 微条 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 sm:p-2.5 rounded-2xl bg-muted/30 border border-border/50 text-xs font-mono mb-4">
          <div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground">
            <ZapIcon className="size-3.5 text-amber-500" />
            <span>思考:</span>
            <strong className="text-foreground">{liveRtMs > 0 ? `${liveRtMs}ms` : "--"}</strong>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground">
            <ActivityIcon className="size-3.5 text-emerald-500" />
            <span>状态:</span>
            <strong className="text-foreground">{liveHesitationLabel}</strong>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground">
            <KeyboardIcon className="size-3.5 text-sky-500" />
            <span>退格:</span>
            <strong className={liveBackspaces > 2 ? "text-rose-500" : "text-foreground"}>
              {liveBackspaces} 次
            </strong>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground">
            <HelpCircleIcon className="size-3.5 text-indigo-500" />
            <span>提示:</span>
            <strong className="text-foreground">{revealedHintChars} 字母</strong>
          </div>
        </div>

        {/* 词义线索与语境 */}
        <div className="flex flex-col items-center justify-center text-center py-2 sm:py-3 flex-1">
          <div className="flex items-baseline justify-center gap-2.5 text-primary font-bold text-xl sm:text-2xl md:text-3xl">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-primary/10">
              {card.pos || "v./n."}
            </span>
            <span>{card.definitionCn}</span>
          </div>

          {card.phoneticUs && (
            <p className="mt-1 font-mono text-xs sm:text-sm text-muted-foreground tracking-wider">
              {card.phoneticUs}
            </p>
          )}

          {/* 单词槽位视觉化 (Slot Visualizer) */}
          <div className="mt-3.5 sm:mt-4.5 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
            {targetWord.split("").map((char, idx) => {
              const typedChar = typedValue[idx]
              const isTyped = typedChar !== undefined
              const isHinted = idx < revealedHintChars

              return (
                <div
                  key={idx}
                  className={`size-9 sm:size-10 md:size-11 rounded-xl flex items-center justify-center font-mono font-bold text-base sm:text-xl transition-all border ${
                    isTyped
                      ? "border-primary bg-primary/10 text-foreground scale-105 shadow-xs"
                      : isHinted
                      ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "border-border/80 bg-muted/30 text-transparent"
                  }`}
                >
                  {isTyped ? typedChar : isHinted ? char : "_"}
                </div>
              )
            })}
          </div>

          {/* 语境挖空句 */}
          <div className="mt-4 sm:mt-5 w-full max-w-xl">{renderClozeSentence()}</div>
        </div>

        {/* 默写输入交互条 */}
        <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-border/60 flex flex-col items-center gap-3">
          <div className="relative w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={typedValue}
              onChange={(e) => {
                // 严格清洗输入的文字：只保留字母 [a-z]
                const val = sanitizeLettersOnly(e.target.value)
                setTypedValue(val)
                // 若输入完整且准确，直接自动触发判定
                if (val.length > 0 && val === targetWord) {
                  setTimeout(() => triggerSubmit(val), 50)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="在此直接输入单词进行默写..."
              disabled={submitting || evaluatedResult !== null}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full h-12 sm:h-13 rounded-2xl border-2 border-primary/40 bg-background px-5 text-center font-mono text-lg sm:text-xl font-bold tracking-widest text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all shadow-inner disabled:opacity-50"
            />
          </div>

          {/* 操作辅助栏 */}
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-mono text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                hintsCountRef.current += 1
                const next = Math.min(targetWord.length, revealedHintChars + 1)
                setRevealedHintChars(next)
                setTypedValue(targetWord.slice(0, next))
              }}
              className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>[Tab] 提示首字母</span>
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleGiveUpClick}
              disabled={submitting}
              className="hover:text-rose-500 transition-colors flex items-center gap-1.5 text-rose-500/80 cursor-pointer"
            >
              <RotateCcwIcon className="size-3.5" />
              <span>不记得了 / 认输记为 Again</span>
            </button>
          </div>
        </div>

        {/* 默写判定成果徽章 (Result Dialog) */}
        {evaluatedResult && (
          <div className="absolute inset-0 z-20 rounded-3xl bg-card/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <ZapIcon className="size-8 animate-bounce" />
            </div>
            <div className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
              默写结果评定
            </div>
            <h3 className="text-2xl font-black font-mono text-foreground mt-1">
              FSRS Rating: {evaluatedResult.label}
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-2 max-w-sm">
              {evaluatedResult.reason}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2Icon className="size-4" />
              <span>已更新复习进度，即将切换下一词...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

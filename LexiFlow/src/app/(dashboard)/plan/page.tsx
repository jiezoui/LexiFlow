"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  planApi,
  wordbookApi,
  type StudyPlanOverview,
  type Wordbook,
} from "@/lib/api-client"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BookOpenIcon,
  CalendarIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  CompassIcon,
  SlidersHorizontalIcon,
  Loader2Icon,
  ZapIcon,
  ScaleIcon,
  MicIcon,
  CoffeeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from "lucide-react"

// 策略模式预设原型定义
interface StrategyPreset {
  id: string
  title: string
  subtitle: string
  tag: string
  newWords: number
  shadowing: number
  contextMinutes: number
  icon: typeof ZapIcon
  desc: string
}

const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: "balanced",
    title: "全面进阶",
    subtitle: "黄金均衡配比",
    tag: "推荐",
    newWords: 20,
    shadowing: 5,
    contextMinutes: 15,
    icon: ScaleIcon,
    desc: "新词与复习阻尼处于平衡态，兼顾跟读输出与语境沉浸。",
  },
  {
    id: "sprint",
    title: "考试冲刺",
    subtitle: "短期词汇突破",
    tag: "高强度",
    newWords: 35,
    shadowing: 3,
    contextMinutes: 20,
    icon: ZapIcon,
    desc: "以词汇内化为主攻线，快速覆盖大纲生词，需充足复习预算。",
  },
  {
    id: "oral",
    title: "听说突破",
    subtitle: "发音与听力脱敏",
    tag: "口语优先",
    newWords: 10,
    shadowing: 8,
    contextMinutes: 30,
    icon: MicIcon,
    desc: "降低生词记忆量，强化 Whisper 评分与长音频精听沉浸。",
  },
  {
    id: "light",
    title: "微习惯维持",
    subtitle: "碎片时间低负荷",
    tag: "轻量",
    newWords: 10,
    shadowing: 0,
    contextMinutes: 10,
    icon: CoffeeIcon,
    desc: "低负荷轻量微循环，维护日常学习惯性，防断签中断。",
  },
]

export default function StudyPlanPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<StudyPlanOverview | null>(null)
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([])
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)

  // 核心规划配置状态
  const [selectedBookId, setSelectedBookId] = useState<number>(1)
  const [dailyNewWords, setDailyNewWords] = useState<number>(20)
  const [dailyShadowing, setDailyShadowing] = useState<number>(5)
  const [dailyContextMinutes, setDailyContextMinutes] = useState<number>(15)
  const [targetDate, setTargetDate] = useState<string>("")

  // 当前激活的预设策略
  const [activeStrategyId, setActiveStrategyId] = useState<string>("balanced")
  // 是否展开精细参数微调面板
  const [showCustomTuning, setShowCustomTuning] = useState<boolean>(false)
  // 词书下拉与日期浮层控制
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const bookDropdownRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)

  // 日历内部视图月份控制
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date())

  // 点击外部自动收起下拉和日期浮层
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bookDropdownRef.current && !bookDropdownRef.current.contains(e.target as Node)) {
        setBookDropdownOpen(false)
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 加载计划和词书
  const loadPlanData = useCallback(async () => {
    try {
      setLoading(true)
      const [planRes, booksRes] = await Promise.all([
        planApi.getTodayOverview().catch(() => null),
        wordbookApi.list().catch(() => [] as Wordbook[]),
      ])

      setWordbooks(booksRes || [])
      if (planRes) {
        setPlan(planRes)
        const curBookId = planRes.macro.wordbookId || 1
        const curWords = planRes.today.vocab.target || 20
        const curShadow = planRes.today.shadowing.target ?? 5
        const curContext = planRes.today.context.targetMinutes ?? 15
        const curDate = planRes.macro.targetDate || ""

        setSelectedBookId(curBookId)
        setDailyNewWords(curWords)
        setDailyShadowing(curShadow)
        setDailyContextMinutes(curContext)
        setTargetDate(curDate)

        if (curDate) {
          const parsed = new Date(curDate)
          if (!isNaN(parsed.getTime())) {
            setCalendarViewDate(parsed)
          }
        }

        const matched = STRATEGY_PRESETS.find(
          (p) => p.newWords === curWords && p.shadowing === curShadow && p.contextMinutes === curContext
        )
        setActiveStrategyId(matched ? matched.id : "custom")
      }
    } catch (e) {
      console.warn("加载计划数据失败:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlanData()
  }, [loadPlanData])

  // 当前所选词书信息
  const activeBook = useMemo(() => {
    return wordbooks.find((b) => b.id === selectedBookId)
  }, [wordbooks, selectedBookId])

  const unlearnedCount = useMemo(() => {
    if (activeBook && plan && activeBook.id === plan.macro.wordbookId) {
      return plan.macro.unlearnedWords
    }
    return activeBook ? Math.max(0, activeBook.totalWords - (activeBook.masteredWords || 0)) : 2000
  }, [activeBook, plan])

  // 动态测算完成日期与天数
  const dynamicEstimatedDate = useMemo(() => {
    if (dailyNewWords <= 0) return ""
    const daysNeeded = Math.ceil(Math.max(1, unlearnedCount) / dailyNewWords)
    const d = new Date()
    d.setDate(d.getDate() + daysNeeded)
    return d.toISOString().split("T")[0]
  }, [unlearnedCount, dailyNewWords])

  const daysNeeded = useMemo(() => {
    if (dailyNewWords <= 0) return 0
    return Math.ceil(Math.max(1, unlearnedCount) / dailyNewWords)
  }, [unlearnedCount, dailyNewWords])

  // 目标倒计时与建议日配额推导
  const targetDaysRemaining = useMemo(() => {
    if (!targetDate) return null
    const targetTime = new Date(targetDate).getTime()
    const nowTime = new Date().setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : null
  }, [targetDate])

  const requiredPace = useMemo(() => {
    if (!targetDaysRemaining) return null
    return Math.max(5, Math.min(80, Math.ceil(unlearnedCount / targetDaysRemaining)))
  }, [unlearnedCount, targetDaysRemaining])

  // 时间精力切片计算（分钟）
  const timeBreakdown = useMemo(() => {
    const vocabMinutes = Math.round(dailyNewWords * 0.75)
    const shadowingMinutes = Math.round(dailyShadowing * 1.5)
    const contextMinutes = dailyContextMinutes
    const totalMinutes = vocabMinutes + shadowingMinutes + contextMinutes

    const vocabPct = totalMinutes > 0 ? Math.round((vocabMinutes / totalMinutes) * 100) : 0
    const shadowingPct = totalMinutes > 0 ? Math.round((shadowingMinutes / totalMinutes) * 100) : 0
    const contextPct = totalMinutes > 0 ? Math.max(0, 100 - vocabPct - shadowingPct) : 0

    return {
      vocabMinutes,
      shadowingMinutes,
      contextMinutes,
      totalMinutes,
      vocabPct,
      shadowingPct,
      contextPct,
    }
  }, [dailyNewWords, dailyShadowing, dailyContextMinutes])

  // 今天使用实际到期量；后续 13 天按新词目标做示意推演。
  const loadProjection = useMemo(() => {
    const data = []
    const baseNew = dailyNewWords
    const initialDue = plan?.today?.vocab?.dueReview ?? 12
    const reviewFactors = [0, 0.85, 1.05, 1.2, 1.4, 1.7, 2.15, 2.6, 2.15, 1.7, 1.5, 1.4, 1.35, 1.3]

    for (let day = 1; day <= 14; day++) {
      const dateObj = new Date()
      dateObj.setDate(dateObj.getDate() + (day - 1))
      const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`

      const reviewCount = day === 1 ? initialDue : Math.round(baseNew * reviewFactors[day - 1])
      const estimatedMinutes = Math.round(baseNew * 0.75 + reviewCount * 0.25)

      data.push({
        day,
        dateLabel,
        newWords: baseNew,
        reviewCount,
        estimatedMinutes,
      })
    }

    return { data, trendData: data.slice(1) }
  }, [dailyNewWords, plan])

  // 应用预设策略
  const applyStrategy = (strategy: StrategyPreset) => {
    setActiveStrategyId(strategy.id)
    setDailyNewWords(strategy.newWords)
    setDailyShadowing(strategy.shadowing)
    setDailyContextMinutes(strategy.contextMinutes)
  }

  // 目标日期更新
  const handleTargetDateChange = (val: string) => {
    setTargetDate(val)
    if (!val) return
    const diffTime = new Date(val).getTime() - new Date().setHours(0, 0, 0, 0)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays > 0) {
      const calculatedQuota = Math.max(5, Math.min(80, Math.ceil(unlearnedCount / diffDays)))
      setDailyNewWords(calculatedQuota)
      setActiveStrategyId("custom")
    }
  }

  // 恢复基准推荐值
  const handleResetRecommended = () => {
    const defaultStrategy = STRATEGY_PRESETS[0]
    applyStrategy(defaultStrategy)
    setTargetDate("")
  }

  // 保存计划
  const handleSavePlan = async () => {
    try {
      setSaving(true)
      const res = await planApi.updateConfig({
        wordbookId: selectedBookId,
        dailyNewWords,
        dailyShadowingSentences: dailyShadowing,
        dailyContextMinutes,
        targetDate: targetDate || null,
      })

      setPlan(res)
      try {
        localStorage.setItem("lexiflow_primary_wordbook_id", String(selectedBookId))
        localStorage.setItem("lexiflow_daily_target", String(dailyNewWords))
      } catch {}

      window.dispatchEvent(new CustomEvent("lexiflow_plan_updated", { detail: res }))
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))

      setFeedbackNotice("计划已成功保存并同步至系统调度器")
      setTimeout(() => setFeedbackNotice(null), 3000)
    } catch (e) {
      console.warn("保存计划失败:", e)
      setFeedbackNotice("保存计划失败，请重试")
      setTimeout(() => setFeedbackNotice(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  // 日历计算工具
  const calYear = calendarViewDate.getFullYear()
  const calMonth = calendarViewDate.getMonth()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay() // 0 是周日

  const handlePrevMonth = () => {
    setCalendarViewDate(new Date(calYear, calMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(calYear, calMonth + 1, 1))
  }

  const handleSelectCalendarDay = (day: number) => {
    const formatted = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    handleTargetDateChange(formatted)
    setDatePickerOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* 提示消息浮标 */}
      {feedbackNotice && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-xl text-xs font-semibold text-foreground">
            <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        </div>
      )}

      {/* 顶栏：标题与核心行动 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CompassIcon className="size-4.5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              学习计划
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            科学配置每日新词与多模态复习节奏，预防复习负荷过载。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetRecommended}
            disabled={saving || loading}
            className="text-xs font-medium rounded-xl gap-1.5"
          >
            <RotateCcwIcon className="size-3.5 text-muted-foreground" />
            <span>恢复基准</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSavePlan}
            disabled={saving || loading}
            className="text-xs font-semibold rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {saving ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <CheckCircle2Icon className="size-3.5" />
                <span>保存并应用</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[360px] rounded-3xl border border-border bg-card/60">
          <Loader2Icon className="size-8 text-primary animate-spin" />
          <p className="mt-3 text-xs text-muted-foreground font-mono">加载中...</p>
        </div>
      ) : (
        <>
          {/* ── 模块 1：策略模式矩阵 ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                1. 学习策略
              </h2>

              {/* 现代悬浮式词书下拉选择器 (紧凑等宽，与按钮严格贴合) */}
              <div className="relative w-56 sm:w-60" ref={bookDropdownRef}>
                <button
                  type="button"
                  onClick={() => setBookDropdownOpen(!bookDropdownOpen)}
                  className="w-full flex items-center justify-between h-8 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground font-medium hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shadow-2xs select-none"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <BookOpenIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold truncate">{activeBook?.title || "主修词书"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground font-mono text-[11px] shrink-0">
                    <span>剩 {unlearnedCount}</span>
                    <ChevronDownIcon
                      className={`size-3 transition-transform duration-200 ${
                        bookDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {bookDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-full rounded-xl border border-border bg-popover p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
                    <div className="max-h-52 overflow-y-auto space-y-0.5">
                      {wordbooks.map((wb) => {
                        const remaining = Math.max(0, wb.totalWords - (wb.masteredWords || 0))
                        const isSelected = wb.id === selectedBookId
                        return (
                          <button
                            key={wb.id}
                            type="button"
                            onClick={() => {
                              setSelectedBookId(wb.id)
                              setBookDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isSelected
                                ? "bg-muted text-foreground font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
                            }`}
                          >
                            <span className="truncate pr-2">{wb.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                              <span className={isSelected ? "text-foreground font-semibold" : "text-muted-foreground"}>
                                剩 {remaining} 词
                              </span>
                              {isSelected && <CheckIcon className="size-3 text-primary" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {STRATEGY_PRESETS.map((strategy) => {
                const IconComponent = strategy.icon
                const isActive = activeStrategyId === strategy.id

                return (
                  <div
                    key={strategy.id}
                    onClick={() => applyStrategy(strategy)}
                    className={`group relative flex flex-col justify-between p-4.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isActive
                        ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`size-8 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          <IconComponent className="size-4" />
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {strategy.tag}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-foreground">{strategy.title}</h3>
                      <p className="text-[11px] text-muted-foreground font-medium">{strategy.subtitle}</p>

                      <p className="mt-2 text-xs text-muted-foreground/90 leading-relaxed">
                        {strategy.desc}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-foreground font-bold">{strategy.newWords} 词/天</span>
                      <span className="text-muted-foreground">{strategy.shadowing} 句跟读</span>
                      <span className="text-muted-foreground">{strategy.contextMinutes}m 输入</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 自定义调节开关 */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowCustomTuning(!showCustomTuning)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <SlidersHorizontalIcon className="size-3.5" />
                <span>{showCustomTuning ? "收起参数调节" : "展开高级自定义参数"}</span>
                {showCustomTuning ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
              </button>

              {showCustomTuning && (
                <div className="mt-2.5 p-4 rounded-2xl border border-border/80 bg-muted/20 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">每日新学词数</span>
                      <span className="font-mono font-bold text-primary">{dailyNewWords} 词</span>
                    </div>
                    <Slider
                      value={[dailyNewWords]}
                      min={5}
                      max={80}
                      step={5}
                      onValueChange={(val) => {
                        setDailyNewWords(Array.isArray(val) ? val[0] : Number(val))
                        setActiveStrategyId("custom")
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">每日跟读句数</span>
                      <span className="font-mono font-bold text-primary">{dailyShadowing} 句</span>
                    </div>
                    <Slider
                      value={[dailyShadowing]}
                      min={0}
                      max={15}
                      step={1}
                      onValueChange={(val) => {
                        setDailyShadowing(Array.isArray(val) ? val[0] : Number(val))
                        setActiveStrategyId("custom")
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">每日视听读时长</span>
                      <span className="font-mono font-bold text-primary">{dailyContextMinutes} 分钟</span>
                    </div>
                    <Slider
                      value={[dailyContextMinutes]}
                      min={0}
                      max={60}
                      step={5}
                      onValueChange={(val) => {
                        setDailyContextMinutes(Array.isArray(val) ? val[0] : Number(val))
                        setActiveStrategyId("custom")
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── 模块 2：每日时间分配 ── */}
          <section className="p-5 rounded-3xl border border-border bg-card shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                2. 每日时间分配
              </h2>

              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-xl">
                <span className="text-xs text-muted-foreground font-medium">预计总投入:</span>
                <span className="font-mono text-base font-extrabold text-foreground">
                  ~{timeBreakdown.totalMinutes}
                </span>
                <span className="text-xs text-muted-foreground font-mono">分钟</span>
              </div>
            </div>

            {/* 堆叠时间分配条 */}
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded-full bg-muted/50 overflow-hidden flex gap-1 p-0.5">
                <div
                  className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                  style={{ width: `${timeBreakdown.vocabPct}%` }}
                  title={`词汇: ${timeBreakdown.vocabMinutes}m (${timeBreakdown.vocabPct}%)`}
                />
                <div
                  className="h-full rounded-full bg-purple-600 dark:bg-purple-500 transition-all duration-300"
                  style={{ width: `${timeBreakdown.shadowingPct}%` }}
                  title={`跟读: ${timeBreakdown.shadowingMinutes}m (${timeBreakdown.shadowingPct}%)`}
                />
                <div
                  className="h-full rounded-full bg-amber-600 dark:bg-amber-500 transition-all duration-300"
                  style={{ width: `${timeBreakdown.contextPct}%` }}
                  title={`语境: ${timeBreakdown.contextMinutes}m (${timeBreakdown.contextPct}%)`}
                />
              </div>

              {/* 三大板块指标小卡 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                <div className="p-3 rounded-2xl bg-blue-500/[0.04] border border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">核心词汇识记</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {dailyNewWords} 新词 + 间隔复习
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-foreground">~{timeBreakdown.vocabMinutes}m</span>
                    <span className="text-[10px] text-muted-foreground block">{timeBreakdown.vocabPct}%</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/[0.04] border border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-600 dark:bg-purple-500" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">影子跟读输出</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {dailyShadowing > 0 ? `${dailyShadowing} 句` : "今日休整"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-foreground">~{timeBreakdown.shadowingMinutes}m</span>
                    <span className="text-[10px] text-muted-foreground block">{timeBreakdown.shadowingPct}%</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-600 dark:bg-amber-500" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">视听读语境沉浸</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        外刊 · 精听 · 播客
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-foreground">{timeBreakdown.contextMinutes}m</span>
                    <span className="text-[10px] text-muted-foreground block">{timeBreakdown.contextPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── 模块 3：未来 14 天复习负荷预测 ── */}
          <section className="p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground tracking-tight">
                  3. 未来 14 天复习负荷预测
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  按当前计划推演
                </span>
              </div>

              {/* 图例 */}
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0 w-4 border-t border-dashed border-foreground" />
                  每日新词目标
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0 w-4 border-t-2 border-emerald-500" />
                  预测复习卡片
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border/70 pb-2 text-xs">
              <span className="text-muted-foreground">今日已到期 <strong className="font-mono font-semibold text-foreground">{loadProjection.data[0].reviewCount} 张</strong></span>
              <span className="text-muted-foreground">下图展示随后 13 天的复习负荷</span>
            </div>

            <div className="h-56 w-full pt-3" aria-label="随后 13 天每日新词目标和预计复习卡片趋势">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  accessibilityLayer
                  data={loadProjection.trendData}
                  margin={{ top: 22, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="plan-review-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
                  <XAxis
                    dataKey="dateLabel"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    minTickGap={28}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.12)]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4, strokeDasharray: "3 4" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0].payload as (typeof loadProjection.data)[number]
                      return (
                        <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                          <div className="mb-1 font-medium">{item.dateLabel} · 第 {item.day} 天</div>
                          <div className="text-muted-foreground">预计复习 <span className="font-mono font-semibold text-foreground">{item.reviewCount} 张</span></div>
                          <div className="text-muted-foreground">每日新词 <span className="font-mono font-semibold text-foreground">{item.newWords} 词</span></div>
                          <div className="mt-1 border-t border-border pt-1 text-muted-foreground">合计约 {item.estimatedMinutes} 分钟</div>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="linear"
                    dataKey="reviewCount"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#plan-review-area)"
                    activeDot={{ r: 4, fill: "#10b981", stroke: "var(--card)", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="newWords"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="4 5"
                    dot={false}
                    activeDot={false}
                  />
                  <ReferenceLine
                    x={loadProjection.data[7].dateLabel}
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.5}
                    strokeDasharray="3 4"
                    label={{ value: "首轮波峰", position: "top", fill: "var(--muted-foreground)", fontSize: 10 }}
                  />
                  <ReferenceDot
                    x={loadProjection.data[7].dateLabel}
                    y={loadProjection.data[7].reviewCount}
                    r={5}
                    fill="#10b981"
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span>首轮复习波峰出现在第 8 天，随后逐步回落</span>
              <span>第 8 天预计 <strong className="font-mono font-semibold text-foreground">{loadProjection.data[7].reviewCount} 张复习卡片</strong></span>
              <span>合计约 <strong className="font-mono font-semibold text-foreground">{loadProjection.data[7].estimatedMinutes} 分钟</strong></span>
            </div>
          </section>

          {/* ── 模块 4：目标考试日倒推 ── */}
          <section className="p-5 rounded-3xl border border-border bg-card shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                4. 目标考试日倒推
              </h2>

              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate("")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
                >
                  清除截止日
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-0.5">
              {/* 定制主题弹层日期选择器 (彻底解决浏览器自带控件割裂问题) */}
              <div className="relative" ref={datePickerRef}>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  目标截止日期
                </label>
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className="flex items-center justify-between w-full h-8.5 rounded-xl border border-border bg-card px-3 text-xs text-foreground font-mono hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shadow-2xs select-none"
                >
                  <span className={targetDate ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    {targetDate || "点击选择截止日期"}
                  </span>
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                </button>

                {/* 现代沉浸式日历浮层 */}
                {datePickerOpen && (
                  <div className="absolute left-0 bottom-full mb-1.5 z-50 w-72 rounded-2xl border border-border bg-popover/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
                    {/* 月份导航栏 */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {calYear}年 {calMonth + 1}月
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ChevronLeftIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ChevronRightIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 星期行 */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-muted-foreground pb-1">
                      {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>

                    {/* 日期网格 */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
                      {/* 首日前的空白占位 */}
                      {Array.from({ length: firstDayIndex }).map((_, i) => (
                        <span key={`empty-${i}`} className="size-7" />
                      ))}

                      {/* 当月日期 */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1
                        const cellDateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
                        const isSelected = targetDate === cellDateStr
                        const cellDate = new Date(calYear, calMonth, dayNum)
                        const isPast = cellDate < new Date(new Date().setHours(0, 0, 0, 0))

                        return (
                          <button
                            key={dayNum}
                            type="button"
                            disabled={isPast}
                            onClick={() => handleSelectCalendarDay(dayNum)}
                            className={`size-7 rounded-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                                : isPast
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-foreground hover:bg-muted hover:text-foreground font-medium"
                            }`}
                          >
                            {dayNum}
                          </button>
                        )
                      })}
                    </div>

                    {/* 快捷脚标栏 */}
                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetDate("")
                          setDatePickerOpen(false)
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        清空
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTargetDateChange("2026-12-31")
                          setDatePickerOpen(false)
                        }}
                        className="text-primary font-medium hover:underline"
                      >
                        年底 (12/31)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">当前词书未学量</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {unlearnedCount} <span className="text-xs font-normal text-muted-foreground">词待攻克</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {targetDaysRemaining && targetDaysRemaining > 0 ? "达成目标所需速率" : "预计完成节点"}
                </span>
                {targetDaysRemaining && targetDaysRemaining > 0 ? (
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-mono text-base font-bold text-primary">
                      {requiredPace} <span className="text-xs font-normal text-muted-foreground font-mono">词 / 天</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      倒计时 {targetDaysRemaining} 天
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-base font-bold text-primary">
                    {dynamicEstimatedDate || "未设定"}
                    <span className="ml-1 text-xs font-normal text-muted-foreground font-mono">
                      ({daysNeeded} 天)
                    </span>
                  </span>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

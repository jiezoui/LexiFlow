"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  planApi,
  wordbookApi,
  type StudyPlanOverview,
  type Wordbook,
} from "@/lib/api-client"
import {
  BookOpenIcon,
  HeadphonesIcon,
  ClockIcon,
  CalendarIcon,
  Loader2Icon,
  CompassIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CheckIcon,
} from "lucide-react"

interface PlanConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan?: StudyPlanOverview | null
  initialWordbookId?: number
  onSuccess?: (newPlan: StudyPlanOverview) => void
}

export function PlanConfigDialog({
  open,
  onOpenChange,
  currentPlan,
  initialWordbookId,
  onSuccess,
}: PlanConfigDialogProps) {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([])
  const [loadingBooks, setLoadingBooks] = useState(false)
  const [saving, setSaving] = useState(false)

  // 表单状态
  const [selectedBookId, setSelectedBookId] = useState<number>(1)
  const [dailyNewWords, setDailyNewWords] = useState<number>(20)
  const [dailyShadowing, setDailyShadowing] = useState<number>(3)
  const [dailyContextMinutes, setDailyContextMinutes] = useState<number>(15)
  const [targetDate, setTargetDate] = useState<string>("")
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false)

  // 初始化已有数据
  useEffect(() => {
    if (!open) return

    setLoadingBooks(true)
    wordbookApi
      .list()
      .then((res) => {
        setWordbooks(res || [])
      })
      .catch(() => {})
      .finally(() => setLoadingBooks(false))

    if (currentPlan) {
      setSelectedBookId(initialWordbookId || currentPlan.macro.wordbookId || 1)
      setDailyNewWords(currentPlan.today.vocab.target || 20)
      setDailyShadowing(currentPlan.today.shadowing.target ?? 3)
      setDailyContextMinutes(currentPlan.today.context.targetMinutes ?? 15)
      setTargetDate(currentPlan.macro.targetDate || "")
    } else if (initialWordbookId) {
      setSelectedBookId(initialWordbookId)
    }
  }, [open, currentPlan, initialWordbookId])

  // 当前所选词书信息
  const activeBook = useMemo(() => {
    return wordbooks.find((b) => b.id === selectedBookId)
  }, [wordbooks, selectedBookId])

  const unlearnedCount = useMemo(() => {
    if (activeBook && currentPlan && activeBook.id === currentPlan.macro.wordbookId) {
      return currentPlan.macro.unlearnedWords
    }
    return activeBook ? Math.max(0, activeBook.totalWords - (activeBook.masteredWords || 0)) : 2000
  }, [activeBook, currentPlan])

  // 动态联动推算预计完成日期
  const dynamicEstimatedDate = useMemo(() => {
    if (dailyNewWords <= 0) return ""
    const daysNeeded = Math.ceil(Math.max(1, unlearnedCount) / dailyNewWords)
    const target = new Date()
    target.setDate(target.getDate() + daysNeeded)
    return target.toISOString().split("T")[0]
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

  // 当选择目标日期时，倒推建议配额
  const handleTargetDateChange = (val: string) => {
    setTargetDate(val)
    if (!val) return
    const diffTime = new Date(val).getTime() - new Date().setHours(0, 0, 0, 0)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays > 0) {
      const calculatedQuota = Math.max(5, Math.min(80, Math.ceil(unlearnedCount / diffDays)))
      setDailyNewWords(calculatedQuota)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await planApi.updateConfig({
        wordbookId: selectedBookId,
        dailyNewWords,
        dailyShadowingSentences: dailyShadowing,
        dailyContextMinutes,
        targetDate: targetDate || null,
      })

      try {
        localStorage.setItem("lexiflow_primary_wordbook_id", String(selectedBookId))
        localStorage.setItem("lexiflow_daily_target", String(dailyNewWords))
      } catch {}

      window.dispatchEvent(new CustomEvent("lexiflow_plan_updated", { detail: res }))
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))

      onSuccess?.(res)
      onOpenChange(false)
    } catch (err) {
      console.warn("更新学习计划失败:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border/80 text-foreground p-6 sm:p-7 shadow-2xl rounded-3xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CompassIcon className="size-5 text-primary" />
              调整综合学习计划
            </DialogTitle>
            <Link
              href="/plan"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-medium transition-colors mr-6"
            >
              <span>完整计划中心</span>
              <ArrowRightIcon className="size-3" />
            </Link>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            动态配置每日任务配额与核心词书进度，系统自适应平衡复习节奏。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-3">
          {/* 1. 主攻词书选择 */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpenIcon className="size-3.5 text-muted-foreground" />
              主攻词书
            </label>
            <button
              type="button"
              onClick={() => setBookDropdownOpen(!bookDropdownOpen)}
              className="w-full flex items-center justify-between h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground font-medium hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer shadow-2xs select-none"
            >
              <span className="font-semibold">{activeBook?.title || "选择主修词书"}</span>
              <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                <span>(共 {activeBook?.totalWords || 0} 词)</span>
                <ChevronDownIcon
                  className={`size-3 transition-transform duration-200 ${
                    bookDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {bookDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-xl border border-border bg-popover p-1 shadow-lg backdrop-blur-md max-h-52 overflow-y-auto space-y-0.5">
                {wordbooks.map((wb) => {
                  const isSelected = wb.id === selectedBookId
                  const remaining = Math.max(0, wb.totalWords - (wb.masteredWords || 0))
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
            )}
          </div>

          {/* 2. 每日新词配额 (主线) */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">每日新学词数</span>
              <span className="font-mono text-foreground font-extrabold text-sm">
                {dailyNewWords} <span className="text-xs text-muted-foreground font-normal">词 / 天</span>
              </span>
            </div>
            <Slider
              value={[dailyNewWords]}
              min={5}
              max={80}
              step={5}
              onValueChange={(val) => setDailyNewWords(Array.isArray(val) ? val[0] : Number(val))}
              className="py-1"
            />
            <div className="flex items-center gap-1.5 pt-1">
              {[10, 20, 35, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDailyNewWords(num)}
                  className={`flex-1 py-1 text-center rounded-lg text-xs font-mono font-medium transition-all ${
                    dailyNewWords === num
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {num} 词
                </button>
              ))}
            </div>
          </div>

          {/* 3. 目标完成日期与动态测算 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/80">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="size-3 text-muted-foreground" />
                  目标截止日 (可选)
                </label>
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => setTargetDate("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => handleTargetDateChange(e.target.value)}
                className="h-8 bg-card border-border text-xs text-foreground font-mono"
              />
            </div>
            <div className="flex flex-col justify-center gap-0.5 pl-1">
              <span className="text-[11px] text-muted-foreground">
                {targetDaysRemaining && targetDaysRemaining > 0 ? "达成目标所需速率" : "预计完成时间"}
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {targetDaysRemaining && targetDaysRemaining > 0 ? (
                  <span className="text-primary font-bold">
                    需 {requiredPace} 词 / 天 (剩 {targetDaysRemaining} 天)
                  </span>
                ) : (
                  dynamicEstimatedDate || "未设定"
                )}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                剩余未学 {unlearnedCount} 词
              </span>
            </div>
          </div>

          {/* 4. 多模块协同配额 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 影子跟读 */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <HeadphonesIcon className="size-3 text-muted-foreground" />
                  每日影子跟读
                </span>
                <span className="font-mono text-foreground font-bold">
                  {dailyShadowing > 0 ? `${dailyShadowing} 句` : "关闭"}
                </span>
              </div>
              <Slider
                value={[dailyShadowing]}
                min={0}
                max={15}
                step={1}
                onValueChange={(val) => setDailyShadowing(Array.isArray(val) ? val[0] : Number(val))}
                className="py-1"
              />
            </div>

            {/* 视听读语境输入 */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <ClockIcon className="size-3 text-muted-foreground" />
                  每日视听读时长
                </span>
                <span className="font-mono text-foreground font-bold">
                  {dailyContextMinutes > 0 ? `${dailyContextMinutes} m` : "关闭"}
                </span>
              </div>
              <Slider
                value={[dailyContextMinutes]}
                min={0}
                max={60}
                step={5}
                onValueChange={(val) => setDailyContextMinutes(Array.isArray(val) ? val[0] : Number(val))}
                className="py-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2Icon className="size-3 animate-spin" />
                保存中...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5" />
                保存计划
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

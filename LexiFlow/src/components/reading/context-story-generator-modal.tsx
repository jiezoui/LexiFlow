"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SparklesIcon,
  Loader2Icon,
  XIcon,
  PlusIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { contextStoryApi, type ContextStoryDetail, type GenerateStoryRequest } from "@/lib/api-client"
import { getActiveAiConfig, getAiSettings } from "@/lib/ai-config"

interface ContextStoryGeneratorModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (story: ContextStoryDetail) => void
}

const TOPIC_PRESETS = [
  { label: "环境生态", value: "Environment & Ecology" },
  { label: "前沿科技", value: "Technology & Artificial Intelligence" },
  { label: "学术生活", value: "Campus Life & Academic Research" },
  { label: "都市漫游", value: "Urban Culture & City Life" },
  { label: "自然探索", value: "Nature & Wilderness Exploration" },
  { label: "科幻叙事", value: "Futuristic Sci-Fi Narrative" },
]

const LEVEL_PRESETS = [
  { value: "A2", hint: "熟悉场景 · 短句" },
  { value: "B1", hint: "清晰叙事 · 适度复句" },
  { value: "B2", hint: "抽象主题 · 复杂论述" },
  { value: "C1", hint: "精细观点 · 多层句式" },
]
const EXAM_PRESETS = [
  { value: "GENERAL", label: "通用" },
  { value: "CET4", label: "四级" },
  { value: "CET6", label: "六级" },
  { value: "POSTGRAD", label: "考研" },
  { value: "IELTS", label: "雅思" },
  { value: "TOEFL", label: "托福" },
]
const VOCAB_PRESETS = [
  { count: 8, label: "轻读", length: "350–450" },
  { count: 12, label: "标准", length: "500–650" },
  { count: 16, label: "强化", length: "700–850" },
]

export function ContextStoryGeneratorModal({
  open,
  onClose,
  onSuccess,
}: ContextStoryGeneratorModalProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<string>("Environment & Ecology")
  const [targetLevel, setTargetLevel] = useState<string>("B1")
  const [examFocus, setExamFocus] = useState<string>("GENERAL")
  const [autoTargetCount, setAutoTargetCount] = useState<number>(12)
  const [availableCount, setAvailableCount] = useState<number | null>(null)
  const [customWordInput, setCustomWordInput] = useState<string>("")
  const [customWords, setCustomWords] = useState<string[]>([])
  const [isAutoFromFsrs, setIsAutoFromFsrs] = useState<boolean>(true)
  const [generating, setGenerating] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string>("")

  useEffect(() => {
    if (!open) return
    let active = true
    contextStoryApi.candidates().then((result) => {
      if (active) setAvailableCount(result.availableCount)
    }).catch(() => {
      if (active) setAvailableCount(null)
    })
    return () => { active = false }
  }, [open])

  if (!open) return null

  const targetCount = isAutoFromFsrs ? autoTargetCount : customWords.length
  const range = targetCount <= 3 ? "250–350" : targetCount <= 8 ? "350–450" : targetCount <= 12 ? "500–650" : "700–850"
  const newRepeat = targetCount > 12 ? 3 : 2
  const reviewRepeat = targetCount <= 8 ? 1 : 2

  const handleAddCustomWord = () => {
    const w = customWordInput.trim().toLowerCase()
    if (/^[a-z]+(?:'[a-z]+)?$/.test(w) && !customWords.includes(w) && customWords.length < 16) {
      setCustomWords([...customWords, w])
      setCustomWordInput("")
      setErrorMsg(null)
    } else if (w) {
      setErrorMsg("请输入未重复的英文单词原形，最多 16 个")
    }
  }

  const handleRemoveCustomWord = (w: string) => {
    setCustomWords(customWords.filter((item) => item !== w))
  }

  const handleGenerate = async () => {
    if (!isAutoFromFsrs && customWords.length === 0) {
      setErrorMsg("请先添加至少一个目标词")
      return
    }
    if (isAutoFromFsrs && availableCount !== null && availableCount < targetCount) {
      setErrorMsg(`复习词库目前可用 ${availableCount}/${targetCount} 词，请降低词汇强度或手动指定`)
      return
    }
    if (!getAiSettings().enableStoryAi) {
      setErrorMsg("请先在设置中开启语境文章")
      return
    }
    setGenerating(true)
    setErrorMsg(null)
    setStepText("正在提取候选词汇...")
    const statusTimers: ReturnType<typeof setTimeout>[] = []

    try {
      const activeConfig = getActiveAiConfig()

      const payload: GenerateStoryRequest = {
        topic,
        targetLevel,
        examFocus,
        targetCount,
        customLemmas: isAutoFromFsrs ? undefined : customWords,
        provider: activeConfig?.provider || undefined,
        model: activeConfig?.model || undefined,
        apiKey: activeConfig?.apiKey || undefined,
        apiHost: activeConfig?.apiHost || undefined,
      }

      statusTimers.push(setTimeout(() => {
        setStepText("正在生成语境短文...")
      }, 1500))

      statusTimers.push(setTimeout(() => {
        setStepText("正在生成正文与译文，并校验目标词...")
      }, 4500))

      statusTimers.push(setTimeout(() => {
        setStepText("长文生成与必要的重写可能需要 1–3 分钟，请稍候...")
      }, 15_000))

      const story = await contextStoryApi.generate(payload)

      if (onSuccess) {
        onSuccess(story)
      } else {
        onClose()
        router.push(`/reading/story/${story.publicId}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "生成失败，请检查网络或 AI 密钥配置"
      setErrorMsg(msg)
    } finally {
      statusTimers.forEach(clearTimeout)
      setGenerating(false)
      setStepText("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl transition-all sm:p-6">
        {/* 简洁 Header */}
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div>
            <h2 className="text-base font-bold text-foreground">生成语境文章</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              根据生词与主题，生成定制双语研读材料
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* 内容配置区 */}
        <div className="mt-4 space-y-4">
          {/* 目标词来源 */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              生词来源
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAutoFromFsrs(true)}
                className={`flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  isAutoFromFsrs
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                从复习词库提取
              </button>
              <button
                type="button"
                onClick={() => setIsAutoFromFsrs(false)}
                className={`flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  !isAutoFromFsrs
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                手动指定单词
              </button>
            </div>
            {isAutoFromFsrs && <p className="mt-2 text-[11px] text-muted-foreground">{availableCount === null ? "生成前会核对词库可用数量" : `复习词库当前有 ${availableCount} 个可用目标词；不足时不会用无关词凑数`}</p>}
          </div>

          {/* 手动指定词汇输入框 */}
          {!isAutoFromFsrs && (
            <div className="rounded-xl border border-border bg-muted/15 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入英文单词原形后回车 (如 paradigm)..."
                  value={customWordInput}
                  onChange={(e) => setCustomWordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomWord())}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <Button size="sm" type="button" onClick={handleAddCustomWord} className="h-7.5 px-3 text-xs">
                  <PlusIcon className="size-3.5" /> 添加
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {customWords.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono text-secondary-foreground"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomWord(w)}
                      className="hover:text-destructive text-muted-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
                {customWords.length === 0 && <span className="text-[11px] text-muted-foreground">添加 1–16 个词；手动模式只使用你指定的词</span>}
              </div>
            </div>
          )}

          {/* 题材选择 */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              文章题材
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TOPIC_PRESETS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTopic(t.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    topic === t.value
                      ? "bg-foreground text-background font-medium"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="自定义题材 (如 Space Exploration)..."
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">阅读难度</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{LEVEL_PRESETS.map((level) => <button key={level.value} type="button" onClick={() => setTargetLevel(level.value)} aria-pressed={targetLevel === level.value} className={`rounded-lg border px-2 py-2 text-left transition-colors ${targetLevel === level.value ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`}><strong className="block font-mono text-xs">{level.value}</strong><span className={`mt-1 block text-[10px] ${targetLevel === level.value ? "text-background/70" : "text-muted-foreground"}`}>{level.hint}</span></button>)}</div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">阅读难度控制句式与表达复杂度；不会与考试标签直接换算。</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">训练场景</label>
            <div className="flex flex-wrap gap-1.5">{EXAM_PRESETS.map((exam) => <button key={exam.value} type="button" onClick={() => setExamFocus(exam.value)} aria-pressed={examFocus === exam.value} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${examFocus === exam.value ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{exam.label}</button>)}</div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">词汇强度</label>
            {isAutoFromFsrs ? <div className="grid grid-cols-3 gap-2">{VOCAB_PRESETS.map((preset) => <button key={preset.count} type="button" onClick={() => setAutoTargetCount(preset.count)} aria-pressed={autoTargetCount === preset.count} className={`rounded-lg border px-2 py-2 text-left transition-colors ${autoTargetCount === preset.count ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60"}`}><strong className="block text-xs">{preset.label} · {preset.count} 词</strong><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{preset.length} 词篇幅</span></button>)}</div> : <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">手动指定 {customWords.length} 词，篇幅和复现要求会自动匹配。</p>}
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs leading-relaxed">
            <strong className="font-medium">生成预期</strong><span className="text-muted-foreground"> · {targetLevel} 阅读 · {targetCount} 个目标词 · 新词至少 {newRepeat} 次 / 复习词至少 {reviewRepeat} 次 · 预计 {range} 词</span>
          </div>

          {/* 错误提示 */}
          {errorMsg && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          {/* 生成中状态 */}
          {generating && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-center space-y-1.5">
              <Loader2Icon className="size-5 animate-spin text-primary mx-auto" />
              <p className="text-xs font-medium text-foreground">{stepText || "正在生成文章..."}</p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={generating} className="text-xs h-8">
            取消
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5 text-xs h-8 px-3.5">
            {generating ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <SparklesIcon className="size-3.5" />
                立即生成
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

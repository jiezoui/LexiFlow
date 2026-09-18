"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  SparklesIcon,
  Loader2Icon,
  XIcon,
  PlusIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { contextStoryApi, type ContextStoryDetail, type GenerateStoryRequest } from "@/lib/api-client"
import { getActiveAiConfig } from "@/lib/ai-config"

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

const LEVEL_PRESETS = ["CET-4", "CET-6", "IELTS", "TOEFL", "考研"]

export function ContextStoryGeneratorModal({
  open,
  onClose,
  onSuccess,
}: ContextStoryGeneratorModalProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<string>("Environment & Ecology")
  const [targetLevel, setTargetLevel] = useState<string>("CET-4")
  const [targetCount, setTargetCount] = useState<number>(6)
  const [customWordInput, setCustomWordInput] = useState<string>("")
  const [customWords, setCustomWords] = useState<string[]>([])
  const [isAutoFromFsrs, setIsAutoFromFsrs] = useState<boolean>(true)
  const [generating, setGenerating] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string>("")

  if (!open) return null

  const handleAddCustomWord = () => {
    const w = customWordInput.trim().toLowerCase()
    if (w && !customWords.includes(w)) {
      setCustomWords([...customWords, w])
      setCustomWordInput("")
    }
  }

  const handleRemoveCustomWord = (w: string) => {
    setCustomWords(customWords.filter((item) => item !== w))
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setErrorMsg(null)
    setStepText("正在提取候选词汇...")

    try {
      const activeConfig = getActiveAiConfig()

      const payload: GenerateStoryRequest = {
        topic,
        targetLevel,
        targetCount,
        customLemmas: isAutoFromFsrs ? undefined : customWords,
        provider: activeConfig?.provider || undefined,
        model: activeConfig?.model || undefined,
        apiKey: activeConfig?.apiKey || undefined,
        apiHost: activeConfig?.apiHost || undefined,
      }

      const timer1 = setTimeout(() => {
        setStepText("正在生成语境短文...")
      }, 1500)

      const timer2 = setTimeout(() => {
        setStepText("正在校验目标词使用与难度...")
      }, 4500)

      const story = await contextStoryApi.generate(payload)

      clearTimeout(timer1)
      clearTimeout(timer2)

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
      setGenerating(false)
      setStepText("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl transition-all">
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
          </div>

          {/* 手动指定词汇输入框 */}
          {!isAutoFromFsrs && (
            <div className="rounded-xl border border-border bg-muted/15 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入单词原形后回车 (如 paradigm)..."
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
                {customWords.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">未添加单词时将自动随机抽选</span>
                )}
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

          {/* 难度等级与词数 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">难度分级</label>
              <div className="flex flex-wrap gap-1">
                {LEVEL_PRESETS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setTargetLevel(lvl)}
                    className={`rounded-md px-2 py-1 text-xs font-mono transition-colors ${
                      targetLevel === lvl
                        ? "border border-primary bg-primary/10 text-primary font-semibold"
                        : "border border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground flex justify-between mb-1.5">
                <span>生词数量</span>
                <span className="font-mono text-primary font-semibold">{targetCount} 词</span>
              </label>
              <input
                type="range"
                min={4}
                max={9}
                step={1}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full accent-primary h-1.5"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                <span>4词</span>
                <span>6词</span>
                <span>9词</span>
              </div>
            </div>
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

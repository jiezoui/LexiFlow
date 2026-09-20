"use client"

/**
 * 视频字幕单词精析抽屉
 *
 * 在「视频 + 字幕」学习场景中，点击字幕里的任意单词会打开本抽屉：
 * 1. 展示该词在**当前字幕句**中的语境释义、语法角色、搭配与记忆法
 *    （复用 `aiApi.explainWord`，与阅读页的划词解析共用同一 AI 网关）
 * 2. 提供音标、发音试听与一键加入生词本
 * 3. 支持回到原句重听（通过 `onReplayCue` 让播放器 seek 到该字幕起点）
 *
 * 与 `word-lookup-popover` 的区别：这里是**固定侧栏抽屉**而非浮层，
 * 因为学习区已经分成「播放器 + 字幕栏」两列，抽屉叠加在字幕栏上不会遮挡视频。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircleIcon,
  BookmarkPlusIcon,
  CheckIcon,
  Loader2Icon,
  RefreshCwIcon,
  RepeatIcon,
  SparklesIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"
import {
  aiApi,
  dictApi,
  parseJsonArray,
  vocabApi,
  type AiExplainResult,
  type DictEntry,
  type MediaCue,
} from "@/lib/api-client"
import { getActiveAiConfig } from "@/lib/ai-config"

interface VideoWordDrawerProps {
  word: string
  cue: MediaCue
  onClose: () => void
  onReplayCue?: (cue: MediaCue) => void
}

export function VideoWordDrawer({
  word,
  cue,
  onClose,
  onReplayCue,
}: VideoWordDrawerProps) {
  const [entry, setEntry] = useState<DictEntry | null>(null)
  const [explain, setExplain] = useState<AiExplainResult | null>(null)
  const [loadingDict, setLoadingDict] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // 按「词 + 句子」缓存 AI 解析，避免反复点击同一处浪费额度
  const cacheRef = useRef<Map<string, AiExplainResult>>(new Map())

  const cleanWord = useMemo(
    () => word.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, "").toLowerCase(),
    [word]
  )

  const runExplain = useCallback(
    async (force = false) => {
      const key = `${cleanWord}::${cue.sourceText}`
      if (!force) {
        const cached = cacheRef.current.get(key)
        if (cached) {
          setExplain(cached)
          return
        }
      }

      setLoadingAi(true)
      setError(null)
      try {
        const config = getActiveAiConfig()
        const result = await aiApi.explainWord({
          word: cleanWord,
          contextSentence: cue.sourceText,
          provider: config.provider,
          apiHost: config.apiHost,
          apiKey: config.apiKey,
          model: config.model,
        })
        cacheRef.current.set(key, result)
        setExplain(result)
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? `${err.message}（可在「设置 → AI 模型」中检查 API Key）`
            : "AI 解析失败"
        )
      } finally {
        setLoadingAi(false)
      }
    },
    [cleanWord, cue.sourceText]
  )

  // 词或句子变化时：拉词典释义 + 触发 AI 语境解析
  useEffect(() => {
    let cancelled = false

    setEntry(null)
    setExplain(null)
    setError(null)
    setSaved(false)

    setLoadingDict(true)
    void dictApi
      .search(cleanWord, 1)
      .then((list) => {
        if (!cancelled) setEntry(list[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setEntry(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingDict(false)
      })

    void runExplain()

    return () => {
      cancelled = true
    }
  }, [cleanWord, cue.sourceText, runExplain])

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanWord)
    utterance.lang = "en-US"
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }, [cleanWord])

  const addToVocab = useCallback(async () => {
    setSaving(true)
    try {
      await vocabApi.addCard({
        lemma: cleanWord,
        wordId: entry?.id,
        source: "VIDEO",
        contextSentence: cue.sourceText,
        contextTranslation: cue.translation ?? undefined,
      })
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加入生词本失败")
    } finally {
      setSaving(false)
    }
  }, [cleanWord, cue.sourceText, cue.translation, entry?.id])

  const phonetics = [entry?.phoneticUs, entry?.phoneticUk].filter(Boolean) as string[]
  const synonyms = parseJsonArray(entry?.synonyms)

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[380px] flex-col border-l border-border bg-card shadow-2xl">
      {/* 头部 */}
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-serif text-lg font-bold text-foreground">
              {cleanWord}
            </h2>
            <button
              type="button"
              onClick={speak}
              title="试听发音"
              className="rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:text-primary"
            >
              <Volume2Icon className="size-3.5" />
            </button>
          </div>
          {phonetics.length > 0 && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {phonetics.join("  ")}
            </p>
          )}
          {entry?.pos && (
            <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {entry.pos}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="关闭"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      {/* 内容 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        {/* 当前字幕 */}
        <section className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              所在字幕
            </span>
            {onReplayCue && (
              <button
                type="button"
                onClick={() => onReplayCue(cue)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-semibold transition-colors hover:bg-muted"
              >
                <RepeatIcon className="size-3" />
                重听该句
              </button>
            )}
          </div>
          <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-foreground">
            {cue.sourceText}
          </p>
          {cue.translation && (
            <p className="mt-1 text-[11px] text-muted-foreground">{cue.translation}</p>
          )}
        </section>

        {/* 词典释义 */}
        <section>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            词典释义
          </h3>
          {loadingDict ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" /> 查询中…
            </p>
          ) : entry ? (
            <div className="mt-1.5 flex flex-col gap-1">
              <p className="text-[13px] text-foreground">{entry.definitionCn}</p>
              {entry.definitionEn && (
                <p className="text-[11px] text-muted-foreground">{entry.definitionEn}</p>
              )}
              {synonyms.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold">近义：</span>
                  {synonyms.slice(0, 6).join("、")}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              词典未收录该词形，可参考下方 AI 语境解析。
            </p>
          )}
        </section>

        {/* AI 语境解析 */}
        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <SparklesIcon className="size-3" />
              AI 语境解析
            </h3>
            <button
              type="button"
              onClick={() => void runExplain(true)}
              disabled={loadingAi}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCwIcon className={`size-3 ${loadingAi ? "animate-spin" : ""}`} />
              重解析
            </button>
          </div>

          {loadingAi && !explain ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" /> 正在结合语境分析…
            </p>
          ) : explain ? (
            <div className="mt-1.5 flex flex-col gap-2.5">
              {explain.contextMeaning && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    语境含义
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {explain.contextMeaning}
                  </p>
                </div>
              )}
              {explain.grammarRole && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    语法角色
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {explain.grammarRole}
                  </p>
                </div>
              )}
              {explain.collocations?.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    常用搭配
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {explain.collocations.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {explain.mnemonics && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    记忆法
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {explain.mnemonics}
                  </p>
                </div>
              )}
              {explain.examTips && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    考点提示
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {explain.examTips}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              暂无解析结果。
            </p>
          )}
        </section>

        {error && (
          <div className="flex items-start gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <footer className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => void addToVocab()}
          disabled={saving || saved}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            saved
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-primary text-primary-foreground hover:opacity-90"
          } disabled:opacity-70`}
        >
          {saved ? (
            <>
              <CheckIcon className="size-3.5" /> 已加入生词本
            </>
          ) : saving ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" /> 正在加入…
            </>
          ) : (
            <>
              <BookmarkPlusIcon className="size-3.5" /> 加入生词本（带语境例句）
            </>
          )}
        </button>
      </footer>
    </aside>
  )
}

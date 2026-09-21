"use client"

/**
 * 语脉 · 影子跟读智能评测工坊
 *
 * 端到端链路（全部本地推理，无需任何云端 API Key）：
 *
 *   麦克风 → Web Audio 采集成 16kHz 单声道 WAV
 *        → POST /api/speech/score_pronunciation
 *             ├─ faster-whisper ASR（词级时间戳）
 *             ├─ wav2vec2-espeak 音素 CTC 前向-后向对齐（边缘化 → GOP）
 *             └─ 三维评分 + 音素级诊断 + 教练建议
 *        → POST /api/shadowing/attempts（落库 + 计入当日打卡）
 *        → 刷新句库掌握度与训练统计
 *
 * 服务编排见 `src/app/api/speech/[...path]/route.ts`（Next.js 同源代理）
 * 与 `speech-bridge/`（Python FastAPI）。
 *
 * 状态设计：每句的练习状态（录音、评测结果、IPA）封装在 `SentenceWorkspace`
 * 子组件中，并用 `key={sentence.id}` 触发重挂载来「换句即重置」。
 * 这样切句清空状态是 React 的挂载语义，而不是在 effect 里 setState。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  FileTextIcon,
  FileUpIcon,
  HistoryIcon,
  LayersIcon,
  Loader2Icon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
  RotateCcwIcon,
  SparklesIcon,
  SquareIcon,
  TargetIcon,
  Trash2Icon,
  UploadIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"
import { AudioWaveform } from "@/components/practice/audio-waveform"
import { ShadowingVerdict } from "@/components/practice/shadowing-verdict"
import { useShadowingRecorder } from "@/hooks/use-shadowing-recorder"
import {
  shadowingApi,
  speechApi,
  type ShadowingAssessment,
  type ShadowingAttemptRecord,
  type ShadowingSentence,
  type ShadowingStats,
  type SpeechPhonemeWords,
} from "@/lib/api-client"

type SourceTab = "BBC" | "CARD" | "CUSTOM"

const SOURCE_META: Record<
  SourceTab,
  { label: string; icon: typeof SparklesIcon; description: string }
> = {
  BBC: {
    label: "BBC 外刊精选",
    icon: SparklesIcon,
    description: "真实外刊语料，覆盖经济、科技、环境等高频话题",
  },
  CARD: {
    label: "生词本例句",
    icon: BookOpenIcon,
    description: "来自你正在记忆的生词，跟读同时巩固语境",
  },
  CUSTOM: {
    label: "上传文本",
    icon: FileUpIcon,
    description: "上传 txt / srt / md 文本，自动切句后批量导入个人句库",
  },
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25] as const

/** 单次最多导入的句子数：既保护后端，也让「导入 → 立刻开练」不至于等太久。 */
const MAX_IMPORT = 50

/** 可上传的纯文本后缀（也接受浏览器判定为 text/* 的文件）。 */
const TEXT_FILE_PATTERN = /\.(txt|text|md|markdown|srt|vtt|csv|tsv|log)$/i

/** 单行超过这个长度时，按句末标点再切一次（避免一句话长到没法跟读）。 */
const LONG_LINE_THRESHOLD = 140

interface ParsedSentence {
  text: string
  translation?: string
}

/** 归一化比较键：忽略大小写、标点与空白，用于在导入前识别「重复句」。 */
function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** 去掉行首的项目符号 / 编号，例如 `1.` `2)` `-` `•`。 */
function stripLeadingMarker(line: string): string {
  return line.replace(/^(?:[-–—•*·※]|\(?\d{1,3}[.)、]|[a-zA-Z][.)])\s+/, "").trim()
}

/**
 * 把上传/粘贴的纯文本切成「一句一条」的跟读句。
 *
 * 兼容三类常见输入：
 *   - 纯文本 / Markdown：一行一句
 *   - SRT / VTT 字幕：跳过序号行与时间轴行
 *   - 带译文的对照文本：`英文 | 中文` 或 Tab 分隔（右半部分作为参考译文）
 *
 * 同一批里重复的句子只保留第一条；超长行按句末标点再切分。
 */
function parseTextToSentences(raw: string): ParsedSentence[] {
  const out: ParsedSentence[] = []
  const seen = new Set<string>()

  for (const rawLine of raw.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    if (/^WEBVTT/i.test(line)) continue
    if (/^\d+$/.test(line)) continue
    if (/^\d{1,2}:\d{2}(:\d{2})?([,.]\d{1,3})?\s*-->/.test(line)) continue

    line = stripLeadingMarker(line)
    if (!line) continue

    // 「英文 | 中文」/ Tab 分隔：右半部分当作参考译文
    let translation: string | undefined
    const sep = line.includes("\t") ? "\t" : line.includes("|") ? "|" : null
    if (sep) {
      const idx = line.indexOf(sep)
      const left = line.slice(0, idx).trim()
      const right = line.slice(idx + sep.length).trim()
      if (left) {
        line = left
        translation = right || undefined
      }
    }
    if (!line) continue

    const chunks =
      line.length > LONG_LINE_THRESHOLD ? (line.match(/[^.!?…]+[.!?…]*/g) ?? [line]) : [line]
    for (const chunk of chunks) {
      const text = chunk.trim().replace(/\s+/g, " ")
      if (text.length < 2) continue
      const key = normalizeForCompare(text)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({ text, translation: chunks.length === 1 ? translation : undefined })
    }
  }

  return out
}

function formatWhen(iso: string | null): string {
  if (!iso) return "未练习"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "未练习"
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

const MASTERY_META: Record<string, { label: string; className: string }> = {
  NEW: { label: "未练习", className: "bg-muted text-muted-foreground" },
  LEARNING: { label: "练习中", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  MASTERED: {
    label: "已掌握",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
}

/* ══════════════════════════════════════════════════════════════════════════
 * 单句练习工作区
 *
 * 由父组件用 key={sentence.id} 挂载：换句即重新挂载，所有练习状态自然重置。
 * 这样就不需要「监听 currentId 变化 → setState 清空」的 effect。
 * ══════════════════════════════════════════════════════════════════════════ */

function SentenceWorkspace({
  sentence,
  playRate,
  onSaved,
  onRequestNext,
  hasNext,
  reportHost,
}: {
  sentence: ShadowingSentence
  playRate: number
  onSaved: () => void
  onRequestNext: () => void
  hasNext: boolean
  /** 右侧「评测报告」列的挂载点：卡片在左、报告在右，由父组件给出 DOM 节点 */
  reportHost: HTMLDivElement | null
}) {
  const recorder = useShadowingRecorder()

  const [assessment, setAssessment] = useState<ShadowingAssessment | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const [phonemes, setPhonemes] = useState<SpeechPhonemeWords | null>(null)
  const [loadingPhonemes, setLoadingPhonemes] = useState(false)
  const [showPhonemes, setShowPhonemes] = useState(false)

  const [isPlayingRef, setIsPlayingRef] = useState(false)
  const [isPlayingMine, setIsPlayingMine] = useState(false)

  // 用「稳定的容器对象」持有 <audio> 实例。
  // 不把 Audio 直接存进 ref 再改它的属性：那属于「修改传给 hook 的值」，
  // React Compiler 的 immutability 规则会报错。这里的 ref 本身从不被重新赋值，
  // 只修改容器内部的字段，语义上也更清晰（这是一组播放器句柄，不是一个值）。
  const audioBox = useRef<{ ref: HTMLAudioElement | null; mine: HTMLAudioElement | null }>({
    ref: null,
    mine: null,
  })

  // 按需加载 IPA：只在用户展开时才请求，避免每句都打一次接口
  const loadPhonemes = useCallback(async () => {
    if (phonemes || loadingPhonemes) return
    setLoadingPhonemes(true)
    try {
      setPhonemes(await speechApi.phonemes(sentence.text, "en"))
    } catch {
      setPhonemes(null)
    } finally {
      setLoadingPhonemes(false)
    }
  }, [phonemes, loadingPhonemes, sentence.text])

  // 卸载时释放录音对象 URL 并停掉播放
  useEffect(
    () => () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      audioBox.current.ref?.pause()
      audioBox.current.mine?.pause()
    },
    [recordedUrl]
  )

  const stopReference = useCallback(() => {
    const audio = audioBox.current.ref
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlayingRef(false)
  }, [])

  const playReference = useCallback(() => {
    stopReference()
    // 让浏览器直接流式播放桥接服务合成的参考音（Edge 神经音色），
    // 由浏览器负责缓冲与缓存，前端无需自建 Blob。
    if (!audioBox.current.ref) audioBox.current.ref = new Audio()
    const audio = audioBox.current.ref
    audio.src = speechApi.referenceAudioUrl(sentence.text, playRate)
    audio.onended = () => setIsPlayingRef(false)
    audio.onerror = () => setIsPlayingRef(false)
    setIsPlayingRef(true)
    void audio.play().catch(() => setIsPlayingRef(false))
  }, [sentence.text, playRate, stopReference])

  const playMine = useCallback(() => {
    if (!recordedUrl) return
    if (!audioBox.current.mine) audioBox.current.mine = new Audio()
    const audio = audioBox.current.mine
    if (audio.src !== recordedUrl) audio.src = recordedUrl
    audio.currentTime = 0
    audio.onended = () => setIsPlayingMine(false)
    audio.onerror = () => setIsPlayingMine(false)
    setIsPlayingMine(true)
    void audio.play().catch(() => setIsPlayingMine(false))
  }, [recordedUrl])

  /** 用浏览器 TTS 即时试听单个单词/音素。 */
  const playWord = useCallback((word: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const clean = word.replace(/^[+“"']+|[”"',.?!:;]+$/g, "")
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = "en-US"
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }, [])

  const clearRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
  }, [recordedUrl])

  const startRecording = useCallback(async () => {
    stopReference()
    setAssessment(null)
    setEvalError(null)
    setSaveNotice(null)
    clearRecording()
    await recorder.start()
  }, [clearRecording, recorder, stopReference])

  const stopAndEvaluate = useCallback(async () => {
    const captured = await recorder.stop()
    if (!captured) return

    setRecordedUrl(URL.createObjectURL(captured.blob))
    setIsEvaluating(true)
    setEvalError(null)
    const startedAt = Date.now()

    try {
      const result = await speechApi.score(captured.blob, sentence.text, "en")
      setAssessment(result)

      // 落库 + 计入打卡。保存失败不阻断评测展示，只提示。
      try {
        await shadowingApi.submitAttempt({
          sentenceId: sentence.id,
          sourceType: sentence.sourceType,
          sourceTitle: sentence.sourceTitle,
          referenceText: sentence.text,
          transcribedText: result.transcribed_text,
          language: "en",
          overallScore: result.scores.overall,
          accuracyScore: result.scores.accuracy,
          completenessScore: result.scores.completeness,
          fluencyScore: result.scores.fluency,
          prosodyScore: result.scores.prosody,
          grade: result.grade,
          correctCount: result.counts.correct,
          substitutionCount: result.counts.substitution,
          omissionCount: result.counts.omission,
          insertionCount: result.counts.insertion,
          poorPhonemeCount: result.counts.poor_phonemes,
          totalPhonemeCount: result.counts.total_phonemes,
          wordsPerMinute: result.timing.words_per_minute,
          audioDurationMs: Math.round(result.timing.duration_seconds * 1000),
          analysisMs: result.processing_ms,
          detailJson: JSON.stringify({
            words: result.words,
            counts: result.counts,
            timing: result.timing,
          }),
          suggestionsJson: JSON.stringify(result.suggestions),
          engineJson: JSON.stringify(result.engine),
          practiceSeconds: Math.max(
            1,
            Math.round((Date.now() - startedAt + captured.durationMs) / 1000)
          ),
        })
        setSaveNotice("已记入练习历史与今日打卡")
        onSaved()
      } catch (saveErr: unknown) {
        setSaveNotice(
          `评测完成，但历史记录保存失败：${
            saveErr instanceof Error ? saveErr.message : "未知错误"
          }`
        )
      }
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : "发音评测失败，请重试")
    } finally {
      setIsEvaluating(false)
    }
  }, [onSaved, recorder, sentence])

  const seconds = Math.floor(recorder.elapsedMs / 1000)

  return (
    <>
      {/* 主体卡片：撑满左列剩余高度（不滚动），句子区在中间垂直居中 */}
      <div className="flex min-h-[300px] flex-1 flex-col gap-3 rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/90 p-4 shadow-md sm:gap-4 sm:p-6">
        {/* 元数据 + 参考音 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
              {sentence.sourceTitle}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
              CEFR {sentence.cefrLevel}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {sentence.wordCount} 词 · {formatWhen(sentence.lastPracticedAt)}
              {sentence.bestScore !== null && ` · 最高 ${Math.round(sentence.bestScore)}`}
              {sentence.attemptCount > 0 && ` · 已练 ${sentence.attemptCount} 次`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPhonemes((v) => !v)
                void loadPhonemes()
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                showPhonemes
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <SparklesIcon className="size-3" />
              IPA 音标
            </button>
            <button
              type="button"
              onClick={() => (isPlayingRef ? stopReference() : playReference())}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                isPlayingRef
                  ? "animate-pulse bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {isPlayingRef ? (
                <>
                  <PauseIcon className="size-3.5" /> 播放中
                </>
              ) : (
                <>
                  <Volume2Icon className="size-3.5" /> 播放标准原声 ({playRate}x)
                </>
              )}
            </button>
          </div>
        </div>

        {/* 基准句 + 译文 + IPA：与波形各占一半弹性空间，句子随高度自动放大 */}
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
          <p className="font-serif text-[clamp(1.25rem,3vh,2rem)] leading-snug font-bold tracking-tight text-foreground">
            &ldquo;{sentence.text}&rdquo;
          </p>
          {sentence.translation && (
            <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {sentence.translation}
            </p>
          )}

          {showPhonemes && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-3">
              {loadingPhonemes ? (
                <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <Loader2Icon className="size-3 animate-spin" /> 正在生成 IPA 音标…
                </span>
              ) : phonemes ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {phonemes.words.map((w, i) => (
                    <span key={`${w.word}-${i}`} className="flex flex-col">
                      <span className="font-serif text-[13px] font-semibold text-foreground">
                        {w.word}
                      </span>
                      <span className="font-mono text-[11px] text-primary">
                        /{w.ipa.replace(/^\/|\/$/g, "")}/
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground">
                  音标服务暂不可用，请确认语音桥接服务已启动
                </span>
              )}
            </div>
          )}
        </div>

        {/* 实时波形：随卡片剩余高度伸展（上下限都留了约束，短屏也不会把内容挤出卡片） */}
        <AudioWaveform
          isRecording={recorder.isRecording}
          audioStream={null}
          waveform={recorder.waveform}
          level={recorder.level}
          elapsedMs={recorder.elapsedMs}
          className="max-h-48 min-h-16 w-full flex-1"
        />

        {/* 录音控制区（固定在卡片底部） */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 border-t border-border/60 pt-3">
          {recorder.isRecording && (
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                <span className="size-2 animate-ping rounded-full bg-rose-500" />
                REC {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">电平</span>
                <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.round(recorder.level * 100)}%` }}
                  />
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {!recorder.isRecording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={isEvaluating}
                className="flex items-center gap-2.5 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/20">
                  <MicIcon className="size-4" />
                </span>
                {assessment ? "重新跟读本句" : "开始跟读"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopAndEvaluate()}
                className="flex animate-pulse items-center gap-2.5 rounded-2xl bg-rose-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-rose-700 active:scale-95"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                  <SquareIcon className="size-4 fill-white" />
                </span>
                结束并评测
              </button>
            )}

            {recordedUrl && !recorder.isRecording && (
              <button
                type="button"
                onClick={() => (isPlayingMine ? setIsPlayingMine(false) : playMine())}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <PlayIcon className="size-3.5" />
                {isPlayingMine ? "回放中…" : "回放我的录音 [B]"}
              </button>
            )}

            {(assessment || recordedUrl) && !recorder.isRecording && (
              <button
                type="button"
                onClick={() => {
                  clearRecording()
                  setAssessment(null)
                  setEvalError(null)
                  setSaveNotice(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-3 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <RotateCcwIcon className="size-3.5" />
                清空
              </button>
            )}
          </div>

          <p className="text-center font-mono text-[11px] text-muted-foreground">
            {recorder.isRecording
              ? "正在采集 16kHz 单声道音频，读完请点击「结束并评测」"
              : assessment
              ? "已出分：先看「本轮反馈」的主要问题，按提示调整口型后再重录一遍"
              : "建议先听 1~2 遍标准原声，再模仿母语者的语流、连读与重音跟读"}
          </p>

          {recorder.error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircleIcon className="size-3.5" />
              {recorder.error}
            </div>
          )}
        </div>
      </div>

      {/* A/B 听觉对比 + 换句：属于「练习动作」，留在左列卡片下方 */}
      {assessment && !isEvaluating && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-foreground">声学听觉对比</span>
            <button
              type="button"
              onClick={playReference}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-muted"
            >
              <Volume2Icon className="size-3.5 text-primary" />
              母语原声 [A]
            </button>
            {recordedUrl && (
              <button
                type="button"
                onClick={playMine}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <PlayIcon className="size-3.5" />
                我的跟读 [B]
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void startRecording()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-muted"
            >
              <RotateCcwIcon className="size-3.5" />
              重录本句
            </button>
            {hasNext && (
              <button
                type="button"
                onClick={onRequestNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                跟读下一句
                <ArrowRightIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/*
       * 评测报告（评测中 / 失败 / 得分与三选项卡）渲染到父组件提供的右列挂载点。
       * 用 portal 而不是把状态提到页面：练习状态继续由本组件按 key={sentence.id}
       * 持有并随换句重挂载，「左练习 / 右报告」只是同一份状态的两种摆放方式。
       */}
      {reportHost
        ? createPortal(
            <div className="flex flex-col gap-2.5">
              {/* 评测中 */}
              {isEvaluating && (
                <div className="flex flex-col items-center justify-center gap-2.5 rounded-3xl border border-border bg-card/60 p-8">
                  <Loader2Icon className="size-8 animate-spin text-primary" />
                  <p className="font-mono text-sm font-semibold text-foreground">正在评测发音…</p>
                  <p className="max-w-md text-center font-mono text-[11px] text-muted-foreground">
                    Whisper 转写 → 音素 CTC 前向-后向强制对齐 → GOP 打分，CPU 推理通常 2~5 秒
                  </p>
                </div>
              )}

              {/* 评测错误 */}
              {evalError && !isEvaluating && (
                <div className="flex flex-col gap-2 rounded-3xl border border-rose-500/40 bg-rose-500/5 p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                    <AlertCircleIcon className="size-4" />
                    评测失败
                  </div>
                  <p className="text-xs text-muted-foreground">{evalError}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    排查顺序：① 语音桥接服务是否运行（scripts\start-speech-bridge.ps1）
                    ② 麦克风是否授权 ③ 录音是否过短
                  </p>
                </div>
              )}

              {/* 评测结果 */}
              {assessment && !isEvaluating && (
                <>
                  {saveNotice && (
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] ${
                        saveNotice.includes("失败")
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {saveNotice.includes("失败") ? (
                        <AlertCircleIcon className="size-3.5" />
                      ) : (
                        <CheckCircle2Icon className="size-3.5" />
                      )}
                      {saveNotice}
                      {!assessment.engine.phoneme_alignment &&
                        " · 本次为词级评分（音素模型未就绪）"}
                    </div>
                  )}

                  <ShadowingVerdict result={assessment} onPlayWord={playWord} />
                </>
              )}
            </div>,
            reportHost
          )
        : null}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function ShadowingPracticePage() {
  const [activeTab, setActiveTab] = useState<SourceTab>("BBC")
  const [sentences, setSentences] = useState<ShadowingSentence[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [loadingSentences, setLoadingSentences] = useState(true)
  const [sentenceError, setSentenceError] = useState<string | null>(null)

  const [playRate, setPlayRate] = useState<number>(1.0)

  const [stats, setStats] = useState<ShadowingStats | null>(null)
  const [history, setHistory] = useState<ShadowingAttemptRecord[]>([])

  const [uploadedText, setUploadedText] = useState("")
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 右侧「评测报告」列的挂载点：由 <SentenceWorkspace> 用 portal 往里渲染报告
  const [reportHost, setReportHost] = useState<HTMLDivElement | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  const loadSentences = useCallback(async (): Promise<ShadowingSentence[]> => {
    const list = await shadowingApi.listSentences({ limit: 300 })
    setSentences(list)
    return list
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        shadowingApi.stats(),
        shadowingApi.listAttempts({ page: 1, size: 8 }),
      ])
      setStats(s)
      setHistory(h.records)
    } catch {
      // 统计失败不影响主流程
    }
  }, [])

  const refreshAfterSave = useCallback(() => {
    setToast("已记入练习历史与今日打卡")
    void loadSentences().catch(() => undefined)
    void loadStats()
  }, [loadSentences, loadStats])

  // 首次挂载：并行拉取句库、统计与桥接健康状态。
  // 全部 setState 都发生在 await 之后（即微任务回调中），不是在 effect 体内同步调用。
  //
  // 请求轨迹可通过 `window.__LEXIFLOW_API_LOG__` 查看（见 api-client 的 traceApi），
  // 便于在无头浏览器/联调时判断是「请求没发出」还是「响应被拒」。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await shadowingApi.listSentences({ limit: 300 })
        if (cancelled) return
        setSentences(list)
        const first = list.find((s) => s.sourceType === "BBC") ?? list[0]
        setCurrentId(first?.id ?? null)
      } catch (err: unknown) {
        if (!cancelled) {
          setSentenceError(err instanceof Error ? err.message : "跟读句库加载失败")
        }
      } finally {
        if (!cancelled) setLoadingSentences(false)
      }

      try {
        const [s, h] = await Promise.all([
          shadowingApi.stats(),
          shadowingApi.listAttempts({ page: 1, size: 8 }),
        ])
        if (!cancelled) {
          setStats(s)
          setHistory(h.records)
        }
      } catch {
        /* 统计失败忽略 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 提示条自动消失
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const tabSentences = useMemo(
    () => sentences.filter((s) => s.sourceType === activeTab),
    [sentences, activeTab]
  )

  // 当前句从「渲染期派生」而不是用 effect 同步：
  // 若 currentId 不在当前标签下，则回退到该标签的第一句。
  const current = useMemo(() => {
    if (tabSentences.length === 0) return null
    return tabSentences.find((s) => s.id === currentId) ?? tabSentences[0]
  }, [tabSentences, currentId])

  const currentIndex = useMemo(
    () => (current ? tabSentences.findIndex((s) => s.id === current.id) : -1),
    [tabSentences, current]
  )
  const nextSentence = currentIndex >= 0 ? tabSentences[currentIndex + 1] : undefined

  const selectTab = useCallback(
    (tab: SourceTab) => {
      setActiveTab(tab)
      const first = sentences.find((s) => s.sourceType === tab)
      setCurrentId(first?.id ?? null)
    },
    [sentences]
  )

  /** 上传/粘贴的文本解析结果：一次 parse，导入与预览共用。 */
  const parsedSentences = useMemo(() => parseTextToSentences(uploadedText), [uploadedText])

  const handleTextFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      if (file.size > 512 * 1024) {
        setSentenceError("文本文件过大（超过 512KB），请拆分后再上传")
        return
      }
      if (!TEXT_FILE_PATTERN.test(file.name) && !file.type.startsWith("text/")) {
        setSentenceError("仅支持 txt / md / srt / vtt / csv 等纯文本文件")
        return
      }
      setReadingFile(true)
      setSentenceError(null)
      try {
        const text = await file.text()
        setUploadedText(text)
        setUploadedFileName(file.name)
        setToast(`已读取 ${file.name}`)
      } catch {
        setSentenceError("文本读取失败，请换一个文件重试")
      } finally {
        setReadingFile(false)
      }
    },
    []
  )

  /**
   * 批量导入：逐句调用导入接口（后端对同句自动去重），
   * 单句失败不中断整批，最后统一汇报「导入 / 跳过 / 失败」的数量。
   */
  const handleImportBatch = useCallback(async () => {
    if (parsedSentences.length === 0 || importing) return
    const batch = parsedSentences.slice(0, MAX_IMPORT)
    const existing = new Set(
      sentences.filter((s) => s.sourceType === "CUSTOM").map((s) => normalizeForCompare(s.text))
    )
    const sourceTitle = uploadedFileName
      ? uploadedFileName.replace(/\.[^.]+$/, "").slice(0, 60)
      : "上传文本"

    setImporting(true)
    setSentenceError(null)
    let created = 0
    let skipped = 0
    let failed = 0
    let firstId: number | null = null

    for (const [index, item] of batch.entries()) {
      setImportProgress(`${index + 1}/${batch.length}`)
      if (existing.has(normalizeForCompare(item.text))) {
        skipped += 1
        continue
      }
      try {
        const vo = await shadowingApi.createSentence({
          text: item.text,
          translation: item.translation,
          cefrLevel: "B2",
          sourceTitle,
        })
        existing.add(normalizeForCompare(item.text))
        created += 1
        if (firstId === null) firstId = vo.id
      } catch {
        failed += 1
      }
    }

    try {
      const list = await loadSentences()
      setActiveTab("CUSTOM")
      setCurrentId(firstId ?? list.find((s) => s.sourceType === "CUSTOM")?.id ?? null)
    } catch {
      // 刷新失败不影响导入结果提示
    }

    const tail = parsedSentences.length > MAX_IMPORT ? `（单次上限 ${MAX_IMPORT} 句，剩余请再次导入）` : ""
    setToast(
      `已导入 ${created} 句${skipped ? `，跳过重复 ${skipped} 句` : ""}${
        failed ? `，失败 ${failed} 句` : ""
      }${tail}`
    )
    setUploadedText("")
    setUploadedFileName(null)
    setImportProgress(null)
    setImporting(false)
  }, [parsedSentences, importing, sentences, uploadedFileName, loadSentences])

  const handleDeleteCustom = useCallback(
    async (id: number) => {
      try {
        await shadowingApi.deleteSentence(id)
        const list = await loadSentences()
        if (currentId === id) {
          const next =
            list.find((s) => s.sourceType === "CUSTOM") ??
            list.find((s) => s.sourceType === "BBC")
          setCurrentId(next?.id ?? null)
        }
      } catch (err: unknown) {
        setSentenceError(err instanceof Error ? err.message : "删除失败")
      }
    },
    [currentId, loadSentences]
  )

  return (
    // 高度链：shell 侧栏留白 1rem + 顶栏 4rem ⇒ 可视区高 = 100svh - 5rem。
    // 这里刻意不用 flex-1：flex-basis:0 会让 height 失效、页面被内容撑高，
    // 从而出现整页滚动条。改用确定高度 + overflow-hidden，滚动交给两列内部。
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 p-4 pt-2 md:px-6 lg:h-[calc(100svh-5rem)] lg:overflow-hidden">
      {/* ══ 标题（一行放下：技术标签 + 标题 + 一句话说明）══ */}
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
          语脉 · 影子跟读智能评测工坊
        </h1>
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
          <RadioIcon className="size-3" />
          Acoustic Shadowing · Forced Alignment · Phoneme GOP
        </span>
        <span className="hidden text-[11px] text-muted-foreground xl:inline">
          本地 Whisper ASR × wav2vec2 音素 CTC 强制对齐，逐音素给出后验概率与发音诊断
        </span>
      </header>

      {/* grid-rows-[minmax(0,1fr)]：把唯一一行的高度钉死在可视区内，
          这样两列内部的 overflow-y-auto 才会生效，而不是把页面撑高。
          左列＝跟读练习，右列＝评测报告（本轮反馈 / 逐词发音 / 完整分析）+ 训练统计 */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)]">
        {/* ══════════ 主工作区 ══════════ */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {/* 题源标签 + 语速 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/40 p-1.5">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1">
              {(Object.keys(SOURCE_META) as SourceTab[]).map((key) => {
                const meta = SOURCE_META[key]
                const count = sentences.filter((s) => s.sourceType === key).length
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectTab(key)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      activeTab === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <meta.icon className="size-3.5" />
                    {meta.label}
                    <span className="rounded-full bg-black/10 px-1.5 font-mono text-[10px] dark:bg-white/10">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-1.5 px-2 font-mono text-xs text-muted-foreground">
              <span>原声语速</span>
              {SPEED_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlayRate(rate)}
                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors ${
                    playRate === rate
                      ? "border border-primary/30 bg-primary/20 text-primary"
                      : "hover:text-foreground"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* 上传文本（替代原来的「自主输入句子」：上传/拖入文本文件，或直接粘贴多行文本） */}
          {activeTab === "CUSTOM" && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                void handleTextFile(e.dataTransfer.files?.[0])
              }}
              className={`flex shrink-0 flex-col gap-2 rounded-2xl border bg-card/70 p-3 transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileUpIcon className="size-4 shrink-0 text-primary" />
                  <span className="text-xs font-bold text-foreground">上传跟读文本</span>
                  {uploadedFileName ? (
                    <span className="flex min-w-0 items-center gap-1 truncate rounded-lg bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      <FileTextIcon className="size-3 shrink-0" />
                      <span className="truncate">{uploadedFileName}</span>
                    </span>
                  ) : (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      支持 txt / md / srt / vtt / csv，拖进来即可
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.text,.md,.markdown,.srt,.vtt,.csv,.tsv,.log,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    void handleTextFile(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={readingFile}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {readingFile ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <UploadIcon className="size-3.5" />
                    )}
                    选择文本文件
                  </button>
                  {(uploadedText || uploadedFileName) && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedText("")
                        setUploadedFileName(null)
                      }}
                      className="rounded-xl border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={3}
                value={uploadedText}
                onChange={(e) => {
                  setUploadedText(e.target.value)
                  if (uploadedFileName) setUploadedFileName(null)
                }}
                placeholder={
                  "把英文文本粘贴到这里，或把 .txt / .srt 文件拖进本区域…\n每行一句；需要参考译文时写成「英文 | 中文」或用 Tab 分隔。"
                }
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    已识别 {parsedSentences.length} 句
                  </span>
                  {parsedSentences.length > MAX_IMPORT && (
                    <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                      单次最多导入 {MAX_IMPORT} 句
                    </span>
                  )}
                  {parsedSentences.slice(0, 3).map((item, i) => (
                    <span
                      key={`${item.text}-${i}`}
                      className="max-w-[220px] truncate rounded-lg border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                      title={item.text}
                    >
                      {item.text}
                    </span>
                  ))}
                  {parsedSentences.length > 3 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      … 等 {parsedSentences.length} 句
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleImportBatch()}
                  disabled={parsedSentences.length === 0 || importing}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin" />
                      导入中 {importProgress}
                    </>
                  ) : (
                    <>
                      <FileUpIcon className="size-3.5" />
                      导入 {Math.min(parsedSentences.length, MAX_IMPORT)} 句到句库
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                {SOURCE_META.CUSTOM.description} · 导入后永久保存在个人句库中，重复句会自动合并
              </p>
            </div>
          )}

          {/* 句子选择器 */}
          {tabSentences.length > 0 && (
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">题目</span>
              {tabSentences.map((item, idx) => {
                const mastery = MASTERY_META[item.masteryStatus] ?? MASTERY_META.NEW
                const isActive = item.id === current?.id
                return (
                  <div key={item.id} className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentId(item.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                        isActive
                          ? "border-primary/40 bg-primary/10 font-bold text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60">{idx + 1}</span>
                      <span className="max-w-[200px] truncate font-serif">
                        {item.text.slice(0, 30)}
                        {item.text.length > 30 ? "…" : ""}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${mastery.className}`}
                      >
                        {item.bestScore !== null ? Math.round(item.bestScore) : mastery.label}
                      </span>
                    </button>
                    {item.sourceType === "CUSTOM" && isActive && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteCustom(item.id)}
                        title="删除该自定义句"
                        className="ml-1 rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-600"
                      >
                        <Trash2Icon className="size-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {sentenceError && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircleIcon className="size-3.5" />
              {sentenceError}
            </div>
          )}

          {/* 主体（跟读卡片 + A/B）：本列**不滚动**，卡片自动撑满剩余高度 */}
          <div
            data-testid="shadowing-practice-column"
            className="flex min-h-0 flex-1 flex-col gap-2.5"
          >
            {loadingSentences ? (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-3xl border border-border bg-card/60 p-10 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                正在加载跟读句库…
              </div>
            ) : !current ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
                <LayersIcon className="size-7 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">该题源下还没有跟读句</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {activeTab === "CUSTOM"
                    ? "在上方上传或粘贴英文文本并导入，即可开始跟读练习。"
                    : "换一个题源，或先在生词本中添加卡片例句。"}
                </p>
              </div>
            ) : (
              // key 让「换句」变成重新挂载：录音、评测结果、IPA 状态自然清空
              <SentenceWorkspace
                key={current.id}
                sentence={current}
                playRate={playRate}
                onSaved={refreshAfterSave}
                hasNext={Boolean(nextSentence)}
                reportHost={reportHost}
                onRequestNext={() => {
                  if (nextSentence) setCurrentId(nextSentence.id)
                }}
              />
            )}
          </div>
        </div>

        {/* ══════════ 右栏：评测报告 + 训练统计（本列内部滚动） ══════════ */}
        <aside
          data-testid="shadowing-report-column"
          className="flex min-h-0 min-w-0 flex-col gap-2.5 lg:overflow-y-auto lg:pr-1"
        >
          {/* 评测报告挂载点：工作区通过 portal 把「本轮反馈 / 逐词发音 / 完整分析」渲染进来 */}
          <div ref={setReportHost} className="flex shrink-0 flex-col gap-2.5" />

          {stats && stats.weakPhonemes.length > 0 && (
            <section className="shrink-0 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <TargetIcon className="size-3.5" />
                  重点打磨音素
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  TOP {Math.min(stats.weakPhonemes.length, 5)}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {stats.weakPhonemes.slice(0, 5).map((p) => (
                  <div
                    key={p.phoneme}
                    className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 px-2 py-1.5"
                    title={p.hint}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window === "undefined" || !("speechSynthesis" in window)) return
                        window.speechSynthesis.cancel()
                        const u = new SpeechSynthesisUtterance(p.phoneme)
                        u.lang = "en-US"
                        u.rate = 0.7
                        window.speechSynthesis.speak(u)
                      }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 font-mono text-sm font-bold text-rose-600 dark:text-rose-400"
                      title="试听该音素"
                    >
                      {p.phoneme}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {p.hint}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-bold text-foreground">
                      {p.averageScore}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {stats && stats.totalAttempts > 0 && (
            <section className="shrink-0 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ActivityIcon className="size-3.5" />
                近 14 天得分趋势
              </div>
              <div className="mt-2 flex h-16 items-end gap-1">
                {stats.trend.map((d) => {
                  const height = d.attempts > 0 ? Math.max(6, (d.averageScore / 100) * 58) : 3
                  return (
                    <div
                      key={d.date}
                      className="flex flex-1 items-end"
                      title={`${d.date} · ${d.attempts} 次 · 平均 ${d.averageScore}`}
                    >
                      <div
                        className={`w-full rounded-sm transition-all ${
                          d.attempts === 0
                            ? "bg-muted"
                            : d.averageScore >= 85
                            ? "bg-emerald-500"
                            : d.averageScore >= 70
                            ? "bg-sky-500"
                            : "bg-amber-500"
                        }`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{stats.trend[0]?.date.slice(5)}</span>
                <span>
                  均 {stats.averageScore} · 最高 {stats.bestScore} · 今日 {stats.todayAttempts} 次
                </span>
                <span>今天</span>
              </div>
            </section>
          )}

          <section className="shrink-0 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <HistoryIcon className="size-3.5" />
                练习历史
              </div>
              {history.length > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  最近 {Math.min(history.length, 5)} 条
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                还没有跟读记录。完成第一次评测后，这里会显示得分曲线。
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {history.slice(0, 5).map((h) => {
                  const tone =
                    h.overallScore >= 85
                      ? "text-emerald-600 dark:text-emerald-400"
                      : h.overallScore >= 70
                      ? "text-sky-600 dark:text-sky-400"
                      : h.overallScore >= 60
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        if (h.sentenceId === null) return
                        const target = sentences.find((s) => s.id === h.sentenceId)
                        if (!target) return
                        setActiveTab(target.sourceType)
                        setCurrentId(target.id)
                      }}
                      className="flex items-start gap-2 rounded-xl border border-border/70 bg-background/50 px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className={`font-mono text-base font-bold ${tone}`}>
                        {Math.round(h.overallScore)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-[11px] text-foreground">
                          {h.referenceText}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {new Date(h.createdAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          准确 {Math.round(h.accuracyScore)} / 完整{" "}
                          {Math.round(h.completenessScore)} / 流利 {Math.round(h.fluencyScore)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <details className="rounded-2xl border border-border/70 bg-muted/30 p-3">
            <summary className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              影子跟读法要点
            </summary>
            <ol className="mt-2 flex flex-col gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <li>1. 先盲听 1~2 遍原声，抓住意群与重音位置</li>
              <li>2. 与原声同步开口（比原声慢半拍），模仿语调与连读</li>
              <li>3. 录音后先看「准确度」再看「流利度」——先读准再读快</li>
              <li>4. 针对标红的音素，按教练提示调整舌位与口型后重录</li>
            </ol>
          </details>
        </aside>
      </div>

      {toast && (
        <aside
          aria-live="polite"
          className="fixed top-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border/80 bg-card/95 px-4 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md"
        >
          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
          <span className="max-w-[420px] truncate">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </aside>
      )}
    </div>
  )
}

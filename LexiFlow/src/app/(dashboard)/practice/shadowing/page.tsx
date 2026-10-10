"use client"

/**
 * 语脉 · 影子跟读智能评测工坊
 *
 * 端到端链路（全部本地推理，无需任何云端 API Key）：
 *
 *   麦克风 → Web Audio 采集成 16kHz 单声道 WAV，或上传预录音频
 *        → POST /api/speech/score_pronunciation
 *             ├─ faster-whisper ASR（词级时间戳）
 *             ├─ wav2vec2-espeak 音素概率与 CTC Viterbi 对齐
 *             └─ 三维评分 + 音素级诊断 + 教练建议
 *        → POST /api/shadowing/attempts（麦克风录音或主动选择计入记录的上传音频）
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
  BookmarkIcon,
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
  PodcastIcon,
  SearchIcon,
  SparklesIcon,
  SquareIcon,
  TargetIcon,
  Trash2Icon,
  UploadIcon,
  VideoIcon,
  Volume2Icon,
  XIcon,
  ChevronDownIcon,
  CheckIcon,
} from "lucide-react"
import { AudioWaveform } from "@/components/practice/audio-waveform"
import { ShadowingVerdict } from "@/components/practice/shadowing-verdict"
import { ProgressScrollArea } from "@/components/ui/progress-scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useShadowingRecorder } from "@/hooks/use-shadowing-recorder"
import {
  mediaApi,
  readingApi,
  shadowingApi,
  speechApi,
  vocabApi,
  type MediaItem,
  type ReadingArticle,
  type ShadowingAssessment,
  type ShadowingAttemptRecord,
  type ShadowingSentence,
  type ShadowingStats,
  type SpeechPhonemeWords,
} from "@/lib/api-client"

type SourceTab = "ARTICLE" | "VIDEO" | "PODCAST" | "CARD" | "BBC" | "MEDIA" | "CUSTOM"
type PracticeSentence = Omit<ShadowingSentence, "sourceType"> & {
  sourceType: SourceTab
  persisted?: boolean
  paragraphIndex?: number
  startMs?: number
}
const ASSET_TABS: SourceTab[] = ["ARTICLE", "VIDEO", "PODCAST"]
const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024
const AUDIO_FILE_PATTERN = /\.(wav|mp3|flac|ogg|m4a|webm)$/i

async function fetchSentenceLibrary(): Promise<ShadowingSentence[]> {
  const [all, media] = await Promise.all([
    shadowingApi.listSentences({ limit: 500 }),
    shadowingApi.listSentences({ sourceType: "MEDIA", limit: 500 }),
  ])
  return [...all.filter((sentence) => sentence.sourceType !== "MEDIA"), ...media]
}

const SOURCE_META: Record<
  SourceTab,
  { label: string; icon: typeof SparklesIcon; description: string }
> = {
  ARTICLE: {
    label: "语境文章",
    icon: BookOpenIcon,
    description: "从阅读文章中选择一篇进行跟读练习",
  },
  VIDEO: {
    label: "视频",
    icon: VideoIcon,
    description: "选择已导入的视频进行连续字幕跟读",
  },
  PODCAST: {
    label: "播客",
    icon: PodcastIcon,
    description: "选择已导入的播客进行原声跟读",
  },
  BBC: {
    label: "精选短句",
    icon: SparklesIcon,
    description: "预置的独立练习句；完整文章请从语境文章中选择",
  },
  CARD: {
    label: "生词本例句",
    icon: BookOpenIcon,
    description: "来自你正在记忆的生词，跟读同时巩固语境",
  },
  MEDIA: {
    label: "收藏句子",
    icon: BookmarkIcon,
    description: "从视频和播客精听字幕中收藏的句子",
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

function makeSourceSentence(
  id: number,
  sourceType: "ARTICLE" | "VIDEO" | "PODCAST" | "CARD",
  sourceTitle: string,
  text: string,
  translation: string,
  cefrLevel: string,
  context?: { paragraphIndex?: number; startMs?: number }
): PracticeSentence {
  return {
    id,
    sourceType,
    sourceTitle,
    text,
    translation,
    cefrLevel,
    wordCount: text.trim().split(/\s+/).length,
    tags: null,
    attemptCount: 0,
    bestScore: null,
    lastScore: null,
    lastPracticedAt: null,
    masteryStatus: "NEW",
    persisted: false,
    ...context,
  }
}

function formatCueTime(startMs: number): string {
  const totalSeconds = Math.floor(startMs / 1000)
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`
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
  onReportChange,
  hasNext,
  position,
  total,
  hasContext,
  reportHost,
}: {
  sentence: PracticeSentence
  playRate: number
  onSaved: () => void
  onRequestNext: () => void
  onReportChange: (visible: boolean) => void
  hasNext: boolean
  position: number
  total: number
  hasContext: boolean
  /** 右侧「评测报告」列的挂载点：卡片在左、报告在右，由父组件给出 DOM 节点 */
  reportHost: HTMLDivElement | null
}) {
  const recorder = useShadowingRecorder()

  const [assessment, setAssessment] = useState<ShadowingAssessment | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedSource, setRecordedSource] = useState<"microphone" | "upload" | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)
  const [saveUploadedAttempt, setSaveUploadedAttempt] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const [phonemes, setPhonemes] = useState<SpeechPhonemeWords | null>(null)
  const [loadingPhonemes, setLoadingPhonemes] = useState(false)
  const [showPhonemes, setShowPhonemes] = useState(false)

  const [isPlayingRef, setIsPlayingRef] = useState(false)
  const [isPlayingMine, setIsPlayingMine] = useState(false)

  useEffect(() => {
    if (!assessment || !reportHost) return
    const frame = requestAnimationFrame(() => {
      reportHost.scrollTo({ top: 0, behavior: "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [assessment, reportHost])

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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    const audio = audioBox.current.ref
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlayingRef(false)
  }, [])

  const playFallbackSpeech = useCallback((text: string, rate: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsPlayingRef(false)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = rate
    utterance.onend = () => setIsPlayingRef(false)
    utterance.onerror = () => setIsPlayingRef(false)
    setIsPlayingRef(true)
    window.speechSynthesis.speak(utterance)
  }, [])

  const playReference = useCallback(() => {
    stopReference()
    // 优先播放语音桥接服务的 Edge 神经音色，若加载失败自动回退到浏览器本地 TTS，确保 100% 可听
    if (!audioBox.current.ref) audioBox.current.ref = new Audio()
    const audio = audioBox.current.ref
    audio.src = speechApi.referenceAudioUrl(sentence.text, playRate)
    audio.onended = () => setIsPlayingRef(false)
    audio.onerror = () => {
      playFallbackSpeech(sentence.text, playRate)
    }
    setIsPlayingRef(true)
    audio.play().catch(() => {
      playFallbackSpeech(sentence.text, playRate)
    })
  }, [sentence.text, playRate, stopReference, playFallbackSpeech])

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
    audioBox.current.mine?.pause()
    setRecordedUrl(null)
    setRecordedSource(null)
    setUploadFileName(null)
    setIsPlayingMine(false)
  }, [recordedUrl])

  const startRecording = useCallback(async () => {
    stopReference()
    onReportChange(false)
    setAssessment(null)
    setEvalError(null)
    setSaveNotice(null)
    clearRecording()
    await recorder.start()
  }, [clearRecording, onReportChange, recorder, stopReference])

  const evaluateAudio = useCallback(async (
    audio: Blob,
    source: "microphone" | "upload",
    durationMs = 0,
    fileName?: string
  ) => {
    clearRecording()
    setAssessment(null)
    setSaveNotice(null)
    setRecordedUrl(URL.createObjectURL(audio))
    setRecordedSource(source)
    setUploadFileName(source === "upload" ? fileName ?? "录音文件" : null)
    onReportChange(true)
    setIsEvaluating(true)
    setEvalError(null)
    const startedAt = Date.now()
    const shouldSaveAttempt = source === "microphone" || saveUploadedAttempt

    try {
      const result = await speechApi.score(audio, sentence.text, "en")
      setAssessment(result)

      if (!result.engine.phoneme_alignment) {
        setSaveNotice("仅词级参考分，未计入练习历史与今日打卡")
        return
      }
      if (!shouldSaveAttempt) {
        setSaveNotice("上传录音已完成评测，未计入练习历史与今日打卡")
        return
      }

      // 落库 + 计入打卡。保存失败不阻断评测展示，只提示。
      try {
        await shadowingApi.submitAttempt({
          sentenceId: sentence.persisted === false ? undefined : sentence.id,
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
          practiceSeconds: source === "upload"
            ? Math.max(1, Math.round(result.timing.duration_seconds))
            : Math.max(1, Math.round((Date.now() - startedAt + durationMs) / 1000)),
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
  }, [clearRecording, onReportChange, onSaved, saveUploadedAttempt, sentence])

  const stopAndEvaluate = useCallback(async () => {
    const captured = await recorder.stop()
    if (captured) await evaluateAudio(captured.blob, "microphone", captured.durationMs)
  }, [evaluateAudio, recorder])

  const evaluateUploadedFile = useCallback(async (file: File) => {
    if (isEvaluating || recorder.isRecording) return
    let error: string | null = null
    if (!file.size) error = "音频文件为空，请重新选择"
    else if (file.size > MAX_AUDIO_UPLOAD_BYTES) error = "音频文件不能超过 25 MB"
    else if (!AUDIO_FILE_PATTERN.test(file.name) && !file.type.startsWith("audio/")) {
      error = "请选择 WAV、MP3、FLAC、OGG、M4A 或 WebM 音频文件"
    }
    if (error) {
      clearRecording()
      setAssessment(null)
      setSaveNotice(null)
      setEvalError(error)
      onReportChange(true)
      return
    }
    await evaluateAudio(file, "upload", 0, file.name)
  }, [clearRecording, evaluateAudio, isEvaluating, onReportChange, recorder.isRecording])

  const seconds = Math.floor(recorder.elapsedMs / 1000)

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-primary">当前句 {position} / {total}</span>
            <span className="text-xs text-muted-foreground">
              · {sentence.cefrLevel}{sentence.bestScore !== null && ` · 最佳 ${Math.round(sentence.bestScore)} 分`}
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

        <div className="flex flex-col gap-2 py-1">
          {!hasContext && <p className="truncate text-xs text-muted-foreground">{sentence.sourceTitle}</p>}
          <p className="max-w-3xl font-serif text-[clamp(1.05rem,1.6vw,1.4rem)] leading-relaxed font-semibold text-foreground">
            {sentence.text}
          </p>
          {sentence.translation && (
            <p className="text-sm leading-relaxed text-muted-foreground">
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

        {recorder.isRecording && (
          <AudioWaveform
            isRecording={recorder.isRecording}
            audioStream={null}
            waveform={recorder.waveform}
            level={recorder.level}
            elapsedMs={recorder.elapsedMs}
            className="h-12 w-full"
          />
        )}

        {/* 录音控制区（固定在卡片底部） */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 border-t border-border/60 pt-4">
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
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/20">
                  <MicIcon className="size-4" />
                </span>
                {assessment ? "重新跟读本句" : "开始跟读"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopAndEvaluate()}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/20">
                  <SquareIcon className="size-4 fill-white" />
                </span>
                结束并评测
              </button>
            )}

            <input
              ref={uploadInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.webm"
              aria-label="选择预录音频进行跟读评测"
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                if (file) void evaluateUploadedFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isEvaluating || recorder.isRecording}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <UploadIcon className="size-4" />
              上传录音并评测
            </button>

            {recordedUrl && !recorder.isRecording && (
              <button
                type="button"
                onClick={() => {
                  if (isPlayingMine) {
                    audioBox.current.mine?.pause()
                    setIsPlayingMine(false)
                  } else {
                    playMine()
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <PlayIcon className="size-3.5" />
                {isPlayingMine ? "回放中…" : recordedSource === "upload" ? "回放上传录音 [B]" : "回放我的录音 [B]"}
              </button>
            )}

            {assessment && !recorder.isRecording && hasNext && (
              <button
                type="button"
                onClick={onRequestNext}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 text-xs font-semibold transition-colors hover:bg-muted"
              >
                下一句 <ArrowRightIcon className="size-3.5" />
              </button>
            )}
          </div>

          {!recorder.isRecording && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={saveUploadedAttempt}
                onChange={(event) => setSaveUploadedAttempt(event.target.checked)}
                disabled={isEvaluating}
                className="size-3.5 accent-primary"
              />
              上传录音评测后计入我的练习记录
            </label>
          )}

          {recordedSource === "upload" && uploadFileName && (
            <p className="max-w-full truncate text-center text-[11px] text-muted-foreground" title={uploadFileName}>
              已使用预录音频：{uploadFileName} · 参考文本为当前句子
            </p>
          )}

          <p className="text-center font-mono text-[11px] text-muted-foreground">
            {recorder.isRecording
              ? "读完后点击「结束并评测」"
              : assessment
                ? "查看右侧反馈，再读一次或继续下一句"
                : "可现场跟读，也可上传事先录好的音频；推荐使用 WAV 格式"}
          </p>

          {recorder.error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircleIcon className="size-3.5" />
              {recorder.error}
            </div>
          )}
        </div>
      </div>

      {/* 评测内容渲染到右侧反馈面板。 */}
      {reportHost
        ? createPortal(
            <div className="flex flex-col gap-2.5">
              {/* 评测中 */}
              {isEvaluating && (
                <div className="flex flex-col items-center justify-center gap-2.5 rounded-3xl border border-border bg-card/60 p-8">
                  <Loader2Icon className="size-8 animate-spin text-primary" />
                  <p className="font-mono text-sm font-semibold text-foreground">正在评测发音…</p>
                  <p className="max-w-md text-center text-xs text-muted-foreground">正在分析你的发音和节奏，请稍候。</p>
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
                  <p className="text-xs text-muted-foreground">请检查录音内容与当前句子是否一致，确认音频格式可解码后重试。</p>
                </div>
              )}

              {/* 评测结果 */}
              {assessment && !isEvaluating && (
                <>
                  {!assessment.engine.phoneme_alignment && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      音素模型本次未能可靠对齐，仅展示词级参考分；请勿将其用于判断具体音素发音。
                    </div>
                  )}
                  {saveNotice && (
                    <div
                      className={`flex items-center gap-1.5 px-1 text-[11px] ${
                        saveNotice.includes("失败")
                          ? "rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {saveNotice.includes("失败") ? (
                        <AlertCircleIcon className="size-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{saveNotice}</span>
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
  const [sentences, setSentences] = useState<PracticeSentence[]>([])
  const [articles, setArticles] = useState<ReadingArticle[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [sourceSentences, setSourceSentences] = useState<PracticeSentence[]>([])
  const [cardSentences, setCardSentences] = useState<PracticeSentence[]>([])
  const [sourceQuery, setSourceQuery] = useState("")
  const [sentenceQuery, setSentenceQuery] = useState("")
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [assetLoadFailures, setAssetLoadFailures] = useState({ article: false, media: false, card: false })
  const [loadingSource, setLoadingSource] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const assetRequestRef = useRef(0)
  const contextListRef = useRef<HTMLDivElement>(null)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [loadingSentences, setLoadingSentences] = useState(true)
  const [sentenceError, setSentenceError] = useState<string | null>(null)

  const [playRate, setPlayRate] = useState<number>(1.0)
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false)
  const speedDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedDropdownRef.current && !speedDropdownRef.current.contains(e.target as Node)) {
        setSpeedDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
  const [showReport, setShowReport] = useState(false)
  const [rightPanelView, setRightPanelView] = useState<"transcript" | "feedback">("transcript")

  const [toast, setToast] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const loadSentences = useCallback(async (): Promise<ShadowingSentence[]> => {
    const list = await fetchSentenceLibrary()
    setSentences(list)
    return list
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      readingApi.listArticles({ page: 1, size: 100 }),
      mediaApi.list(),
      vocabApi.listCards({ page: 1, size: 500 }),
    ]).then(([articleResult, mediaResult, cardResult]) => {
      if (cancelled) return
      if (articleResult.status === "fulfilled") setArticles(articleResult.value.records)
      if (mediaResult.status === "fulfilled") setMediaItems(mediaResult.value)
      if (cardResult.status === "fulfilled") {
        setCardSentences(cardResult.value.records
          .filter((card) => card.contextSentence?.trim() && /[a-zA-Z]{2,}/.test(card.contextSentence))
          .map((card) => makeSourceSentence(-card.id, "CARD", `生词本 · ${card.lemma}`, card.contextSentence.trim(), card.contextTranslation ?? "", "B2")))
      }
      setAssetLoadFailures({ article: articleResult.status === "rejected", media: mediaResult.status === "rejected", card: cardResult.status === "rejected" })
      setLoadingAssets(false)
    })
    return () => { cancelled = true }
  }, [])

  const selectAsset = useCallback(async (tab: "ARTICLE" | "VIDEO" | "PODCAST", id: string) => {
    const requestId = ++assetRequestRef.current
    setShowReport(false)
    setRightPanelView("transcript")
    setSelectedAssetId(id)
    setSentenceQuery("")
    setSourceSentences([])
    setCurrentId(null)
    setSourceError(null)
    setLoadingSource(true)
    try {
      let next: PracticeSentence[]
      if (tab === "ARTICLE") {
        const article = await readingApi.getDetail(Number(id))
        const articleSentences = article.paragraphs.flatMap((paragraph, paragraphIndex) =>
          parseTextToSentences((paragraph.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? []).join("\n"))
            .filter((item) => /[a-zA-Z]{2,}/.test(item.text))
            .map((item) => ({ ...item, paragraphIndex }))
        )
        next = articleSentences.map((item, index) =>
          makeSourceSentence(-index - 1, tab, article.title, item.text, item.translation ?? "", article.cefrLevel, { paragraphIndex: item.paragraphIndex })
        )
      } else {
        const media = mediaItems.find((item) => item.id === id)
        const cues = await mediaApi.cues(id)
        next = cues
          .filter((cue) => cue.sourceText?.trim() && /[a-zA-Z]{2,}/.test(cue.sourceText))
          .map((cue, index) => makeSourceSentence(-index - 1, tab, media?.title ?? "媒体字幕", cue.sourceText.trim(), cue.translation ?? "", media?.level ?? "B2", { startMs: cue.startMs }))
      }
      if (requestId !== assetRequestRef.current) return
      setSourceSentences(next)
      setCurrentId(next[0]?.id ?? null)
      if (next.length === 0) setSourceError("该内容没有可跟读的英文句子，请选择其他内容。")
    } catch (error: unknown) {
      if (requestId === assetRequestRef.current) setSourceError(error instanceof Error ? error.message : "无法读取该来源的内容")
    } finally {
      if (requestId === assetRequestRef.current) setLoadingSource(false)
    }
  }, [mediaItems])

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
        const list = await fetchSentenceLibrary()
        if (cancelled) return
        setSentences(list)
        const first = list.find((s) => s.sourceType === "BBC") ?? list[0]
        if (first) setActiveTab((tab) => tab === "BBC" ? first.sourceType : tab)
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
    () => ASSET_TABS.includes(activeTab)
      ? sourceSentences
      : activeTab === "CARD"
        ? [...cardSentences, ...sentences.filter((sentence) => sentence.sourceType === "CARD")]
      : sentences.filter((sentence) => sentence.sourceType === activeTab),
    [sentences, sourceSentences, cardSentences, activeTab]
  )
  const visibleSentences = useMemo(() => {
    const query = sentenceQuery.trim().toLowerCase()
    return query ? tabSentences.filter((sentence) => `${sentence.text} ${sentence.translation ?? ""}`.toLowerCase().includes(query)) : tabSentences
  }, [sentenceQuery, tabSentences])

  const sourceAssets = useMemo(() => {
    const items = activeTab === "ARTICLE"
      ? articles.map((article) => ({ id: String(article.id), title: article.title, meta: `${article.sourceName} · ${article.cefrLevel} · ${article.readMinutes} 分钟` }))
      : mediaItems
          .filter((media) => media.status === "READY" && (activeTab === "PODCAST" ? media.source === "PODCAST" : activeTab === "VIDEO" && media.source !== "PODCAST"))
          .map((media) => ({ id: media.id, title: media.title, meta: `${media.creator ?? "我的媒体"} · ${media.level ?? "英语"}` }))
    const query = sourceQuery.trim().toLowerCase()
    return query ? items.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(query)) : items
  }, [activeTab, articles, mediaItems, sourceQuery])

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

  useEffect(() => {
    const list = contextListRef.current
    const row = list?.querySelector<HTMLElement>('[data-current-sentence="true"]')
    if (!list || !row) return
    const listRect = list.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    if (rowRect.bottom > listRect.bottom) list.scrollBy({ top: rowRect.bottom - listRect.bottom + 12, behavior: "smooth" })
    else if (rowRect.top < listRect.top) list.scrollBy({ top: rowRect.top - listRect.top - 12, behavior: "smooth" })
  }, [activeTab, current?.id, selectedAssetId])

  const selectTab = useCallback(
    (tab: SourceTab) => {
      setActiveTab(tab)
      assetRequestRef.current += 1
      setSourceQuery("")
      setSentenceQuery("")
      setShowReport(false)
      setRightPanelView("transcript")
      setSourceError(null)
      setLoadingSource(false)
      setSelectedAssetId(null)
      if (ASSET_TABS.includes(tab)) {
        setSourceSentences([])
        setCurrentId(null)
        return
      }
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
    if (created > 0 || skipped > 0) setLibraryOpen(false)
  }, [parsedSentences, importing, sentences, uploadedFileName, loadSentences])

  const handleDeleteSentence = useCallback(
    async (id: number) => {
      try {
        await shadowingApi.deleteSentence(id)
        const list = await loadSentences()
        if (currentId === id) {
          const next =
            list.find((s) => s.sourceType === activeTab) ??
            list.find((s) => s.sourceType === "BBC")
          setCurrentId(next?.id ?? null)
        }
      } catch (err: unknown) {
        setSentenceError(err instanceof Error ? err.message : "删除失败")
      }
    },
    [activeTab, currentId, loadSentences]
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 md:py-9">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">影子跟读</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setLibraryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <LayersIcon className="size-4" /> 素材库
          </button>
          <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <HistoryIcon className="size-4" /> 练习记录
          </button>
        </div>
      </header>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-semibold text-foreground">{SOURCE_META[activeTab].label}</span>
              <span className="text-muted-foreground">·</span>
              {selectedAssetId && ASSET_TABS.includes(activeTab) && (
                <span className="max-w-52 truncate text-muted-foreground">{activeTab === "ARTICLE" ? articles.find((item) => String(item.id) === selectedAssetId)?.title : mediaItems.find((item) => item.id === selectedAssetId)?.title}</span>
              )}
              <span className="text-muted-foreground">{currentIndex >= 0 ? `${currentIndex + 1} / ${tabSentences.length} 句` : "暂无句子"}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>原声语速</span>
                <div className="relative" ref={speedDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
                    className="flex items-center gap-1.5 h-7.5 rounded-lg border border-border bg-card px-2.5 font-mono text-xs font-semibold text-foreground hover:bg-muted/70 transition-colors shadow-2xs select-none"
                  >
                    <span>{playRate}x</span>
                    <ChevronDownIcon
                      className={`size-3 text-muted-foreground transition-transform duration-200 ${
                        speedDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {speedDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-20 rounded-xl border border-border bg-popover p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
                      {SPEED_OPTIONS.map((rate) => {
                        const isSelected = playRate === rate
                        return (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => {
                              setPlayRate(rate)
                              setSpeedDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                              isSelected
                                ? "bg-muted text-foreground font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
                            }`}
                          >
                            <span>{rate}x</span>
                            {isSelected && <CheckIcon className="size-3 text-primary ml-1.5" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setLibraryOpen(true)} className="text-xs font-semibold text-primary hover:underline">更换素材 <ArrowRightIcon className="inline size-3" /></button>
            </div>
          </div>
          <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
            <SheetContent side="right" className="gap-0 overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
              <SheetHeader className="mb-5 p-0 pr-8">
                <SheetTitle className="text-xl font-bold">跟读素材库</SheetTitle>
                <SheetDescription>选择文章、视频或播客直接开启跟读，也可从生词本或收藏中选取单句。</SheetDescription>
              </SheetHeader>
          <div className="grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)]">
          <nav aria-label="素材来源" className="grid grid-cols-2 content-start gap-2 sm:grid-cols-3 md:grid-cols-1">
              {(Object.keys(SOURCE_META) as SourceTab[]).map((key) => {
                const meta = SOURCE_META[key]
                const count = key === "ARTICLE" ? articles.length
                  : key === "PODCAST" ? mediaItems.filter((item) => item.status === "READY" && item.source === "PODCAST").length
                  : key === "VIDEO" ? mediaItems.filter((item) => item.status === "READY" && item.source !== "PODCAST").length
                  : key === "CARD" ? cardSentences.length + sentences.filter((sentence) => sentence.sourceType === "CARD").length
                  : sentences.filter((sentence) => sentence.sourceType === key).length
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (activeTab !== key) selectTab(key)
                    }}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors ${
                      activeTab === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <meta.icon className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                    <span className="font-mono text-[10px] opacity-70">
                      {count}
                    </span>
                  </button>
                )
              })}
          </nav>
          <div className="min-w-0">

          {ASSET_TABS.includes(activeTab) && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{SOURCE_META[activeTab].description}</p>
              <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <SearchIcon className="size-4 text-muted-foreground" />
                <input aria-label={`搜索${SOURCE_META[activeTab].label}`} value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder={`搜索${SOURCE_META[activeTab].label}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
              {loadingAssets ? (
                <p className="py-5 text-center text-xs text-muted-foreground">正在加载来源…</p>
              ) : sourceAssets.length === 0 ? (
                <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-xs text-muted-foreground">{(activeTab === "ARTICLE" ? assetLoadFailures.article : assetLoadFailures.media) ? "来源加载失败，请刷新页面重试。" : sourceQuery ? "没有匹配的内容，请换个关键词。" : "暂无可选内容。请先在对应模块添加内容，或换一个来源。"}</p>
              ) : (
                <div className="max-h-[min(65vh,36rem)] space-y-2 overflow-y-auto pr-1">
                  {sourceAssets.map((asset) => {
                    const isSelected = selectedAssetId === asset.id
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={async () => {
                          setLibraryOpen(false)
                          if (!isSelected) {
                            await selectAsset(activeTab as "ARTICLE" | "VIDEO" | "PODCAST", asset.id)
                          }
                        }}
                        className={`group flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-primary/50 bg-primary/10 shadow-sm"
                            : "border-border/70 bg-card hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-bold transition-colors ${
                            isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                          }`}>
                            {asset.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {asset.meta}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isSelected ? (
                            <span className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
                              <CheckIcon className="size-3" />
                              练习中
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground group-hover:border-primary/40 group-hover:text-primary">
                              选择
                              <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {loadingSource && <p className="text-xs text-muted-foreground">正在读取内容…</p>}
              {sourceError && <p role="alert" className="text-xs text-rose-600">{sourceError}</p>}
            </div>
          )}

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

          {/* 句子选择器（仅非容器型单句来源：生词本、精选短句、收藏） */}
          {!ASSET_TABS.includes(activeTab) && tabSentences.length > 0 && (
            <div className="mt-5 flex flex-col gap-2 border-t border-border/70 pt-5">
              <span className="mb-1 text-xs font-semibold text-muted-foreground">{SOURCE_META[activeTab].label} · {tabSentences.length} 句</span>
              {tabSentences.length > 8 && (
                <label className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                  <SearchIcon className="size-4 text-muted-foreground" />
                  <input aria-label="搜索跟读句子" value={sentenceQuery} onChange={(event) => setSentenceQuery(event.target.value)} placeholder="搜索句子或译文" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </label>
              )}
              {visibleSentences.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">没有匹配的句子</p>}
              {visibleSentences.map((item) => {
                const mastery = MASTERY_META[item.masteryStatus] ?? MASTERY_META.NEW
                const isActive = item.id === current?.id
                const idx = tabSentences.indexOf(item)
                return (
                  <div key={item.id} className="flex min-w-0 items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id !== current?.id) {
                          setCurrentId(item.id)
                          setShowReport(false)
                          setRightPanelView("transcript")
                        }
                        setLibraryOpen(false)
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all ${
                        isActive
                          ? "border-primary/40 bg-primary/10 font-bold text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60">{idx + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-serif">
                        {item.text}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${item.persisted === false ? "bg-muted text-muted-foreground" : mastery.className}`}>
                        {item.persisted === false ? `${item.wordCount} 词` : item.bestScore !== null ? Math.round(item.bestScore) : mastery.label}
                      </span>
                    </button>
                    {(item.sourceType === "CUSTOM" || item.sourceType === "MEDIA") && isActive && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteSentence(item.id)}
                        title={item.sourceType === "MEDIA" ? "移除媒体收藏" : "删除该自定义句"}
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

          {activeTab === "CARD" && assetLoadFailures.card && tabSentences.length === 0 && (
            <p role="alert" className="mt-4 text-xs text-rose-600">生词本例句加载失败，请刷新页面重试。</p>
          )}

          {sentenceError && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircleIcon className="size-3.5" />
              {sentenceError}
            </div>
          )}
          </div>
          </div>
            </SheetContent>
          </Sheet>

          <div data-testid="shadowing-practice-column" className="flex min-w-0 flex-col gap-4">
            {loadingSentences ? (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-3xl border border-border bg-card/60 p-10 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                正在加载跟读句库…
              </div>
            ) : loadingSource ? (
              <div className="flex min-h-[320px] items-center justify-center gap-2 rounded-3xl border border-border bg-card text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> 正在读取跟读内容…</div>
            ) : !current ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
                <LayersIcon className="size-7 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">{ASSET_TABS.includes(activeTab) && !selectedAssetId ? "先选择跟读素材" : "该来源下还没有跟读句"}</p>
                {sentenceError && <p className="text-xs text-rose-600">{sentenceError}</p>}
                {sourceError && <p className="text-xs text-rose-600">{sourceError}</p>}
                <p className="max-w-sm text-xs text-muted-foreground">
                  {ASSET_TABS.includes(activeTab)
                    ? selectedAssetId ? "该内容没有可跟读的句子，请选择其他内容。" : `打开句库，选择一篇${activeTab === "ARTICLE" ? "文章" : activeTab === "VIDEO" ? "视频" : "播客"}。`
                    : activeTab === "CUSTOM"
                    ? "打开句库，上传或粘贴英文文本并导入。"
                    : activeTab === "MEDIA"
                      ? "在视频或播客精听页悬浮字幕，点击收藏后会出现在这里。"
                    : "换一个题源，或先在生词本中添加卡片例句。"}
                </p>
                <button type="button" onClick={() => setLibraryOpen(true)} className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">打开句库</button>
              </div>
            ) : (
              // key 让「换句」变成重新挂载：录音、评测结果、IPA 状态自然清空
              <SentenceWorkspace
                key={`${activeTab}:${selectedAssetId ?? "library"}:${current.id}`}
                sentence={current}
                playRate={playRate}
                onSaved={refreshAfterSave}
                hasNext={Boolean(nextSentence)}
                position={currentIndex + 1}
                total={tabSentences.length}
                hasContext={tabSentences.length > 1}
                reportHost={reportHost}
                onReportChange={(visible) => {
                  setShowReport(visible)
                  setRightPanelView(visible ? "feedback" : "transcript")
                }}
                onRequestNext={() => {
                  if (nextSentence) { setCurrentId(nextSentence.id); setShowReport(false); setRightPanelView("transcript") }
                }}
              />
            )}
          </div>
        </div>
        <section aria-label="跟读语料与反馈" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card lg:h-[min(76dvh,48rem)] lg:min-h-[32rem]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">{activeTab === "VIDEO" || activeTab === "PODCAST" ? "连续字幕" : activeTab === "ARTICLE" ? "文章正文" : "跟读语料"}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{ASSET_TABS.includes(activeTab) ? current?.sourceTitle ?? "选择素材后开始" : SOURCE_META[activeTab].label}</p>
            </div>
            <div role="tablist" aria-label="右侧内容" className="flex shrink-0 gap-1 rounded-lg bg-muted/70 p-1">
              <button type="button" role="tab" aria-selected={rightPanelView === "transcript" || !showReport} onClick={() => setRightPanelView("transcript")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${rightPanelView === "transcript" || !showReport ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>语料 · {tabSentences.length}</button>
              {showReport && <button type="button" role="tab" aria-selected={rightPanelView === "feedback"} onClick={() => setRightPanelView("feedback")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${rightPanelView === "feedback" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>本轮反馈</button>}
            </div>
          </div>
          <ProgressScrollArea
            viewportRef={contextListRef}
            role="list"
            aria-label="跟读语料上下文"
            className={showReport && rightPanelView === "feedback" ? "hidden" : "min-h-0 flex-1"}
            viewportClassName="px-3 py-2 max-lg:max-h-[54dvh]"
            progressClassName="bg-primary/75"
          >
            {tabSentences.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">从素材库选择内容后，文章或字幕会显示在这里。</div>
            ) : tabSentences.map((item, index) => {
              const previous = tabSentences[index - 1]
              const isActive = item.id === current?.id
              const showGroup = activeTab === "ARTICLE"
                ? item.paragraphIndex !== undefined && item.paragraphIndex !== previous?.paragraphIndex
                : (activeTab === "BBC" || activeTab === "MEDIA") && item.sourceTitle !== previous?.sourceTitle
              return (
                <div key={`${item.sourceType}:${item.id}`} role="listitem">
                  {showGroup && <p className="px-3 pb-1 pt-4 text-[11px] font-semibold text-muted-foreground first:pt-1">{activeTab === "ARTICLE" ? `第 ${(item.paragraphIndex ?? 0) + 1} 段` : item.sourceTitle}</p>}
                  <button type="button" data-current-sentence={isActive ? "true" : undefined} aria-current={isActive ? "true" : undefined} onClick={() => { if (item.id === current?.id) return; setCurrentId(item.id); setShowReport(false); setRightPanelView("transcript") }} className={`flex w-full items-start gap-3 rounded-xl border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${isActive ? "border-primary bg-primary/8 text-foreground" : "border-transparent text-foreground/75 hover:bg-muted/50 hover:text-foreground"}`}>
                    <span className={`w-10 shrink-0 pt-0.5 text-right font-mono text-[11px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>{item.startMs === undefined ? String(index + 1).padStart(2, "0") : formatCueTime(item.startMs)}</span>
                    <span className="min-w-0 flex-1"><span className={`block text-sm leading-relaxed sm:text-[15px] ${isActive ? "font-semibold" : "font-normal"}`}>{item.text}</span>{isActive && item.translation && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.translation}</span>}</span>
                    {isActive && <span className="shrink-0 pt-0.5 text-[11px] font-semibold text-primary">正在练习</span>}
                  </button>
                </div>
              )
            })}
          </ProgressScrollArea>
          <ProgressScrollArea
            viewportRef={setReportHost}
            role="tabpanel"
            aria-label="本轮反馈"
            className={showReport && rightPanelView === "feedback" ? "min-h-0 flex-1" : "hidden"}
            viewportClassName="p-4 lg:p-5"
            progressClassName="bg-primary/75"
          />
        </section>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          data-testid="shadowing-report-column"
          className="w-full max-w-xl gap-4 overflow-y-auto p-5 sm:max-w-xl"
        >
          <SheetHeader className="p-0 pr-8">
            <SheetTitle className="text-xl font-bold">练习记录</SheetTitle>
            <SheetDescription>回看最近的成绩与需要加强的发音。</SheetDescription>
          </SheetHeader>

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
                        if (h.sentenceId === null) {
                          if (!ASSET_TABS.includes(h.sourceType as SourceTab) && h.sourceType !== "CARD") return
                          const type = h.sourceType as "ARTICLE" | "VIDEO" | "PODCAST" | "CARD"
                          const replayId = -1_000_000_000 - h.id
                          setActiveTab(type)
                          setSelectedAssetId(null)
                          if (type === "CARD") {
                            setCardSentences((currentCards) => [makeSourceSentence(replayId, type, h.sourceTitle, h.referenceText, "", "B2"), ...currentCards])
                          } else {
                            setSourceSentences([makeSourceSentence(replayId, type, h.sourceTitle, h.referenceText, "", "B2")])
                          }
                          setCurrentId(replayId)
                          setShowReport(false)
                          setRightPanelView("transcript")
                          setHistoryOpen(false)
                          return
                        }
                        const target = sentences.find((s) => s.id === h.sentenceId)
                        if (!target) return
                        setActiveTab(target.sourceType)
                        setCurrentId(target.id)
                        setShowReport(false)
                        setRightPanelView("transcript")
                        setHistoryOpen(false)
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
        </SheetContent>
        </Sheet>
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

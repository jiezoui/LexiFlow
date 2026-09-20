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
import Link from "next/link"
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  BarChart3Icon,
  BookOpenIcon,
  CheckCircle2Icon,
  FlameIcon,
  GaugeIcon,
  HistoryIcon,
  LayersIcon,
  Loader2Icon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  RotateCcwIcon,
  SparklesIcon,
  SquareIcon,
  TargetIcon,
  Trash2Icon,
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
    label: "自主输入句子",
    icon: LayersIcon,
    description: "粘贴任意英文句子，随时开练",
  },
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25] as const

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
}: {
  sentence: ShadowingSentence
  playRate: number
  onSaved: () => void
  onRequestNext: () => void
  hasNext: boolean
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
      <div className="flex flex-col gap-6 rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/90 p-6 shadow-md sm:p-8">
        {/* 元数据 + 参考音 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
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

        {/* 基准句 + 译文 + IPA */}
        <div className="flex flex-col gap-4">
          <p className="font-serif text-xl leading-relaxed font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            &ldquo;{sentence.text}&rdquo;
          </p>
          {sentence.translation && (
            <p className="text-xs leading-normal text-muted-foreground sm:text-sm">
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

        {/* 录音区 */}
        <div className="flex flex-col items-center justify-center gap-4 border-t border-border/60 pt-6">
          <AudioWaveform
            isRecording={recorder.isRecording}
            audioStream={null}
            waveform={recorder.waveform}
            level={recorder.level}
            elapsedMs={recorder.elapsedMs}
            className="h-24 w-full max-w-xl"
          />

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
                className="flex items-center gap-3 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:opacity-95 active:scale-95 disabled:opacity-50"
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
                className="flex animate-pulse items-center gap-3 rounded-2xl bg-rose-600 px-8 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-rose-700 active:scale-95"
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

      {/* 评测中 */}
      {isEvaluating && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card/60 p-12">
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
        <div className="flex flex-col gap-4">
          {saveNotice && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${
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

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-bold text-foreground">声学听觉对比</span>
              <button
                type="button"
                onClick={playReference}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <Volume2Icon className="size-3.5 text-primary" />
                母语原声 [A]
              </button>
              {recordedUrl && (
                <button
                  type="button"
                  onClick={playMine}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <RotateCcwIcon className="size-3.5" />
                重录本句
              </button>
              {hasNext && (
                <button
                  type="button"
                  onClick={onRequestNext}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow transition-opacity hover:opacity-90"
                >
                  跟读下一句
                  <ArrowRightIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null)

  const [customInput, setCustomInput] = useState("")
  const [customTranslation, setCustomTranslation] = useState("")
  const [importing, setImporting] = useState(false)

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

      try {
        const health = await speechApi.health()
        if (!cancelled) {
          setBridgeOnline(health.status === "UP" && health.engines.asr_loaded)
        }
      } catch {
        if (!cancelled) setBridgeOnline(false)
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

  const handleImportCustom = useCallback(async () => {
    const text = customInput.trim()
    if (!text) return
    setImporting(true)
    setSentenceError(null)
    try {
      const created = await shadowingApi.createSentence({
        text,
        translation: customTranslation.trim() || undefined,
        cefrLevel: "B2",
      })
      setCustomInput("")
      setCustomTranslation("")
      await loadSentences()
      setActiveTab("CUSTOM")
      setCurrentId(created.id)
      setToast("自定义跟读句已导入")
    } catch (err: unknown) {
      setSentenceError(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }, [customInput, customTranslation, loadSentences])

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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-4 pt-2 md:p-6">
      {/* ══ 标题 + 服务状态 ══ */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
            <RadioIcon className="size-3.5" />
            Acoustic Shadowing · Forced Alignment · Phoneme GOP
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            语脉 · 影子跟读智能评测工坊
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
            本地 Whisper ASR 转写 × wav2vec2 音素 CTC 强制对齐，逐音素给出后验概率与发音诊断，
            再按三维评分反哺记忆训练。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bridgeOnline === false && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              <AlertCircleIcon className="size-3.5" />
              语音服务未就绪 · 运行 scripts\start-speech-bridge.ps1
            </span>
          )}
          {bridgeOnline === true && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2Icon className="size-3.5" />
              本地语音引擎在线
            </span>
          )}
          <Link
            href="/cards"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold transition-colors hover:bg-muted"
          >
            <BookOpenIcon className="size-3.5" />
            闪卡工作台
          </Link>
          <Link
            href="/reading"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold transition-colors hover:bg-muted"
          >
            <LayersIcon className="size-3.5" />
            外刊阅读库
          </Link>
        </div>
      </header>

      {/* ══ 训练总览 ══ */}
      {stats && stats.totalAttempts > 0 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            {
              label: "累计跟读",
              value: stats.totalAttempts,
              unit: "次",
              icon: MicIcon,
              hint: `今日 ${stats.todayAttempts} 次`,
            },
            {
              label: "平均得分",
              value: stats.averageScore,
              unit: "/100",
              icon: GaugeIcon,
              hint: `最高 ${stats.bestScore}`,
            },
            {
              label: "已掌握句子",
              value: stats.masteredSentences,
              unit: `/ ${stats.practicedSentences}`,
              icon: TargetIcon,
              hint: "最高分 ≥ 85 视为掌握",
            },
            {
              label: "连续打卡",
              value: stats.streakDays,
              unit: "天",
              icon: FlameIcon,
              hint: `累计 ${stats.totalDurationMinutes} 分钟`,
            },
            {
              label: "今日平均",
              value: stats.todayAverageScore,
              unit: "/100",
              icon: BarChart3Icon,
              hint: stats.todayAttempts > 0 ? "保持节奏" : "今天还没练",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3.5"
            >
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <card.icon className="size-3.5" />
                {card.label}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-foreground">{card.value}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{card.unit}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{card.hint}</span>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ══════════ 主工作区 ══════════ */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 题源标签 + 语速 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/40 p-1.5">
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

          {/* 自定义导入 */}
          {activeTab === "CUSTOM" && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="粘贴或键入任意想跟读的英文句子…"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleImportCustom()
                  }}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-serif text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="参考译文（可选）"
                  value={customTranslation}
                  onChange={(e) => setCustomTranslation(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleImportCustom()}
                  disabled={!customInput.trim() || importing}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="size-3.5" />
                  )}
                  导入句库
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {SOURCE_META.CUSTOM.description} · 导入后永久保存在你的个人句库中
              </p>
            </div>
          )}

          {/* 句子选择器 */}
          {tabSentences.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircleIcon className="size-3.5" />
              {sentenceError}
            </div>
          )}

          {/* 工作区 */}
          {loadingSentences ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-card/60 p-16 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              正在加载跟读句库…
            </div>
          ) : !current ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
              <LayersIcon className="size-8 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">该题源下还没有跟读句</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {activeTab === "CUSTOM"
                  ? "在上方输入任意英文句子并导入，即可开始跟读练习。"
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
              onRequestNext={() => {
                if (nextSentence) setCurrentId(nextSentence.id)
              }}
            />
          )}
        </div>

        {/* ══════════ 侧栏 ══════════ */}
        <aside className="flex min-w-0 flex-col gap-4">
          {stats && stats.weakPhonemes.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <TargetIcon className="size-3.5" />
                重点打磨音素
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {stats.weakPhonemes.map((p) => (
                  <div key={p.phoneme} className="flex items-start gap-2.5">
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
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 font-mono text-base font-bold text-rose-600 dark:text-rose-400"
                      title="试听该音素"
                    >
                      {p.phoneme}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {p.averageScore} 分
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {p.occurrences} 次
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {p.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {stats && stats.totalAttempts > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ActivityIcon className="size-3.5" />
                近 14 天得分趋势
              </div>
              <div className="mt-3 flex h-24 items-end gap-1">
                {stats.trend.map((d) => {
                  const height = d.attempts > 0 ? Math.max(6, (d.averageScore / 100) * 88) : 3
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
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{stats.trend[0]?.date.slice(5)}</span>
                <span>今天</span>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <HistoryIcon className="size-3.5" />
                练习历史
              </div>
              {history.length > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  最近 {history.length} 条
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                还没有跟读记录。完成第一次评测后，这里会显示得分曲线。
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {history.map((h) => {
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
                      className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-background/50 p-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className={`font-mono text-lg font-bold ${tone}`}>
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

          <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              影子跟读法要点
            </div>
            <ol className="mt-2 flex flex-col gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <li>1. 先盲听 1~2 遍原声，抓住意群与重音位置</li>
              <li>2. 与原声同步开口（比原声慢半拍），模仿语调与连读</li>
              <li>3. 录音后先看「准确度」再看「流利度」——先读准再读快</li>
              <li>4. 针对标红的音素，按教练提示调整舌位与口型后重录</li>
            </ol>
          </section>
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

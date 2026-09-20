"use client"

/**
 * 语脉 · 影子跟读评测结果面板
 *
 * 把语音桥接服务返回的评测结果渲染成可读的「发音诊断报告」：
 *
 * 1. 四维评分仪表（综合 / 准确度 / 完整度 / 流利度）
 * 2. 逐词 IPA 音标 + 逐音素着色（点击可试听该词）
 * 3. 评分说明（后验概率 / 帧内排名）—— 让分数可解释，而不是黑盒
 * 4. 声学质量提示（削波、信噪比、语速、停顿）
 * 5. 发音教练建议（含口型/舌位要领与练习词）
 */

import { useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  AwardIcon,
  BadgeCheckIcon,
  GaugeIcon,
  InfoIcon,
  LightbulbIcon,
  MicIcon,
  TimerIcon,
  TrendingUpIcon,
  Volume2Icon,
  WavesIcon,
} from "lucide-react"
import type { ShadowingAssessment, SpeechWord } from "@/lib/api-client"

interface ShadowingVerdictProps {
  result: ShadowingAssessment
  /** 点击单词时试听（由页面提供播放能力） */
  onPlayWord?: (word: string) => void
  className?: string
}

const GRADE_STYLES: Record<string, { ring: string; text: string; chip: string }> = {
  EXCELLENT: {
    ring: "border-emerald-500/40 bg-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  GOOD: {
    ring: "border-sky-500/40 bg-sky-500/5",
    text: "text-sky-600 dark:text-sky-400",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  FAIR: {
    ring: "border-amber-500/40 bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  PASS: {
    ring: "border-orange-500/40 bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  NEEDS_WORK: {
    ring: "border-rose-500/40 bg-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
}

/** 把 0~100 的分数映射到语义色（用于进度条与音素胶囊）。 */
function scoreTone(score: number): "good" | "fair" | "poor" {
  if (score >= 75) return "good"
  if (score >= 55) return "fair"
  return "poor"
}

const TONE_CLASS: Record<string, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  fair: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  poor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35",
}

const TONE_BAR: Record<string, string> = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-rose-500",
}

/** 指标卡片的稳定测试标识（供无头浏览器验收脚本读取，避免依赖文本顺序）。 */
const METRIC_TESTID: Record<string, string> = {
  "准确度 Accuracy": "shadowing-metric-accuracy",
  "完整度 Completeness": "shadowing-metric-completeness",
  "流利度 Fluency": "shadowing-metric-fluency",
  "韵律 Prosody": "shadowing-metric-prosody",
}

function MetricCard({
  label,
  value,
  suffix = "",
  hint,
  tone,
}: {
  label: string
  value: number | null
  suffix?: string
  hint?: string
  tone: "good" | "fair" | "poor"
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
      data-testid={METRIC_TESTID[label]}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-bold font-mono text-foreground"
          data-testid="metric-value"
          data-metric-value={value === null ? "" : value}
        >
          {value === null ? "--" : value}
        </span>
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${TONE_BAR[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      </div>
      {hint && <span className="text-[10px] font-mono text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** 单个单词（含逐音素胶囊）。 */
function WordChip({
  word,
  onPlayWord,
}: {
  word: SpeechWord
  onPlayWord?: (w: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isInsertion = word.status === "INSERTION"
  const isOmission = word.status === "OMISSION"
  const isSubstitution = word.status === "SUBSTITUTION"

  const shell = isInsertion
    ? "border-amber-500/30 bg-amber-500/8"
    : isOmission
    ? "border-dashed border-border bg-muted/40"
    : isSubstitution
    ? "border-rose-500/35 bg-rose-500/8"
    : "border-emerald-500/25 bg-emerald-500/6"

  return (
    <div className={`rounded-xl border px-2.5 py-2 ${shell}`}>
      <button
        type="button"
        onClick={() => {
          if (!isInsertion) onPlayWord?.(word.word)
          setOpen((v) => !v)
        }}
        className="flex w-full items-center gap-1.5 text-left"
        title={isInsertion ? "多读的词" : "点击试听标准发音，再次点击展开音素"}
      >
        <span
          className={`font-serif text-[15px] font-semibold ${
            isOmission ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {word.word}
        </span>
        {!isInsertion && word.score > 0 && (
          <span
            className={`rounded px-1 font-mono text-[10px] font-bold ${
              TONE_CLASS[scoreTone(word.score)]
            } border`}
          >
            {Math.round(word.score)}
          </span>
        )}
        {isInsertion && (
          <span className="rounded bg-amber-500/15 px-1 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
            多读
          </span>
        )}
        {isSubstitution && word.actual_word && (
          <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400">
            → {word.actual_word}
          </span>
        )}
      </button>

      {word.ipa && (
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          /{word.ipa.replace(/^\/|\/$/g, "")}/
        </div>
      )}

      {open && word.phonemes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
          {word.phonemes.map((p, i) => (
            <span
              key={`${p.phoneme}-${i}`}
              title={`/${p.phoneme}/ 得分 ${p.score}${
                p.rank ? ` · 模型排名第 ${p.rank}` : ""
              }${p.posterior ? ` · 后验 ${(p.posterior * 100).toFixed(1)}%` : ""}`}
              className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${
                TONE_CLASS[scoreTone(p.score)]
              }`}
            >
              {p.phoneme}
              <span className="ml-1 opacity-70">{Math.round(p.score)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ShadowingVerdict({
  result,
  onPlayWord,
  className = "",
}: ShadowingVerdictProps) {
  const { scores, counts, timing, acoustic, suggestions, words } = result
  const grade = GRADE_STYLES[result.grade] ?? GRADE_STYLES.FAIR

  const acousticWarnings = useMemo(() => {
    const list: string[] = []
    if (acoustic.clipping_ratio > 0.005) list.push("检测到削波，请调低麦克风增益")
    if (acoustic.rms_dbfs < -38) list.push("录音电平偏低，请靠近麦克风")
    if (acoustic.snr_db < 12) list.push("环境噪声较大，建议安静环境录音")
    if (acoustic.activity.speech_ratio < 0.25) list.push("有效语音占比低，可能未对准麦克风")
    return list
  }, [acoustic])

  const problemWords = words.filter(
    (w) => w.status === "SUBSTITUTION" || w.status === "OMISSION"
  )
  const perfectWords = words.filter((w) => w.status === "CORRECT" && w.score >= 85)

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {/* ① 综合结论 + 四维仪表 */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-3xl border p-6 text-center ${grade.ring}`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            综合跟读得分
          </span>
          <span
            className={`font-mono text-5xl font-extrabold ${grade.text}`}
            data-testid="shadowing-metric-overall"
            data-metric-value={scores.overall}
          >
            {Math.round(scores.overall)}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${grade.chip}`}>
            {result.grade_label}
          </span>
          <span className="mt-1 font-mono text-[10px] text-muted-foreground">
            {result.engine.asr} · {result.engine.asr_model}
            {result.engine.phoneme_alignment ? " · 音素级对齐已启用" : " · 仅词级评分"}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            评测耗时 {result.processing_ms} ms
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="准确度 Accuracy"
            value={scores.accuracy}
            suffix="/100"
            tone={scoreTone(scores.accuracy)}
            hint={`${counts.correct} 读对 / ${counts.substitution} 误读`}
          />
          <MetricCard
            label="完整度 Completeness"
            value={scores.completeness}
            suffix="/100"
            tone={scoreTone(scores.completeness)}
            hint={`${counts.omission} 漏读 / ${counts.insertion} 多读`}
          />
          <MetricCard
            label="流利度 Fluency"
            value={scores.fluency}
            suffix="/100"
            tone={scoreTone(scores.fluency)}
            hint={`${timing.words_per_minute} WPM · ${timing.pause_count} 处停顿`}
          />
          <MetricCard
            label="韵律 Prosody"
            value={scores.prosody}
            suffix="/100"
            tone={scores.prosody === null ? "fair" : scoreTone(scores.prosody)}
            hint={
              acoustic.pitch_range_semitones !== null
                ? `基频跨度 ${acoustic.pitch_range_semitones} 半音`
                : "未测得基频"
            }
          />
        </div>
      </div>

      {/* ② ASR 转写对照 */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          <MicIcon className="size-3.5" />
          系统听到的内容（ASR 转写）
        </div>
        <p className="mt-2 font-serif text-sm leading-relaxed text-foreground">
          {result.transcribed_text || <span className="text-muted-foreground">（未识别到语音）</span>}
        </p>
        {problemWords.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            共 {problemWords.length} 个词需要关注
            {perfectWords.length > 0 && `，另有 ${perfectWords.length} 个词发音很到位`}
          </p>
        )}
      </div>

      {/* ③ 逐词 / 逐音素诊断 */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BadgeCheckIcon className="size-3.5" />
            逐词 IPA 与音素得分（点击单词试听，再点展开音素）
          </span>
          <span>基准音素 {counts.total_phonemes} 个 · 低分音素 {counts.poor_phonemes} 个</span>
        </div>
        <div className="flex flex-wrap gap-2 rounded-3xl border border-border/80 bg-card/70 p-4">
          {words.map((w, i) => (
            <WordChip key={`${w.word}-${i}`} word={w} onPlayWord={onPlayWord} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> 发音到位 (≥75)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> 需要打磨 (55~74)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" /> 明显偏差 (&lt;55)
          </span>
        </div>
      </div>

      {/* ④ 节奏与声学质量 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            <TimerIcon className="size-3.5" /> 节奏分析
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-muted-foreground">录音时长</dt>
            <dd className="font-mono text-foreground">{timing.duration_seconds}s</dd>
            <dt className="text-muted-foreground">净语音时长</dt>
            <dd className="font-mono text-foreground">{timing.speech_duration_seconds}s</dd>
            <dt className="text-muted-foreground">语速</dt>
            <dd className="font-mono text-foreground">{timing.words_per_minute} WPM</dd>
            <dt className="text-muted-foreground">最长停顿</dt>
            <dd className="font-mono text-foreground">{timing.longest_pause_ms} ms</dd>
            {(timing.trimmed_head_ms > 0 || timing.trimmed_tail_ms > 0) && (
              <>
                <dt className="text-muted-foreground">已裁静音</dt>
                <dd className="font-mono text-foreground">
                  {timing.trimmed_head_ms} / {timing.trimmed_tail_ms} ms
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            <WavesIcon className="size-3.5" /> 声学质量
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-muted-foreground">响度</dt>
            <dd className="font-mono text-foreground">{acoustic.rms_dbfs} dBFS</dd>
            <dt className="text-muted-foreground">信噪比</dt>
            <dd className="font-mono text-foreground">{acoustic.snr_db} dB</dd>
            <dt className="text-muted-foreground">语音占比</dt>
            <dd className="font-mono text-foreground">
              {(acoustic.activity.speech_ratio * 100).toFixed(0)}%
            </dd>
            <dt className="text-muted-foreground">基频中值</dt>
            <dd className="font-mono text-foreground">
              {acoustic.pitch_mean_hz !== null ? `${acoustic.pitch_mean_hz} Hz` : "--"}
            </dd>
          </dl>
          {acousticWarnings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {acousticWarnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ⑤ 发音教练建议 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          <LightbulbIcon className="size-3.5" /> 发音教练反馈
        </div>
        <div className="flex flex-col gap-2">
          {suggestions.map((tip, i) => {
            const severe = tip.severity === "HIGH"
            const praise = tip.type === "PRAISE"
            return (
              <div
                key={`${tip.type}-${i}`}
                className={`rounded-2xl border p-4 ${
                  praise
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : severe
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  {praise ? (
                    <AwardIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : severe ? (
                    <AlertTriangleIcon className="size-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <TrendingUpIcon className="size-4 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{tip.title}</span>
                  {tip.target && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {tip.target}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tip.detail}</p>
                {tip.practiceWords.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">练习词：</span>
                    {tip.practiceWords.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onPlayWord?.(w)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-muted"
                      >
                        <Volume2Icon className="size-3" />
                        {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ⑥ 可解释性脚注 */}
      <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <InfoIcon className="size-3.5" />
          分数是怎么算出来的？
        </summary>
        <div className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">准确度</span>：对参考音素串与录音做
            CTC 前向-后向强制对齐，取每个音素在所属帧的**边缘后验概率**（GOP），
            并融合该音素在帧内的排名；再与词级语音相似度、ASR 置信度加权。
          </p>
          <p>
            <span className="font-semibold text-foreground">完整度</span>
            ：词级对齐中未被识别出的参考词占比（漏读/吞音），多读词会额外扣分。
          </p>
          <p>
            <span className="font-semibold text-foreground">流利度</span>
            ：语速偏离、句内长停顿次数、有效语音占比与犹豫填充词。
          </p>
          <p className="flex items-center gap-1">
            <GaugeIcon className="size-3" />
            总分 = 准确度×0.5 + 完整度×0.3 + 流利度×0.2
          </p>
        </div>
      </details>
    </div>
  )
}

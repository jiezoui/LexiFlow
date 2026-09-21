"use client"

/**
 * 语脉 · 影子跟读评测结果面板（选项卡版）
 *
 * 评测结果信息量大（四维评分 + 逐词音素 + 节奏声学 + 教练建议），
 * 若全部纵向堆叠，一屏放不下、必须反复滚动，练习节奏会被打断。
 * 因此按「学习者此刻要回答的问题」拆成三个选项卡，一次只展示一件事：
 *
 *   ① 本轮反馈：综合得分 + 四维拆解 + 做得好的地方 + 主要问题 + 语速/停顿/语调
 *   ② 逐词发音：ASR 转写对照 + 逐词 IPA 与逐音素得分（点击试听 / 展开音素）
 *   ③ 完整分析：节奏与声学质量明细 + 发音教练建议 + 评分口径说明
 *
 * 评分逻辑与后端语音桥接服务（speech-bridge）一致，这里只做「可读化 + 分层」。
 */

import { useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  GaugeIcon,
  InfoIcon,
  LightbulbIcon,
  MicIcon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
  Volume2Icon,
  WavesIcon,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ShadowingAssessment, SpeechPhoneme, SpeechWord } from "@/lib/api-client"

interface ShadowingVerdictProps {
  result: ShadowingAssessment
  /** 点击单词时试听（由页面提供播放能力） */
  onPlayWord?: (word: string) => void
  className?: string
}

type VerdictTab = "feedback" | "words" | "analysis"

/** 三等分选项卡：一屏只讲一件事（综合反馈 / 逐词发音 / 完整分析）。 */
const VERDICT_TABS: { value: VerdictTab; label: string }[] = [
  { value: "feedback", label: "本轮反馈" },
  { value: "words", label: "逐词发音" },
  { value: "analysis", label: "完整分析" },
]

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
  准确度: "shadowing-metric-accuracy",
  完整度: "shadowing-metric-completeness",
  流利度: "shadowing-metric-fluency",
  韵律: "shadowing-metric-prosody",
}

/** 取一个词里得分最低的音素（用于「主要问题」行的 IPA 徽标）。 */
function worstPhoneme(word: SpeechWord): SpeechPhoneme | { phoneme: string; score: number } | null {
  if (word.phonemes.length > 0) {
    let worst: SpeechPhoneme = word.phonemes[0]
    for (const p of word.phonemes) if (p.score < worst.score) worst = p
    return worst
  }
  const fallback = word.problems[0]
  return fallback ? { phoneme: fallback.phoneme, score: fallback.score } : null
}

/** 单条指标：标签 + 进度条 + 数值，横向一行，比卡片省一半高度。 */
function MetricRow({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: number | null
  tone: "good" | "fair" | "poor"
  hint: string
}) {
  return (
    <div className="flex items-center gap-2.5" data-testid={METRIC_TESTID[label]} title={hint}>
      <span className="w-11 shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={`block h-full rounded-full transition-all duration-700 ${TONE_BAR[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      </span>
      <span
        className="flex w-9 shrink-0 items-baseline justify-end gap-0.5 font-mono"
        data-testid="metric-value"
        data-metric-value={value === null ? "" : value}
      >
        <span className="text-sm font-bold text-foreground">{value === null ? "--" : value}</span>
      </span>
    </div>
  )
}

/** 「主要问题」单行：IPA 徽标 + 词 + 一句诊断 + 试听。 */
function ProblemRow({
  word,
  worst,
  hint,
  onPlayWord,
}: {
  word: SpeechWord
  worst: { phoneme: string; score: number } | null
  hint: string
  onPlayWord?: (w: string) => void
}) {
  const tone = worst ? scoreTone(worst.score) : "fair"
  return (
    <button
      type="button"
      onClick={() => onPlayWord?.(word.word)}
      title="点击试听该词"
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <span
        className={`w-12 shrink-0 rounded-md border py-0.5 text-center font-mono text-[11px] font-bold ${TONE_CLASS[tone]}`}
      >
        {worst ? `/${worst.phoneme.replace(/^\/|\/$/g, "")}/` : "—"}
      </span>
      <span className="w-24 shrink-0 truncate font-serif text-[13px] font-semibold text-foreground">
        {word.status === "OMISSION" ? (
          <s className="text-muted-foreground">{word.word}</s>
        ) : (
          word.word
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{hint}</span>
      <Volume2Icon className="size-3 shrink-0 text-muted-foreground" />
    </button>
  )
}

/** 「其他反馈」单行：语速 / 停顿 / 语调。 */
function FeedbackRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof TimerIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="w-14 shrink-0 text-[11px] font-semibold text-foreground">{label}</span>
      <span className="shrink-0 font-mono text-[11px] font-bold text-foreground">{value}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{hint}</span>
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
    <div className={`rounded-xl border px-2.5 py-1.5 ${shell}`}>
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
            className={`rounded border px-1 font-mono text-[10px] font-bold ${
              TONE_CLASS[scoreTone(word.score)]
            }`}
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
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          /{word.ipa.replace(/^\/|\/$/g, "")}/
        </div>
      )}

      {open && word.phonemes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 border-t border-border/60 pt-1.5">
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
  const { scores, counts, timing, acoustic, suggestions, words, engine } = result
  const grade = GRADE_STYLES[result.grade] ?? GRADE_STYLES.FAIR

  const [tab, setTab] = useState<VerdictTab>("feedback")

  const acousticWarnings = useMemo(() => {
    const list: string[] = []
    if (acoustic.clipping_ratio > 0.005) list.push("检测到削波，请调低麦克风增益")
    if (acoustic.rms_dbfs < -38) list.push("录音电平偏低，请靠近麦克风")
    if (acoustic.snr_db < 12) list.push("环境噪声较大，建议安静环境录音")
    if (acoustic.activity.speech_ratio < 0.25) list.push("有效语音占比低，可能未对准麦克风")
    return list
  }, [acoustic])

  /** 音素 → 教练给出的口型/舌位要领，用于「主要问题」的一句话诊断。 */
  const phonemeHints = useMemo(() => {
    const map = new Map<string, string>()
    for (const tip of suggestions) {
      if (tip.type === "PHONEME" && tip.target) {
        map.set(tip.target.replace(/\//g, ""), tip.detail)
      }
    }
    return map
  }, [suggestions])

  const praises = useMemo(() => suggestions.filter((s) => s.type === "PRAISE"), [suggestions])
  const fixes = useMemo(() => suggestions.filter((s) => s.type !== "PRAISE"), [suggestions])

  const perfectWords = useMemo(
    () => words.filter((w) => w.status === "CORRECT" && w.score >= 85),
    [words]
  )

  /** 需要关注的词：漏读 / 误读 / 词或音素得分偏低。 */
  const problemRows = useMemo(() => {
    return words
      .map((word) => {
        const worst = worstPhoneme(word)
        const isMissing = word.status === "OMISSION"
        const isWrong = word.status === "SUBSTITUTION"
        const lowWord = word.score > 0 && word.score < 65
        const lowPhoneme = worst !== null && worst.score < 60
        return { word, worst, urgent: isMissing || isWrong, hit: isMissing || isWrong || lowWord || lowPhoneme }
      })
      .filter((row) => row.hit)
      .sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
        return (a.worst?.score ?? 100) - (b.worst?.score ?? 100)
      })
  }, [words])

  /** 最弱维度：练习建议的第一句。 */
  const weakestMetric = useMemo(() => {
    const entries: [string, number][] = [
      ["准确度", scores.accuracy],
      ["完整度", scores.completeness],
      ["流利度", scores.fluency],
    ]
    if (scores.prosody !== null) entries.push(["韵律", scores.prosody])
    return entries.reduce((a, b) => (b[1] < a[1] ? b : a))
  }, [scores])

  /** 整句里平均分最低的音素。 */
  const weakestPhoneme = useMemo(() => {
    const agg = new Map<string, { sum: number; n: number }>()
    for (const w of words) {
      for (const p of w.phonemes) {
        const cur = agg.get(p.phoneme) ?? { sum: 0, n: 0 }
        cur.sum += p.score
        cur.n += 1
        agg.set(p.phoneme, cur)
      }
    }
    let best: { phoneme: string; score: number } | null = null
    for (const [phoneme, v] of agg) {
      if (v.n === 0) continue
      const score = v.sum / v.n
      if (best === null || score < best.score) best = { phoneme, score: Math.round(score) }
    }
    return best
  }, [words])

  const advice = useMemo(() => {
    const parts: string[] = []
    if (weakestPhoneme && weakestPhoneme.score < 80) {
      parts.push(`重点打磨 /${weakestPhoneme.phoneme.replace(/^\/|\/$/g, "")}/（均分 ${weakestPhoneme.score}）`)
    }
    parts.push(`当前最弱的是「${weakestMetric[0]}」`)
    if (timing.words_per_minute > 190) parts.push("适当放慢语速")
    else if (timing.words_per_minute > 0 && timing.words_per_minute < 150) parts.push("语速偏慢，先保证连读再提速")
    if (timing.pause_count > 2) parts.push("按意群切分，减少句内长停顿")
    return `${parts.join("，")}。按教练提示调整口型后，用 0.75x 慢速跟读一遍再录。`
  }, [weakestPhoneme, weakestMetric, timing])

  const wpmHint =
    timing.words_per_minute > 190
      ? "偏快，建议 150~190"
      : timing.words_per_minute > 0 && timing.words_per_minute < 150
      ? "偏慢，可再连贯些"
      : "节奏合适"
  const prosodyHint =
    acoustic.pitch_range_semitones !== null
      ? `基频跨度 ${acoustic.pitch_range_semitones} 半音`
      : "未测得基频"

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as VerdictTab)}
        className="gap-3"
      >
        {/* 选项卡：一屏只讲一件事，避免长报告式滚动 */}
        <TabsList
          variant="line"
          className="h-9 w-full justify-start gap-0 rounded-none border-b border-border/70 bg-transparent p-0"
        >
          {VERDICT_TABS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-9 flex-1 gap-1.5 rounded-none px-2 font-mono text-xs font-bold"
            >
              {label}
              {value === "feedback" && <ProblemCountBadge count={problemRows.length} />}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── ① 本轮反馈 ────────────────────────────────────────────── */}
        <TabsContent value="feedback" className="flex flex-col gap-3">
          <div className="grid gap-2.5 sm:grid-cols-[170px_minmax(0,1fr)]">
            <div
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-center ${grade.ring}`}
            >
              <span className="text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
                综合跟读得分
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-mono text-4xl font-extrabold ${grade.text}`}
                  data-testid="shadowing-metric-overall"
                  data-metric-value={scores.overall}
                >
                  {Math.round(scores.overall)}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">/100</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-center text-[10px] leading-tight font-bold ${grade.chip}`}
              >
                {result.grade_label}
              </span>
            </div>

            <div className="flex flex-col justify-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3">
              <MetricRow
                label="准确度"
                value={scores.accuracy}
                tone={scoreTone(scores.accuracy)}
                hint={`${counts.correct} 读对 / ${counts.substitution} 误读`}
              />
              <MetricRow
                label="完整度"
                value={scores.completeness}
                tone={scoreTone(scores.completeness)}
                hint={`${counts.omission} 漏读 / ${counts.insertion} 多读`}
              />
              <MetricRow
                label="流利度"
                value={scores.fluency}
                tone={scoreTone(scores.fluency)}
                hint={`${timing.words_per_minute} WPM · ${timing.pause_count} 处停顿`}
              />
              <MetricRow
                label="韵律"
                value={scores.prosody}
                tone={scores.prosody === null ? "fair" : scoreTone(scores.prosody)}
                hint={prosodyHint}
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                参考 {counts.total_reference} 词 · 读对 {counts.correct} · 误读{" "}
                {counts.substitution} · 漏读 {counts.omission} · 多读 {counts.insertion} · 音素{" "}
                {counts.total_phonemes} 个（低分 {counts.poor_phonemes}）
              </p>
            </div>
          </div>

          {(praises.length > 0 || perfectWords.length > 0) && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <AwardIcon className="size-3" />
                做得好的地方
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {praises.slice(0, 2).map((tip, i) => (
                  <li key={`${tip.title}-${i}`} className="text-[11px] leading-snug text-foreground">
                    <span className="font-semibold">{tip.title}</span>
                    <span className="text-muted-foreground"> · {tip.detail}</span>
                  </li>
                ))}
                {perfectWords.length > 0 && (
                  <li className="text-[11px] leading-snug text-muted-foreground">
                    共 {perfectWords.length} 个词发音到位（≥85 分）：
                    <span className="font-serif text-foreground">
                      {perfectWords
                        .slice(0, 8)
                        .map((w) => w.word)
                        .join("、")}
                    </span>
                    {perfectWords.length > 8 ? " …" : ""}
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertTriangleIcon className="size-3" />
                主要问题
                <span className="rounded-full bg-muted px-1.5 text-[10px]">
                  {problemRows.length}
                </span>
              </span>
              {problemRows.length > 4 && (
                <button
                  type="button"
                  onClick={() => setTab("words")}
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-primary hover:underline"
                >
                  查看全部
                  <ArrowRightIcon className="size-3" />
                </button>
              )}
            </div>
            {problemRows.length === 0 ? (
              <p className="px-3.5 py-3 text-[11px] text-muted-foreground">
                本句没有明显的漏读或误读，继续保持这个状态 👍
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border/60">
                {problemRows.slice(0, 4).map((row, i) => {
                  const phoneme = row.worst
                    ? row.worst.phoneme.replace(/^\/|\/$/g, "")
                    : ""
                  const hint =
                    row.word.status === "OMISSION"
                      ? "整词漏读：词尾 -s / -ed / -t / -d 也要发出来"
                      : row.word.status === "SUBSTITUTION"
                      ? `读成了「${row.word.actual_word ?? "其它词"}」${
                          phoneme ? `，注意 /${phoneme}/ 的口型` : ""
                        }`
                      : (phoneme && phonemeHints.get(phoneme)) ||
                        `/${phoneme}/ 得分 ${Math.round(row.worst?.score ?? 0)}，点击试听对照`
                  return (
                    <ProblemRow
                      key={`${row.word.word}-${i}`}
                      word={row.word}
                      worst={row.worst}
                      hint={hint}
                      onPlayWord={onPlayWord}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* 语速 / 停顿 / 语调：面板固定在右列（约 400px）展示，单列堆叠更好读 */}
          <div className="grid gap-2">
            <FeedbackRow
              icon={TimerIcon}
              label="语速"
              value={`${timing.words_per_minute} WPM`}
              hint={wpmHint}
            />
            <FeedbackRow
              icon={WavesIcon}
              label="停顿"
              value={`${timing.pause_count} 处`}
              hint={
                timing.pause_count === 0
                  ? "句内几乎无停顿，很连贯"
                  : `最长 ${timing.longest_pause_ms} ms`
              }
            />
            <FeedbackRow
              icon={GaugeIcon}
              label="语调"
              value={scores.prosody === null ? "--" : `${Math.round(scores.prosody)} 分`}
              hint={
                scores.prosody === null
                  ? "未测得基频"
                  : scores.prosody >= 75
                  ? "起伏接近原声"
                  : "语调平淡，可再夸张些"
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-2.5">
            <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <LightbulbIcon className="mt-0.5 size-3 shrink-0 text-amber-500" />
              <span>
                <span className="font-semibold text-foreground">练习建议：</span>
                {advice}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("words")}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors hover:bg-muted"
              >
                逐词发音
                <ArrowRightIcon className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setTab("analysis")}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-2.5 py-1.5 font-mono text-[11px] font-bold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                完整分析
                <ArrowRightIcon className="size-3" />
              </button>
            </div>
          </div>

          <p className="px-1 font-mono text-[10px] text-muted-foreground">
            {engine.asr} · {engine.asr_model}
            {engine.phoneme_alignment ? " · 音素级对齐已启用" : " · 仅词级评分"} · 评测耗时{" "}
            {result.processing_ms} ms
          </p>
        </TabsContent>

        {/* ── ② 逐词发音 ────────────────────────────────────────────── */}
        <TabsContent value="words" className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <MicIcon className="size-3" />
              系统听到的内容（ASR 转写）
            </div>
            <p className="mt-1 font-serif text-[13px] leading-snug text-foreground">
              {result.transcribed_text || (
                <span className="text-muted-foreground">（未识别到语音）</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BadgeCheckIcon className="size-3" />
              逐词 IPA 与音素得分（点击单词试听，再点展开音素）
            </span>
            <span>基准音素 {counts.total_phonemes} 个 · 低分音素 {counts.poor_phonemes} 个</span>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/80 bg-card/70 p-3">
            {words.map((w, i) => (
              <WordChip key={`${w.word}-${i}`} word={w} onPlayWord={onPlayWord} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 px-1 font-mono text-[10px] text-muted-foreground">
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
        </TabsContent>

        {/* ── ③ 完整分析 ────────────────────────────────────────────── */}
        <TabsContent value="analysis" className="flex flex-col gap-3">
          {/* 节奏 / 声学：右列宽度有限，卡片上下堆叠 */}
          <div className="grid gap-2.5">
            <section className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <TimerIcon className="size-3.5" /> 节奏分析
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-[11px]">
                <dt className="text-muted-foreground">录音时长</dt>
                <dd className="font-mono text-foreground">{timing.duration_seconds}s</dd>
                <dt className="text-muted-foreground">净语音时长</dt>
                <dd className="font-mono text-foreground">{timing.speech_duration_seconds}s</dd>
                <dt className="text-muted-foreground">语速</dt>
                <dd className="font-mono text-foreground">{timing.words_per_minute} WPM</dd>
                <dt className="text-muted-foreground">句内停顿</dt>
                <dd className="font-mono text-foreground">{timing.pause_count} 处</dd>
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
            </section>

            <section className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <WavesIcon className="size-3.5" /> 声学质量
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-[11px]">
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
                <ul className="mt-2.5 flex flex-col gap-1">
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
            </section>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <LightbulbIcon className="size-3.5" /> 发音教练反馈
            </div>
            <div className="flex flex-col gap-2">
              {[...fixes, ...praises].map((tip, i) => {
                const severe = tip.severity === "HIGH"
                const praise = tip.type === "PRAISE"
                return (
                  <div
                    key={`${tip.type}-${i}`}
                    className={`rounded-2xl border p-3.5 ${
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
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {tip.detail}
                    </p>
                    {tip.practiceWords.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">练习词：</span>
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

          <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <InfoIcon className="size-3.5" />
              分数是怎么算出来的？
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">准确度</span>
                ：对参考音素串与录音做 CTC 前向-后向强制对齐，取每个音素在所属帧的边缘后验概率（GOP），
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
              <p className="flex items-center gap-1">
                <SparklesIcon className="size-3" />
                {engine.asr} · {engine.asr_model} · 评测耗时 {result.processing_ms} ms
              </p>
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** 「主要问题」数量徽标（0 时不渲染）。 */
function ProblemCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="rounded-full bg-rose-500/15 px-1.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
      {count}
    </span>
  )
}

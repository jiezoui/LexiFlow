/**
 * Transcript Engine - 统一字幕转译与分句规整引擎
 * 参考设计：媒体来源各异（YouTube / Podcast RSS / Whisper ASR），但进入学习系统后全部统一。
 */

export interface RawTranscriptCue {
  startMs: number
  endMs: number
  text: string
  speaker?: string
}

export interface NormalizedTranscriptCue {
  sequenceNo: number
  startMs: number
  endMs: number
  sourceText: string
  translation?: string
  tokens?: string[]
}

/**
 * 标点切分正则：英中文句末标点（. ? ! 。 ！ ？）后带空白或位于文本末尾
 */
const SENTENCE_END_REGEX = /([.?!。！？]+["'”’]?)(?:\s+|$)/g

/**
 * Transcript Normalizer:
 * 将长段落话语（例如 10~30 秒的长语音转写或官方全文字幕）
 * 根据标点符号与时长比例，平滑切分为适合精听研习的 2~8 秒短句。
 */
export function normalizeTranscriptCues(
  rawCues: RawTranscriptCue[],
  options: {
    minDurationMs?: number
    maxDurationMs?: number
    targetDurationMs?: number
  } = {}
): NormalizedTranscriptCue[] {
  const { minDurationMs = 1500, maxDurationMs = 8000 } = options
  const result: NormalizedTranscriptCue[] = []
  let sequenceNo = 1

  for (const cue of rawCues) {
    const text = cue.text.trim()
    const totalDuration = Math.max(cue.endMs - cue.startMs, 100)

    // 如果本身就是短句，直接加入
    if (totalDuration <= maxDurationMs && !hasMultipleSentences(text)) {
      result.push({
        sequenceNo: sequenceNo++,
        startMs: Math.round(cue.startMs),
        endMs: Math.round(cue.endMs),
        sourceText: text,
      })
      continue
    }

    // 存在多句或总时长较长，按句切分并按字符权重分配时间戳
    const sentences = splitIntoSentences(text)
    if (sentences.length <= 1) {
      result.push({
        sequenceNo: sequenceNo++,
        startMs: Math.round(cue.startMs),
        endMs: Math.round(cue.endMs),
        sourceText: text,
      })
      continue
    }

    const totalChars = sentences.reduce((acc, s) => acc + s.length, 0) || 1
    let currentStart = cue.startMs

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const ratio = sentence.length / totalChars
      const sentenceDuration = Math.max(totalDuration * ratio, minDurationMs)
      const currentEnd =
        i === sentences.length - 1 ? cue.endMs : Math.min(currentStart + sentenceDuration, cue.endMs)

      result.push({
        sequenceNo: sequenceNo++,
        startMs: Math.round(currentStart),
        endMs: Math.round(currentEnd),
        sourceText: sentence,
      })

      currentStart = currentEnd
    }
  }

  return result
}

function hasMultipleSentences(text: string): boolean {
  const matches = text.match(SENTENCE_END_REGEX)
  return Boolean(matches && matches.length > 1)
}

function splitIntoSentences(text: string): string[] {
  const result: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // 重置正则索引
  SENTENCE_END_REGEX.lastIndex = 0

  while ((match = SENTENCE_END_REGEX.exec(text)) !== null) {
    const end = match.index + match[1].length
    const sentence = text.slice(lastIndex, end).trim()
    if (sentence) {
      result.push(sentence)
    }
    lastIndex = SENTENCE_END_REGEX.lastIndex
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim()
    if (remaining) {
      result.push(remaining)
    }
  }

  return result.length > 0 ? result : [text]
}

export interface TodayMissionStats {
  dueReview: number
  newWords: number
  estimatedMinutes: number
  progressPercent: number
  streakDays: number
  totalReviews: number
  fsrsStatus: string
}

export interface ActiveWordbook {
  id: string
  title: string
  category: string
  learnedWords: number
  totalWords: number
  progressPercent: number
  targetDate: string
  dailyTarget: number
}

export interface ContextCaptureItem {
  id: string
  title: string
  type: "VIDEO" | "ARTICLE" | "VOCAB"
  source: string
  timeAgo: string
  capturedCount: number
  timestamp?: string
  sentence: string
  sampleWord: string
  gradient: string
}

export interface WordbookItem {
  id: string
  title: string
  category: string
  description: string
  totalWords: number
  learnedWords: number
  coverGradient: string
  tags: string[]
  isPrimary?: boolean
}

export interface VocabularyItem {
  id: string
  word: string
  phonetic: string
  pos: string
  definition: string
  contextSentence: string
  highlightWord: string
  sourceMedia: string
  sourceType: "VIDEO" | "ARTICLE" | "BOOK"
  stability: number // FSRS 稳定性天数
  difficulty: number // FSRS 难度 (1-10)
  fsrsState: "Learning" | "Review" | "Relearning"
  nextReview: string
  starred: boolean
}

export const mockTodayStats: TodayMissionStats = {
  dueReview: 47,
  newWords: 20,
  estimatedMinutes: 26,
  progressPercent: 69,
  streakDays: 12,
  totalReviews: 1286,
  fsrsStatus: "FSRS · 已排期",
}

export const mockActiveWordbook: ActiveWordbook = {
  id: "",
  title: "暂无主研习词书",
  category: "",
  learnedWords: 0,
  totalWords: 0,
  progressPercent: 0,
  targetDate: "",
  dailyTarget: 20,
}

export const mockContextCaptures: ContextCaptureItem[] = []

export const mockHeatmapMatrix: number[] = [
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,
]

export const mockWordbooks: WordbookItem[] = []

export const mockVocabList: VocabularyItem[] = []

// ── Analytics Overview Mock Data ──────────────────────────────────────────────

export interface AnalyticsKpiItem {
  title: string
  value: string | number
  unit?: string
  delta: string
  sublabel: string
  sparkline: number[]
}

export const mockAnalyticsKpi: Record<string, AnalyticsKpiItem> = {
  mastered: {
    title: "长期记忆词汇量",
    value: "0",
    unit: "词",
    delta: "+0 词",
    sublabel: "暂无已掌握词汇",
    sparkline: [0, 0, 0, 0, 0, 0],
  },
  stability: {
    title: "平均记忆半衰期 (S)",
    value: "0",
    unit: "天",
    delta: "0 天",
    sublabel: "等待首次复习计算",
    sparkline: [0, 0, 0, 0, 0, 0],
  },
  contextHarvest: {
    title: "语境切片采摘密度",
    value: "0",
    unit: "条",
    delta: "覆盖 0 个素材",
    sublabel: "暂无语境切片",
    sparkline: [0, 0, 0, 0, 0, 0],
  },
  shadowingAccuracy: {
    title: "影子跟读声学评分",
    value: "--",
    unit: "分",
    delta: "等待评级",
    sublabel: "暂无跟读评测",
    sparkline: [0, 0, 0, 0, 0, 0],
  },
}

export const mockFsrsRetentionData = [
  { day: "D1", fsrs: 98, ebbinghaus: 100, threshold: 90 },
  { day: "D3", fsrs: 94, ebbinghaus: 58, threshold: 90 },
  { day: "D5", fsrs: 91, ebbinghaus: 42, threshold: 90 },
  { day: "D7", fsrs: 97, ebbinghaus: 33, threshold: 90 }, // Review 1 boost
  { day: "D9", fsrs: 95, ebbinghaus: 28, threshold: 90 },
  { day: "D12", fsrs: 92, ebbinghaus: 24, threshold: 90 },
  { day: "D15", fsrs: 98, ebbinghaus: 21, threshold: 90 }, // Review 2 boost
  { day: "D18", fsrs: 96, ebbinghaus: 19, threshold: 90 },
  { day: "D21", fsrs: 93, ebbinghaus: 17, threshold: 90 },
  { day: "D24", fsrs: 91, ebbinghaus: 15, threshold: 90 },
  { day: "D27", fsrs: 98, ebbinghaus: 14, threshold: 90 }, // Review 3 boost
  { day: "D30", fsrs: 96, ebbinghaus: 13, threshold: 90 },
]

export const mockRadarData = [
  { subject: "原声听力辨析", userScore: 88, average: 65, fullMark: 100 },
  { subject: "长难句理解", userScore: 92, average: 70, fullMark: 100 },
  { subject: "拼写肌肉记忆", userScore: 84, average: 72, fullMark: 100 },
  { subject: "影子跟读音准", userScore: 91, average: 58, fullMark: 100 },
  { subject: "考纲核心覆盖", userScore: 78, average: 80, fullMark: 100 },
  { subject: "长期记忆稳定性", userScore: 95, average: 68, fullMark: 100 },
]

export const mockCognitiveLoadData = [
  { date: "08/29", newWords: 20, review: 38, lapse: 6 },
  { date: "08/30", newWords: 18, review: 42, lapse: 4 },
  { date: "08/31", newWords: 20, review: 45, lapse: 7 },
  { date: "09/01", newWords: 22, review: 40, lapse: 5 },
  { date: "09/02", newWords: 15, review: 36, lapse: 3 },
  { date: "09/03", newWords: 20, review: 44, lapse: 8 },
  { date: "09/04", newWords: 20, review: 46, lapse: 5 },
  { date: "09/05", newWords: 25, review: 41, lapse: 4 },
  { date: "09/06", newWords: 18, review: 39, lapse: 6 },
  { date: "09/07", newWords: 20, review: 43, lapse: 5 },
  { date: "09/08", newWords: 20, review: 47, lapse: 7 },
  { date: "09/09", newWords: 22, review: 45, lapse: 4 },
  { date: "09/10", newWords: 20, review: 44, lapse: 5 },
  { date: "09/11", newWords: 20, review: 47, lapse: 6 },
]

export const mockCorpusDistributionData = [
  { source: "YouTube 播客精听", count: 35, percentage: 42, fill: "#09090B" },
  { source: "B站技术原声演讲", count: 24, percentage: 28, fill: "#3F3F46" },
  { source: "外刊深度长文阅读", count: 15, percentage: 18, fill: "#71717A" },
  { source: "CET-6 权威大纲词书", count: 10, percentage: 12, fill: "#A1A1AA" },
]

export const mockVelocityCompositeData = [
  { date: "08/29", newWords: 20, reviewWords: 38, totalThroughput: 58, retentionRate: 94.2, flowScore: 91 },
  { date: "08/30", newWords: 18, reviewWords: 42, totalThroughput: 60, retentionRate: 94.6, flowScore: 89 },
  { date: "08/31", newWords: 20, reviewWords: 45, totalThroughput: 65, retentionRate: 95.0, flowScore: 94 },
  { date: "09/01", newWords: 22, reviewWords: 40, totalThroughput: 62, retentionRate: 95.3, flowScore: 92 },
  { date: "09/02", newWords: 15, reviewWords: 36, totalThroughput: 51, retentionRate: 94.9, flowScore: 88 },
  { date: "09/03", newWords: 20, reviewWords: 44, totalThroughput: 64, retentionRate: 95.4, flowScore: 95 },
  { date: "09/04", newWords: 20, reviewWords: 46, totalThroughput: 66, retentionRate: 95.8, flowScore: 96 },
  { date: "09/05", newWords: 25, reviewWords: 41, totalThroughput: 66, retentionRate: 96.0, flowScore: 93 },
  { date: "09/06", newWords: 18, reviewWords: 39, totalThroughput: 57, retentionRate: 95.7, flowScore: 90 },
  { date: "09/07", newWords: 20, reviewWords: 43, totalThroughput: 63, retentionRate: 96.1, flowScore: 93 },
  { date: "09/08", newWords: 20, reviewWords: 47, totalThroughput: 67, retentionRate: 96.3, flowScore: 95 },
  { date: "09/09", newWords: 22, reviewWords: 45, totalThroughput: 67, retentionRate: 96.5, flowScore: 97 },
  { date: "09/10", newWords: 20, reviewWords: 44, totalThroughput: 64, retentionRate: 96.2, flowScore: 94 },
  { date: "09/11", newWords: 20, reviewWords: 47, totalThroughput: 67, retentionRate: 96.8, flowScore: 98 },
]


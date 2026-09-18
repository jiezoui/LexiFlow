/**
 * 语脉 · LexiFlow 统一前端 API 客户端
 * 自动拦截请求头附带 Bearer Token，统一响应处理与错误捕获
 */

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  timestamp: string
}

export interface UserInfo {
  id: number
  username: string
  email: string
  nickname: string
  avatar: string
  createdAt: string
}

export interface LoginResult {
  token: string
  tokenType: string
  expiresIn: number
  user: UserInfo
}

export interface MediaUploadSession {
  uploadId: string
  mediaId: string
  totalSize: number
  partSize: number
  totalParts: number
  uploadedBytes: number
  status: string
  expiresAt: string
}

export interface MediaUploadPart {
  partNumber: number
  size: number
  sha256: string
  uploadedBytes: number
  totalParts: number
}

export interface CompletedMediaUpload {
  mediaId: string
  sha256: string
  mimeType: string
  job: {
    id: number
    status: string
    stage: string
    progress: number
  }
}

export interface MediaPlayback {
  type: string | null
  url: string | null
  mimeType: string | null
  fileSize: number | null
}

export interface MediaItem {
  id: string
  title: string
  creator: string | null
  source: string
  coverUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  level: string | null
  wpm: number | null
  status: "UPLOADING" | "PROCESSING" | "WAITING_SUBTITLE" | "READY" | "FAILED" | string
  processingStage: string | null
  subtitleStatus: string
  translationStatus: "DISABLED" | "PENDING" | "TRANSLATING" | "READY" | "PARTIAL" | "FAILED" | string
  translationProgress: number
  translationTarget: string | null
  translationError: string | null
  errorMessage: string | null
  playback: MediaPlayback
  createdAt: string
}

export interface MediaCue {
  id: number
  sequenceNo: number
  startMs: number
  endMs: number
  sourceText: string
  translation: string | null
  translationLang: string | null
  tokens: string | null
}

export interface MediaCueTranslation {
  cueId: number
  translation: string
  translationLang: string | null
  translationProvider: string | null
}

export interface MediaAsyncJob {
  id: number
  jobType: string
  status: string
  stage: string
  progress: number
  lastError: string | null
}

export interface DictEntry {
  id: number
  lemma: string
  phoneticUs: string
  phoneticUk: string
  audioUs: string
  audioUk: string
  pos: string
  definitionCn: string
  definitionEn: string
  tags: string
  frequencyRank: number
  sampleSentence: string
  sampleTranslation: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
}

export interface Wordbook {
  id: number
  title: string
  description: string
  category: "EXAM" | "COLLOQUIAL" | "PROFESSIONAL"
  coverUrl: string
  totalWords: number
  learnedWords: number
  masteredWords: number
  progressPercent: number
  createdAt: string
}

export interface WordbookItem {
  id: number
  wordId: number
  chapterIndex: number
  orderIndex: number
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string
  definitionCn: string
  definitionEn: string
  audioUs: string
  sampleSentence: string
  sampleTranslation: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
  isInUserVocab: boolean
  cardState: number | null
  isKnown: boolean
}

export interface WordbookStudyItem {
  wordId: number
  cardId: number | null
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string
  definitionCn: string
  definitionEn: string
  audioUs?: string
  sampleSentence?: string
  sampleTranslation?: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
  studyStatus: "UNLEARNED" | "REVIEWING" | "COMPLETED" | "MASTERED"
  isKnown: number
  masteredDate?: string | null
  chapterIndex: number
  orderIndex: number
}

export interface WordbookStatusCounts {
  allCount: number
  unlearnedCount: number
  reviewingCount: number
  completedCount: number
  masteredCount: number
  dueCount?: number
  masteredDates: { date: string; count: number }[]
}

export interface WordbookBatchRequest {
  wordIds: number[]
  action: "LEARN" | "MARK_KNOWN" | "RESET" | "DELETE"
}

export interface UserWordCard {
  id: number
  wordId: number
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string
  definitionCn: string
  definitionEn: string
  audioUs: string
  source: string
  contextSentence: string
  contextTranslation: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
  state: number
  stateDescription: string
  stability: number
  difficulty: number
  retrievability: number
  dueAt: string
  lastReview: string | null
  reps: number
  lapses: number
  isKnown: number
  createdAt: string
}

export interface VocabOverview {
  totalWords: number
  dueToday: number
  newWords: number
  learningWords: number
  reviewWords: number
  relearningWords: number
  masteredWords: number
}

export interface ReviewQueueCard {
  cardId: number
  wordId: number
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string
  definitionCn: string
  definitionEn: string
  audioUs: string
  source: string
  contextSentence: string
  contextTranslation: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
  state: number
  stability: number
  difficulty: number
  reps: number
  nextIntervals: Record<number, string> // 1: "10m", 2: "1d", 3: "3d", 4: "7d"
}

export interface QuizOption {
  key: string
  text: string
  isCorrect: boolean
}

export interface NewWordQuiz {
  cardId: number
  wordId: number
  lemma: string
  phoneticUs: string
  phoneticUk: string
  audioUs: string
  pos: string
  definitionCn: string
  definitionEn: string
  tags: string
  sampleSentence: string
  sampleTranslation: string
  synonyms?: string | null
  antonyms?: string | null
  derivatives?: string | null
  spokenExamples?: string | null
  ieltsUsage?: string | null
  options: QuizOption[]
}

export interface IeltsUsage {
  label: string
  scene: string
}

/**
 * Parse relation data returned by the backend. New data is stored as a JSON
 * array, while the delimiter fallback keeps older imported dictionary rows
 * usable as well.
 */
export function parseJsonArray(value?: string | null): string[] {
  const source = value?.trim()
  if (!source) return []

  try {
    const parsed: unknown = JSON.parse(source)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  } catch {
    // Older dictionary rows may contain a plain delimiter-separated string.
  }

  return source
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Parse the IELTS usage JSON object without letting malformed legacy data break the UI. */
export function parseIeltsUsage(value?: string | null): IeltsUsage | null {
  const source = value?.trim()
  if (!source) return null

  try {
    const parsed: unknown = JSON.parse(source)
    if (typeof parsed === "string") {
      const scene = parsed.trim()
      return scene ? { label: "IELTS", scene } : null
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      const rawLabel = record.label ?? record.level ?? record.band ?? record.title
      const rawScene = record.scene ?? record.context ?? record.description ?? record.usage
      const label = typeof rawLabel === "string" ? rawLabel.trim() : ""
      const scene = typeof rawScene === "string" ? rawScene.trim() : ""

      if (label || scene) {
        return { label: label || "IELTS", scene }
      }
    }
  } catch {
    // Preserve a readable fallback for legacy plain-text values.
  }

  return { label: "IELTS", scene: source }
}

export interface ReviewResult {
  cardId: number
  rating: number
  newState: number
  newStability: number
  newDifficulty: number
  scheduledDays: number
  nextDueAt: string
  intervalText: string
  reps: number
  lapses: number
}

export interface TodayReviewSummary {
  completedToday: number
  remainingToday: number
  durationMinutesToday: number
  todayRetentionRate: number
}

export interface HeatmapDay {
  date: string
  count: number
  level: number // 0 ~ 4
  durationMinutes: number
  newCards: number
  reviewCards: number
}

export interface LearningOverviewStats {
  streakDays: number
  totalReviews: number
  totalDurationMinutes: number
  totalVocabulary: number
  masteredWords: number
  overallRetentionRate: number
}

export interface ReadingArticle {
  id: number
  channel: string
  sourceName: string
  title: string
  link: string
  coverUrl?: string
  summary: string
  wordCount: number
  readMinutes: number
  cefrLevel: "B1" | "B2" | "C1" | "C2" | string
  targetWords: string[]
  publishedAt: string
}

export interface ReadingArticleDetail extends ReadingArticle {
  paragraphs: string[]
}

export interface ChannelStat {
  code: string
  name: string
  articleCount: number
}

const TOKEN_KEY = "lexiflow_jwt_token"

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export const clearToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  let response: Response
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`网络请求超时 (8s): ${endpoint}`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    let errMsg = `HTTP Error: ${response.status} ${response.statusText}`
    try {
      const errJson = await response.json()
      if (errJson.message) errMsg = errJson.message
    } catch {}
    throw new Error(errMsg)
  }

  const json: ApiResponse<T> = await response.json()
  if (json.code !== 200) {
    throw new Error(json.message || "Request failed")
  }

  return json.data
}

async function uploadBinary<T>(endpoint: string, body: Blob, signal?: AbortSignal): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body,
    signal,
  })
  if (!response.ok) {
    let message = `HTTP Error: ${response.status} ${response.statusText}`
    try {
      const payload = await response.json()
      if (payload.message) message = payload.message
    } catch {}
    throw new Error(message)
  }

  const payload: ApiResponse<T> = await response.json()
  if (payload.code !== 200) {
    throw new Error(payload.message || "分片上传失败")
  }
  return payload.data
}

// 01. 身份认证 API
export const authApi = {
  login: (account: string, password: string) =>
    request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ account, password }),
    }),
  register: (data: { username: string; email: string; password: string; nickname?: string }) =>
    request<UserInfo>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMe: () => request<UserInfo>("/api/auth/me"),
}

// 02. 核心双语词典 API
export const dictApi = {
  search: (keyword: string, limit = 10) =>
    request<DictEntry[]>(`/api/dict/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`),
  getByLemma: (lemma: string) =>
    request<DictEntry>(`/api/dict/lemma/${encodeURIComponent(lemma)}`),
  getById: (id: number) =>
    request<DictEntry>(`/api/dict/id/${id}`),
  translate: (text: string) =>
    request<{ original: string; translation: string }>("/api/dict/translate", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  repairCustom: () =>
    request<{ repairedCount: number; message: string }>("/api/dict/repair-custom", {
      method: "POST",
    }),
}

// 03. 大纲词书 API
export const wordbookApi = {
  list: (category?: string) =>
    request<Wordbook[]>(category ? `/api/wordbooks?category=${category}` : "/api/wordbooks"),
  getDetail: (id: number) =>
    request<Wordbook>(`/api/wordbooks/${id}`),
  getWords: (id: number, params?: { chapter?: number; page?: number; size?: number }) => {
    const query = new URLSearchParams()
    if (params?.chapter) query.set("chapter", String(params.chapter))
    if (params?.page) query.set("page", String(params.page))
    if (params?.size) query.set("size", String(params.size))
    return request<{ records: WordbookItem[]; total: number; current: number; size: number }>(
      `/api/wordbooks/${id}/words?${query.toString()}`
    )
  },
  importToVocab: (id: number, limit = 20, chapter?: number) => {
    const query = new URLSearchParams()
    if (limit !== undefined) query.set("limit", String(limit))
    if (chapter !== undefined) query.set("chapter", String(chapter))
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<{ importedCount: number; remainingCount?: number; totalUnlearnedBefore?: number; message: string }>(
      `/api/wordbooks/${id}/import-to-vocab${qs}`,
      { method: "POST" }
    )
  },
  getStudyView: (
    id: number,
    params?: {
      status?: string
      date?: string
      keyword?: string
      page?: number
      size?: number
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.status) query.set("status", params.status)
    if (params?.date) query.set("date", params.date)
    if (params?.keyword) query.set("keyword", params.keyword)
    if (params?.page) query.set("page", String(params.page))
    if (params?.size) query.set("size", String(params.size))
    return request<{ records: WordbookStudyItem[]; total: number; current: number; size: number }>(
      `/api/wordbooks/${id}/study-view?${query.toString()}`
    )
  },
  getStatusCounts: (id: number) =>
    request<WordbookStatusCounts>(`/api/wordbooks/${id}/status-counts`),
  batchAction: (id: number, data: WordbookBatchRequest) =>
    request<{ affectedCount: number; message: string }>(`/api/wordbooks/${id}/batch`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  upload: async (formData: FormData) => {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    const response = await fetch("/api/wordbooks/upload", {
      method: "POST",
      headers,
      body: formData,
    })
    if (!response.ok) {
      let errMsg = `HTTP Error: ${response.status}`
      try {
        const errJson = await response.json()
        if (errJson.message) errMsg = errJson.message
      } catch {}
      throw new Error(errMsg)
    }
    const json = await response.json()
    if (json.code !== 200) {
      throw new Error(json.message || "上传解析失败")
    }
    return json.data as Wordbook
  },
  delete: (id: number) =>
    request<{ id: number; message: string }>(`/api/wordbooks/${id}`, {
      method: "DELETE",
    }),
}

// 04. 个人生词卡片 API
export const vocabApi = {
  addCard: (data: {
    lemma: string
    wordId?: number
    source?: string
    wordbookId?: number
    contextSentence?: string
    contextTranslation?: string
  }) =>
    request<UserWordCard>("/api/vocab/cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCards: (params?: {
    state?: number
    isKnown?: number
    wordbookId?: number
    keyword?: string
    isDue?: boolean
    page?: number
    size?: number
  }) => {
    const query = new URLSearchParams()
    if (params?.state !== undefined) query.set("state", String(params.state))
    if (params?.isKnown !== undefined) query.set("isKnown", String(params.isKnown))
    if (params?.wordbookId) query.set("wordbookId", String(params.wordbookId))
    if (params?.keyword) query.set("keyword", params.keyword)
    if (params?.isDue !== undefined) query.set("isDue", String(params.isDue))
    if (params?.page) query.set("page", String(params.page))
    if (params?.size) query.set("size", String(params.size))
    return request<{ records: UserWordCard[]; total: number; current: number; size: number }>(
      `/api/vocab/cards?${query.toString()}`
    )
  },
  markKnown: (cardId: number, isKnown = true) =>
    request<{ id: number; isKnown: boolean; message: string }>(`/api/vocab/cards/${cardId}/mark-known?isKnown=${isKnown}`, {
      method: "POST",
    }),
  deleteCard: (cardId: number) =>
    request<{ id: number; message: string }>(`/api/vocab/cards/${cardId}`, {
      method: "DELETE",
    }),
  getOverview: () =>
    request<VocabOverview>("/api/vocab/overview"),
  getCardByLemma: (lemma: string) =>
    request<UserWordCard | null>(`/api/vocab/card-by-lemma?lemma=${encodeURIComponent(lemma)}`),
  toggleKnown: (lemma: string, isKnown = true) =>
    request<UserWordCard>(`/api/vocab/toggle-known?lemma=${encodeURIComponent(lemma)}&isKnown=${isKnown}`, {
      method: "POST",
    }),
  checkHarvested: (words: string[]) =>
    request<string[]>("/api/vocab/check-harvested", {
      method: "POST",
      body: JSON.stringify(words),
    }),
}

// 05. 间隔复习调度核心 API (FSRS-4.5)
export const reviewApi = {
  getQueue: (limit = 30) =>
    request<ReviewQueueCard[]>(`/api/review/queue?limit=${limit}`),
  submitRating: (data: { cardId: number; rating: 1 | 2 | 3 | 4; reviewDurationMs?: number }) =>
    request<ReviewResult>("/api/review/rating", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTodaySummary: () =>
    request<TodayReviewSummary>("/api/review/today-summary"),
  getNewQueue: (limit = 15) =>
    request<NewWordQuiz[]>(`/api/review/new-queue?limit=${limit}`),
  submitNewWord: (data: { cardId: number; action: "LEARNED" | "AGAIN" | "KNOWN"; durationMs?: number }) =>
    request<{ cardId: number; action: string; message: string }>("/api/review/new-word-submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  clearReviewQueue: () =>
    request<{ deletedCount: number; message: string }>("/api/review/queue/clear", {
      method: "POST",
    }),
  clearNewWordsQueue: () =>
    request<{ deletedCount: number; message: string }>("/api/review/new-queue/clear", {
      method: "POST",
    }),
  clearAllCards: () =>
    request<{ deletedCount: number; message: string }>("/api/review/queue/clear-all", {
      method: "POST",
    }),
}

// 06. 研习打卡与热力统计 API
export const statsApi = {
  getHeatmap: (year = 2026) =>
    request<HeatmapDay[]>(`/api/stats/heatmap?year=${year}`),
  getOverview: () =>
    request<LearningOverviewStats>("/api/stats/overview"),
}

// 07. 深度外刊阅读与资讯 API
export const readingApi = {
  listArticles: (params?: { channel?: string; keyword?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams()
    if (params?.channel) query.set("channel", params.channel)
    if (params?.keyword) query.set("keyword", params.keyword)
    if (params?.page) query.set("page", String(params.page))
    if (params?.size) query.set("size", String(params.size))
    return request<{ records: ReadingArticle[]; total: number; current: number; size: number }>(
      `/api/reading/articles?${query.toString()}`
    )
  },
  getDetail: (id: number) =>
    request<ReadingArticleDetail>(`/api/reading/articles/${id}`),
  sync: (channel?: string) =>
    request<{ channel: string; syncedCount: number; message: string }>(
      `/api/reading/sync${channel ? `?channel=${channel}` : ""}`,
      { method: "POST" }
    ),
  getChannels: () =>
    request<ChannelStat[]>("/api/reading/channels"),
}

// 09. 本地视频上传与媒体处理 API
export const mediaApi = {
  list: () => request<MediaItem[]>("/api/media"),
  detail: (mediaId: string) =>
    request<MediaItem>(`/api/media/${encodeURIComponent(mediaId)}`),
  cues: (mediaId: string) =>
    request<MediaCue[]>(`/api/media/${encodeURIComponent(mediaId)}/cues`),
  cueTranslations: (mediaId: string) =>
    request<MediaCueTranslation[]>(`/api/media/${encodeURIComponent(mediaId)}/cue-translations`),
  translate: (mediaId: string) =>
    request<MediaAsyncJob>(`/api/media/${encodeURIComponent(mediaId)}/translation`, {
      method: "POST",
    }),
  delete: (mediaId: string) =>
    request<void>(`/api/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }),
  createUpload: (file: File, signal?: AbortSignal) =>
    request<MediaUploadSession>("/api/media/uploads", {
      method: "POST",
      signal,
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        title: file.name.replace(/\.[^.]+$/, ""),
      }),
    }),
  uploadPart: (uploadId: string, partNumber: number, part: Blob, signal?: AbortSignal) =>
    uploadBinary<MediaUploadPart>(
      `/api/media/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}`,
      part,
      signal
    ),
  completeUpload: (uploadId: string, signal?: AbortSignal) =>
    request<CompletedMediaUpload>(
      `/api/media/uploads/${encodeURIComponent(uploadId)}/complete`,
      { method: "POST", signal }
    ),
}

// 08. AI 助理与模型网关 API
export interface AiTestConnectionResult {
  success: boolean
  latencyMs: number
  message: string
  model: string
}

export interface AiExplainResult {
  word: string
  sentenceTranslation?: string
  contextMeaning: string
  grammarRole: string
  collocations: string[]
  examTips: string
  mnemonics: string
  usageNote?: string
  rawAnswer: string
}

export const aiApi = {
  testConnection: (data: { provider?: string; apiHost?: string; apiKey?: string; model?: string }) =>
    request<AiTestConnectionResult>("/api/ai/test-connection", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  fetchModels: (data: { provider?: string; apiHost?: string; apiKey?: string }) =>
    request<string[]>("/api/ai/models", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  explainWord: (data: {
    word: string
    contextSentence: string
    question?: string
    provider?: string
    apiHost?: string
    apiKey?: string
    model?: string
  }) =>
    request<AiExplainResult>("/api/ai/explain", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// ── 09. 语境文章生成 (Contextual Story) ──────────────────────────────────────

export interface ContextStoryWord {
  id: number
  wordId?: number
  lemma: string
  phoneticUs?: string
  definitionCn?: string
  wordType: "NEW" | "REVIEW"
  requiredOccurrences: number
  actualOccurrences: number
  isTapped: number
}

export interface ContextStory {
  publicId: string
  title: string
  topic: string
  targetLevel: string
  wordCount: number
  targetWordsCount: number
  oovRate: number
  rewriteCount: number
  status: string
  createdAt: string
}

export interface ContextStoryDetail extends ContextStory {
  contentMarked: string
  contentClean: string
  translationCn?: string
  generationModel?: string
  targetWords: ContextStoryWord[]
}

export interface GenerateStoryRequest {
  topic?: string
  targetLevel?: string
  targetCount?: number
  customLemmas?: string[]
  provider?: string
  model?: string
  apiKey?: string
  apiHost?: string
}

export interface StoryFeedbackRequest {
  tappedLemmas: string[]
  readingDurationSeconds?: number
  rating?: number
}

export const contextStoryApi = {
  generate: (data: GenerateStoryRequest) =>
    request<ContextStoryDetail>("/api/contextual/stories/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  list: (params?: { page?: number; size?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.size) query.set("size", String(params.size))
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<{ records: ContextStory[]; total: number; current: number; size: number }>(
      `/api/contextual/stories${qs}`
    )
  },
  getDetail: (publicId: string) =>
    request<ContextStoryDetail>(`/api/contextual/stories/${publicId}`),
  feedback: (publicId: string, data: StoryFeedbackRequest) =>
    request<void>(`/api/contextual/stories/${publicId}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
}


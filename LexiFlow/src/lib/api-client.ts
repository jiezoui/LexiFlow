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
  externalId: string | null
  mimeType: string | null
  fileSize: number | null
}

export interface MediaItem {
  id: string
  title: string
  creator: string | null
  source: string
  sourceUrl: string | null
  coverUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  level: string | null
  wpm: number | null
  status: "UPLOADING" | "PROCESSING" | "WAITING_SUBTITLE" | "READY" | "FAILED" | string
  processingStage: string | null
  processingProgress?: number | null
  processingDetail?: string | null
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
  reviewCount: number
  collectedCount: number
  durationMinutes: number
  newCards: number
  reviewCards: number
  retentionRate: number | null
}

export interface HeatmapCalendar {
  year: number
  totalCount: number
  totalReviews: number
  totalCollected: number
  activeDays: number
  totalDurationMinutes: number
  maxDailyCount: number
  longestStreak: number
  availableYears: number[]
  days: HeatmapDay[]
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
    ...(typeof FormData !== "undefined" && options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
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
  getHeatmap: (year?: number) =>
    request<HeatmapCalendar>(`/api/stats/heatmap${year ? `?year=${year}` : ""}`),
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

// 09. 视频导入、字幕与媒体处理 API
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
  reprocess: (mediaId: string) =>
    request<MediaAsyncJob>(`/api/media/${encodeURIComponent(mediaId)}/reprocess`, {
      method: "POST",
    }),
  delete: (mediaId: string) =>
    request<void>(`/api/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }),
  importYouTube: (url: string) =>
    request<MediaItem>("/api/media/external", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  uploadSubtitle: (mediaId: string, file: File, language = "en") => {
    const body = new FormData()
    body.append("file", file)
    body.append("language", language)
    return request<{
      trackId: number
      cueCount: number
      language: string
      format: string
      status: string
    }>(`/api/media/${encodeURIComponent(mediaId)}/subtitles`, {
      method: "POST",
      body,
    })
  },
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

/** 一次凭据探测的真实结果，含成败原因、上游状态码与耗时 */
export interface AiModelDetection {
  ok: boolean
  status:
    | "CONNECTED"
    | "INVALID_KEY"
    | "ENDPOINT_NOT_FOUND"
    | "RATE_LIMITED"
    | "NO_MODELS"
    | "NOT_CONFIGURED"
    | "UNREACHABLE"
    | "UPSTREAM_ERROR"
    | "REQUEST_FAILED"
    | string
  message: string
  endpoint: string
  httpStatus: number | null
  elapsedMs: number
  models: string[]
  detectedAt: number
}

export interface AiProviderConfigEntry {
  provider: string
  apiKey: string
  apiHost: string
  selectedModel: string
  customModels: string[]
  configured: boolean
  verifyStatus: string | null
  verifyMessage: string | null
  verifiedAt: string | null
  availableModels: string[]
}

export interface AiAccountConfig {
  activeProvider: string
  activeModel: string | null
  activeConfigured: boolean
  temperature: number
  enableReadingAi: boolean
  enableFlashcardAi: boolean
  providers: AiProviderConfigEntry[]
}

export interface AiConfigSavePayload {
  activeProvider?: string
  temperature?: number
  enableReadingAi?: boolean
  enableFlashcardAi?: boolean
  providers?: {
    provider: string
    apiKey?: string
    apiHost?: string
    selectedModel?: string
    customModels?: string[]
  }[]
}

export const aiApi = {
  testConnection: (data: { provider?: string; apiHost?: string; apiKey?: string; model?: string }) =>
    request<AiTestConnectionResult>("/api/ai/test-connection", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** 探测凭据并拉取模型；只传 provider 时使用账号已保存的 Key 与地址 */
  fetchModels: (data: { provider?: string; apiHost?: string; apiKey?: string }) =>
    request<AiModelDetection>("/api/ai/models", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getConfig: () => request<AiAccountConfig>("/api/ai/config"),
  saveConfig: (data: AiConfigSavePayload) =>
    request<AiAccountConfig>("/api/ai/config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  clearProvider: (provider: string) =>
    request<AiAccountConfig>(`/api/ai/config/${encodeURIComponent(provider)}`, {
      method: "DELETE",
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

// ── 10. 影子跟读语音桥接 (Speech Bridge) ─────────────────────────────────────
//
// 浏览器 → Next.js `/api/speech/*`（同源代理）→ 本地 Python 服务 :8100。
// 代理层做的事见 `src/app/api/speech/[...path]/route.ts`。

/** 单个音素的评分明细 */
export interface SpeechPhoneme {
  phoneme: string
  score: number
  /** CTC 前向后向得到的真实后验概率 */
  posterior: number
  /** 帧内排名，1 = 模型最想输出的音素 */
  rank: number | null
  startMs: number
  endMs: number
  expected: string
  status: "GOOD" | "FAIR" | "POOR"
}

/** 单个单词的对齐与评分 */
export interface SpeechWord {
  word: string
  lemma: string
  /** 该词带重音的 IPA（展示用） */
  ipa: string
  phonemes: SpeechPhoneme[]
  status: "CORRECT" | "SUBSTITUTION" | "OMISSION" | "INSERTION"
  actual_word: string | null
  similarity: number
  score: number
  start_ms: number | null
  end_ms: number | null
  asr_probability: number | null
  problems: { phoneme: string; score: number; status: string; rank: number | null }[]
}

export interface SpeechScores {
  accuracy: number
  completeness: number
  fluency: number
  overall: number
  prosody: number | null
}

export interface SpeechSuggestion {
  type: "PHONEME" | "WORD" | "COMPLETENESS" | "FLUENCY" | "PRAISE"
  target: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  title: string
  detail: string
  practiceWords: string[]
}

export interface SpeechTiming {
  duration_seconds: number
  speech_duration_seconds: number
  words_per_minute: number
  pause_count: number
  pause_durations_ms: number[]
  longest_pause_ms: number
  leading_silence_ms: number
  trailing_silence_ms: number
  trimmed_head_ms: number
  trimmed_tail_ms: number
  word_timestamps: { word: string; startMs: number; endMs: number; probability: number }[]
}

export interface SpeechAcoustic {
  duration_seconds: number
  rms_dbfs: number
  peak_dbfs: number
  clipping_ratio: number
  snr_db: number
  pitch_mean_hz: number | null
  pitch_range_semitones: number | null
  voiced_ratio: number
  activity: {
    speech_ratio: number
    leading_silence_ms: number
    trailing_silence_ms: number
    internal_pauses: number
    longest_pause_ms: number
    pause_ms_total: number
    voiced_segments: [number, number][]
  }
}

export interface ShadowingAssessment {
  success: boolean
  reference_text: string
  transcribed_text: string
  language: string
  scores: SpeechScores
  grade: string
  grade_label: string
  words: SpeechWord[]
  counts: {
    correct: number
    substitution: number
    omission: number
    insertion: number
    total_reference: number
    filler_count: number
    poor_phonemes: number
    total_phonemes: number
  }
  timing: SpeechTiming
  acoustic: SpeechAcoustic
  suggestions: SpeechSuggestion[]
  engine: {
    asr: string
    asr_model: string
    asr_elapsed_ms: number
    phoneme_model: string | null
    phoneme_alignment: boolean
  }
  processing_ms: number
}

export interface SpeechPhonemeWords {
  success: boolean
  text: string
  language: string
  ipa: string
  words: { word: string; ipa: string; phonemes: string[]; model_phonemes: string[] }[]
  espeak: { available: boolean; error: string | null }
}

export interface SpeechHealth {
  status: string
  version: string
  config: {
    hf_endpoint: string
    model_cache_dir: string
    asr: { engine: string; whisper_model: string; device: string; compute_type: string }
    phoneme_model: string
  }
  engines: {
    asr_loaded: boolean
    asr_error: string | null
    sensevoice_available: boolean
    phoneme_model_loaded: boolean
    phoneme_model_error: string | null
    espeak: { available: boolean; languages: string[]; error: string | null }
    tts: { engine: string; edge_available: boolean; espeak_available: boolean }
  }
}

/** 直接返回原始 Response（用于音频流等二进制响应） */
async function speechFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/speech${path}`, { cache: "no-store", ...init })
  if (!response.ok) {
    let message = `语音服务错误 ${response.status}`
    try {
      const payload = await response.json()
      if (payload?.error) message = String(payload.error)
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new Error(message)
  }
  return response
}

async function speechJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await speechFetch(path, init)
  return (await response.json()) as T
}

export const speechApi = {
  /** 服务健康与依赖自检 */
  health: () => speechJson<SpeechHealth>("/health", { method: "GET" }),

  /** 文本 → IPA 音素标注 */
  phonemes: (text: string, language = "en") =>
    speechJson<SpeechPhonemeWords>("/phonemes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    }),

  /** 核心：跟读录音发音评测 */
  score: (audio: Blob, targetText: string, language = "en") => {
    const body = new FormData()
    body.append("audio", audio, "shadowing.wav")
    body.append("target_text", targetText)
    body.append("language", language)
    return speechJson<ShadowingAssessment>("/score_pronunciation", {
      method: "POST",
      body,
    })
  },

  /** 语音转写（词级时间戳） */
  transcribe: (audio: Blob, language = "en", initialPrompt?: string) => {
    const body = new FormData()
    body.append("audio", audio, "clip.wav")
    body.append("language", language)
    if (initialPrompt) body.append("initial_prompt", initialPrompt)
    return speechJson<{
      success: boolean
      transcript: {
        text: string
        language: string
        duration: number
        segments: { text: string; start: number; end: number }[]
      }
      acoustic: SpeechAcoustic
    }>("/transcribe", { method: "POST", body })
  },

  /** 声学质量诊断（VAD / 信噪比 / 削波） */
  inspect: (audio: Blob) => {
    const body = new FormData()
    body.append("audio", audio, "clip.wav")
    return speechJson<{ success: boolean; acoustic: SpeechAcoustic; warnings: string[] }>(
      "/inspect",
      { method: "POST", body }
    )
  },

  /**
   * 参考音 URL（直接用作 `<audio src>`）。
   * 用 URL 而非 fetch 可以让浏览器原生处理缓存、Range 请求与播放控制。
   */
  referenceAudioUrl: (text: string, speed = 1.0, voice?: string) => {
    const params = new URLSearchParams({ text, speed: String(speed) })
    if (voice) params.set("voice", voice)
    return `/api/speech/tts?${params.toString()}`
  },

  /** 参考音（POST 版，返回 WAV Blob，便于本地缓存） */
  synthesize: async (text: string, speed = 1.0, voice?: string): Promise<Blob> => {
    const response = await speechFetch("/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed, voice }),
    })
    return await response.blob()
  },
}

// ── 11. 影子跟读训练记录 (Shadowing Practice) ───────────────────────────────

export interface ShadowingSentence {
  id: number
  sourceType: "BBC" | "CARD" | "CUSTOM"
  sourceTitle: string
  text: string
  translation: string
  cefrLevel: string
  wordCount: number
  tags: string | null
  attemptCount: number
  bestScore: number | null
  lastScore: number | null
  lastPracticedAt: string | null
  masteryStatus: "NEW" | "LEARNING" | "MASTERED"
}

export interface ShadowingAttemptRecord {
  id: number
  sentenceId: number | null
  sourceType: string
  sourceTitle: string
  referenceText: string
  transcribedText: string | null
  overallScore: number
  accuracyScore: number
  completenessScore: number
  fluencyScore: number
  prosodyScore: number | null
  grade: string
  correctCount: number
  substitutionCount: number
  omissionCount: number
  insertionCount: number
  poorPhonemeCount: number
  totalPhonemeCount: number
  wordsPerMinute: number
  audioDurationMs: number
  analysisMs: number
  detailJson: unknown
  suggestionsJson: unknown
  engineJson: unknown
  createdAt: string
}

export interface ShadowingStats {
  totalAttempts: number
  practicedSentences: number
  masteredSentences: number
  averageScore: number
  bestScore: number
  latestScore: number
  averageAccuracy: number
  averageCompleteness: number
  averageFluency: number
  totalDurationMinutes: number
  todayAttempts: number
  todayAverageScore: number
  streakDays: number
  weakPhonemes: {
    phoneme: string
    averageScore: number
    occurrences: number
    hint: string
  }[]
  trend: { date: string; averageScore: number; attempts: number }[]
  sources: { sourceType: string; attempts: number; averageScore: number }[]
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value))
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ""
}

export const shadowingApi = {
  /** 跟读句库（按题源筛选，附带个人掌握度） */
  listSentences: (params?: { sourceType?: string; limit?: number }) =>
    request<ShadowingSentence[]>(
      `/api/shadowing/sentences${toQuery({ sourceType: params?.sourceType, limit: params?.limit })}`
    ),

  /** 导入自定义跟读句 */
  createSentence: (data: {
    text: string
    translation?: string
    cefrLevel?: string
    sourceTitle?: string
    tags?: string
  }) =>
    request<ShadowingSentence>("/api/shadowing/sentences", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 删除自定义跟读句 */
  deleteSentence: (id: number) =>
    request<{ id: number; message: string }>(`/api/shadowing/sentences/${id}`, {
      method: "DELETE",
    }),

  /** 提交一次评测结果（由后端落库并计入打卡） */
  submitAttempt: (data: {
    sentenceId?: number
    sourceType?: string
    sourceTitle?: string
    referenceText: string
    transcribedText?: string
    language?: string
    overallScore: number
    accuracyScore: number
    completenessScore: number
    fluencyScore: number
    prosodyScore?: number | null
    grade?: string
    correctCount?: number
    substitutionCount?: number
    omissionCount?: number
    insertionCount?: number
    poorPhonemeCount?: number
    totalPhonemeCount?: number
    wordsPerMinute?: number
    audioDurationMs?: number
    analysisMs?: number
    detailJson?: string
    suggestionsJson?: string
    engineJson?: string
    practiceSeconds?: number
  }) =>
    request<ShadowingAttemptRecord>("/api/shadowing/attempts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 历史练习记录 */
  listAttempts: (params?: { sentenceId?: number; page?: number; size?: number }) =>
    request<{
      records: ShadowingAttemptRecord[]
      total: number
      current: number
      size: number
    }>(
      `/api/shadowing/attempts${toQuery({
        sentenceId: params?.sentenceId,
        page: params?.page,
        size: params?.size,
      })}`
    ),

  /** 单条记录明细（含词级/音素级完整数据） */
  getAttempt: (id: number) =>
    request<ShadowingAttemptRecord>(`/api/shadowing/attempts/${id}`),

  /** 训练总览统计 */
  stats: () => request<ShadowingStats>("/api/shadowing/stats"),
}

// ---------------------------------------------------------------------------
// 创作者频道订阅与动态跟踪 (YouTube Channel Subscriptions)
// ---------------------------------------------------------------------------

export interface ChannelSubscription {
  publicId: string
  platform: string
  channelId: string
  channelHandle: string | null
  channelName: string
  avatarUrl: string | null
  bannerUrl: string | null
  description: string | null
  subscriberCountText: string | null
  importedCount: number
  lastFeedFetchedAt: string | null
  createdAt: string
}

export interface ChannelFeedItem {
  videoId: string
  videoUrl: string
  title: string
  publishedAt: string
  relativeTimeText: string
  thumbnailUrl: string
  description: string
  isImported: boolean
  mediaPublicId?: string | null
}

export interface ChannelFeed {
  channelId: string
  channelName: string
  channelHandle: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  description: string | null
  feedUrl: string
  items: ChannelFeedItem[]
}

export const channelApi = {
  /** 获取当前用户已订阅的频道列表 */
  listSubscriptions: () =>
    request<ChannelSubscription[]>("/api/channels/subscriptions"),

  /** 关注/订阅新频道 (支持 @handle 或 YouTube 链接) */
  subscribe: (input: string) =>
    request<ChannelSubscription>("/api/channels/subscriptions", {
      method: "POST",
      body: JSON.stringify({ input }),
    }),

  /** 取消关注频道 */
  unsubscribe: (channelId: string) =>
    request<void>(`/api/channels/subscriptions/${channelId}`, {
      method: "DELETE",
    }),

  /** 拉取频道最新视频流及在库状态 */
  getFeed: (channelId: string) =>
    request<ChannelFeed>(`/api/channels/${channelId}/feed`),

  /** 一键将动态视频导入视频精听库 */
  importFeedVideo: (channelId: string, videoId: string) =>
    request<MediaItem>(`/api/channels/${channelId}/import-video`, {
      method: "POST",
      body: JSON.stringify({ videoId }),
    }),

  /** 上传 OPML 文件批量导入订阅频道 */
  importOpml: async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const token = typeof window !== "undefined" ? localStorage.getItem("lexiflow_auth_token") : null
    const res = await fetch("http://localhost:8080/api/channels/import-opml", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    const json = await res.json()
    if (!res.ok || json.code !== 200) {
      throw new Error(json.message || "OPML 导入失败")
    }
    return json.data as { importedCount: number }
  },
}

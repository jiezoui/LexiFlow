export interface PodcastEpisode {
  id: string
  guid?: string
  showId: string
  showTitle: string
  title: string
  titleCn?: string
  author: string
  audioUrl: string
  coverUrl?: string
  durationSeconds: number
  pubDate: string
  wpm?: number
  level?: string
  status: "READY" | "PROCESSING" | "WAITING_ASR"
  hasBilingualTranscript: boolean
  progressPercentage?: number
  description?: string
}

export interface PodcastShow {
  id: string
  feedUrl: string
  title: string
  author: string
  coverUrl?: string
  description?: string
  episodeCount: number
  lastUpdated?: string
}

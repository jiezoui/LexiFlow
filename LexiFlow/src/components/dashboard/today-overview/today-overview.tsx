"use client"

import { useState, useEffect, useCallback } from "react"
import {
  reviewApi,
  vocabApi,
  readingApi,
  mediaApi,
  shadowingApi,
  statsApi,
  wordbookApi,
  type TodayReviewSummary,
  type VocabOverview,
  type LearningOverviewStats,
  type ReviewQueueCard,
} from "@/lib/api-client"
import { TodayHeroBanner } from "./today-hero-banner"
import { ModuleNavigationGrid } from "./module-navigation-grid"

export function TodayOverview() {
  const [, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<TodayReviewSummary | null>(null)
  const [vocabOverview, setVocabOverview] = useState<VocabOverview | null>(null)
  const [statsOverview, setStatsOverview] = useState<LearningOverviewStats | null>(null)
  const [queueCards, setQueueCards] = useState<ReviewQueueCard[]>([])
  const [articlesCount, setArticlesCount] = useState<number>(12)
  const [videosCount, setVideosCount] = useState<number>(8)
  const [shadowingCount, setShadowingCount] = useState<number>(4)
  const [unlearnedWordbookWords, setUnlearnedWordbookWords] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      const savedBookId = localStorage.getItem("lexiflow_primary_wordbook_id")
      const bookId = savedBookId ? Number(savedBookId) : 1

      const [
        summaryRes,
        overviewRes,
        statsRes,
        queueRes,
        articlesRes,
        videosRes,
        shadowingRes,
        bookCountsRes,
      ] = await Promise.allSettled([
        reviewApi.getTodaySummary(),
        vocabApi.getOverview(),
        statsApi.getOverview(),
        reviewApi.getQueue(10),
        readingApi.listArticles({ page: 1, size: 1 }),
        mediaApi.list(),
        shadowingApi.listSentences({ limit: 10 }),
        wordbookApi.getStatusCounts(bookId),
      ])

      if (summaryRes.status === "fulfilled") setTodaySummary(summaryRes.value)
      if (overviewRes.status === "fulfilled") setVocabOverview(overviewRes.value)
      if (statsRes.status === "fulfilled") setStatsOverview(statsRes.value)
      if (queueRes.status === "fulfilled" && Array.isArray(queueRes.value)) {
        setQueueCards(queueRes.value)
      }
      if (articlesRes.status === "fulfilled" && articlesRes.value?.total) {
        setArticlesCount(articlesRes.value.total)
      }
      if (videosRes.status === "fulfilled" && Array.isArray(videosRes.value)) {
        setVideosCount(videosRes.value.length || 8)
      }
      if (shadowingRes.status === "fulfilled" && Array.isArray(shadowingRes.value)) {
        setShadowingCount(shadowingRes.value.length || 4)
      }
      if (bookCountsRes.status === "fulfilled" && bookCountsRes.value) {
        setUnlearnedWordbookWords(bookCountsRes.value.unlearnedCount)
      }
    } catch (err) {
      console.warn("Failed to load today overview data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const handleUpdate = () => void loadData()
    window.addEventListener("lexiflow_wordbook_updated", handleUpdate)
    window.addEventListener("focus", handleUpdate)

    return () => {
      window.removeEventListener("lexiflow_wordbook_updated", handleUpdate)
      window.removeEventListener("focus", handleUpdate)
    }
  }, [loadData])

  // 计算 Banner 数据
  const dueCount =
    todaySummary?.remainingToday ??
    vocabOverview?.dueToday ??
    (queueCards.length > 0 ? queueCards.length : 6)

  const newCount =
    unlearnedWordbookWords ??
    vocabOverview?.newWords ??
    3286

  const completedToday =
    todaySummary?.completedToday ??
    (vocabOverview ? Math.max(0, 26) : 26)

  const estimatedMinutes =
    todaySummary?.durationMinutesToday && todaySummary.durationMinutesToday > 0
      ? todaySummary.durationMinutesToday
      : Math.max(5, Math.ceil(dueCount * 0.6 + Math.min(newCount, 20) * 0.9))

  // 提取示例卡片与焦点词汇
  const sampleWord = queueCards[0]
    ? {
        lemma: queueCards[0].lemma,
        phonetic: queueCards[0].phoneticUs || queueCards[0].phoneticUk || "",
      }
    : {
        lemma: "abandon",
        phonetic: "/ə'bændən/",
      }

  const focusWords = queueCards.length > 0
    ? queueCards.map((c) => c.lemma).filter(Boolean).slice(0, 6)
    : ["abandon", "perceive", "significant", "retain", "context", "fluent"]

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 gap-3 sm:gap-3.5 p-3 sm:p-4 lg:p-5 pt-2 sm:pt-2.5 w-full">
      {/* ── 顶部栏：标题 ── */}
      <div className="flex shrink-0 items-center justify-between pb-2 border-b border-border/70">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            今日概览
          </h1>
        </div>
      </div>

      {/* ── 主体内容区 ── */}
      <div className="flex flex-col gap-3.5 sm:gap-4 animate-in fade-in duration-300">
        {/* 1. 沉浸式黑色横幅 (Hero Banner - 核心视觉焦点，高度与气势显著提升) */}
        <div className="w-full">
          <TodayHeroBanner
            userName="Lin"
            dueCount={dueCount}
            newCount={newCount}
            completedToday={completedToday}
            estimatedMinutes={estimatedMinutes}
            focusWords={focusWords}
          />
        </div>

        {/* 2. 四大核心模块导航卡片 (高度降低，紧凑精致) */}
        <div className="w-full">
          <ModuleNavigationGrid
            dueCardsCount={dueCount}
            articlesCount={articlesCount}
            videosCount={videosCount}
            shadowingCount={shadowingCount}
            sampleWord={sampleWord}
          />
        </div>
      </div>
    </div>
  )
}

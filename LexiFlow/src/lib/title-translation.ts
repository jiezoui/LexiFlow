"use client"

import { useEffect, useState, useCallback } from "react"
import { dictApi } from "@/lib/api-client"

const STORAGE_KEY_TOGGLE = "lexiflow_title_trans_enabled"
const STORAGE_KEY_CACHE = "lexiflow_title_trans_cache"

function getLocalCache(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setLocalCache(cache: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(cache))
  } catch {}
}

export function useTitleTranslation() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(STORAGE_KEY_TOGGLE) === "true"
  })
  const [translations, setTranslations] = useState<Record<string, string>>(getLocalCache)
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TOGGLE, String(enabled))
    } catch {}
  }, [enabled])

  const toggleTranslation = useCallback(() => {
    setEnabled((prev) => !prev)
  }, [])

  const translateTitle = useCallback(async (text: string) => {
    const trimmed = text?.trim()
    if (!trimmed) return ""

    // Check existing in-memory / localStorage cache
    const currentCache = getLocalCache()
    if (currentCache[trimmed]) {
      return currentCache[trimmed]
    }

    setLoadingMap((prev) => ({ ...prev, [trimmed]: true }))

    try {
      const res = await dictApi.translate(trimmed)
      let translated = res?.translation?.trim() || ""

      // Filter out fallback busy notices if service was busy
      if (translated.includes("在线长句翻译通道暂时繁忙") || !translated) {
        // Simple heuristic dictionary/pattern fallback if any
        translated = trimmed
      }

      const updated = { ...getLocalCache(), [trimmed]: translated }
      setLocalCache(updated)
      setTranslations(updated)
      return translated
    } catch {
      return trimmed
    } finally {
      setLoadingMap((prev) => ({ ...prev, [trimmed]: false }))
    }
  }, [])

  const batchTranslateTitles = useCallback(async (titles: string[]) => {
    const cache = getLocalCache()
    const missing = titles.map((t) => t.trim()).filter((t) => t && !cache[t])
    if (missing.length === 0) return

    for (const title of missing) {
      void translateTitle(title)
    }
  }, [translateTitle])

  return {
    enabled,
    toggleTranslation,
    translations,
    loadingMap,
    translateTitle,
    batchTranslateTitles,
  }
}

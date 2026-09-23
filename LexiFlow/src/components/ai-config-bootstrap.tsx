"use client"

import * as React from "react"
import { loadAiSettingsFromServer } from "@/lib/ai-config"

/**
 * 把账号下保存的 AI 配置同步到本地缓存。
 *
 * 阅读器的查词解析、视频生词抽屉、语境文章生成等模块都是同步读取本地缓存来判断
 * 「AI 是否可用」的，如果用户从没打开过设置页，本地缓存就是空的，这些模块会误判为
 * 未配置而直接拦住调用。这里在应用外壳挂载时同步一次，使任意入口进入都能直接使用。
 */
export function AiConfigBootstrap() {
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAiSettingsFromServer()
      } catch {
        // 未登录或后端不可达时保持本地缓存原样，不影响页面本身
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}

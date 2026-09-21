import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseDuration(val: string | null | undefined): number {
  if (!val) return 1200
  const trimmed = val.trim()
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }
  const parts = trimmed.split(":").map((p) => parseInt(p, 10))
  if (parts.some(isNaN)) return 1200
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 1200
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function extractTag(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))
  if (!match) return ""
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
}

function extractAttr(xml: string, tagName: string, attrName: string): string {
  const match = xml.match(new RegExp(`<${tagName}[^>]*\\b${attrName}=["']([^"']+)["']`, "i"))
  return match ? match[1] : ""
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")?.trim()

  if (!url) {
    return NextResponse.json(
      { code: 400, message: "缺少 url 参数" },
      { status: 400 }
    )
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LexiFlow/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { code: 502, message: `上游 RSS 服务器返回错误: ${response.status} ${response.statusText}` },
        { status: 502 }
      )
    }

    const xml = await response.text()

    // Extract channel metadata
    const channelMatch = xml.match(/<channel[\s\S]*?>([\s\S]*?)<\/channel>/i)
    const channelContent = channelMatch ? channelMatch[1] : xml

    const channelTitle = extractTag(channelContent, "title") || "未知播客"
    const channelAuthor =
      extractTag(channelContent, "itunes:author") ||
      extractTag(channelContent, "author") ||
      "播客主播"
    const channelDesc = stripHtml(
      extractTag(channelContent, "description") ||
      extractTag(channelContent, "itunes:summary")
    )
    const channelCover =
      extractAttr(channelContent, "itunes:image", "href") ||
      extractTag(channelContent, "image")?.match(/<url>([^<]+)<\/url>/i)?.[1] ||
      ""

    // Extract items
    const itemMatches = xml.match(/<item[\s\S]*?>([\s\S]*?)<\/item>/gi) || []
    const episodes = []

    for (const itemXml of itemMatches) {
      const itemTitle = extractTag(itemXml, "title")
      if (!itemTitle) continue

      // Audio enclosure
      let audioUrl = ""
      const enclosureMatches = itemXml.match(/<enclosure[^>]+>/gi) || []
      for (const enc of enclosureMatches) {
        const encUrl = enc.match(/\burl=["']([^"']+)["']/i)?.[1] || ""
        const encType = enc.match(/\btype=["']([^"']+)["']/i)?.[1] || ""
        if (encUrl && (encType.includes("audio") || encUrl.endsWith(".mp3") || encUrl.endsWith(".m4a") || encUrl.endsWith(".aac"))) {
          audioUrl = encUrl
          break
        }
      }

      // If no audio enclosure, fallback to link or any enclosure url if not image
      if (!audioUrl && enclosureMatches.length > 0) {
        const firstEnc = enclosureMatches[0]
        if (firstEnc) {
          const encUrl = firstEnc.match(/\burl=["']([^"']+)["']/i)?.[1] || ""
          const encType = firstEnc.match(/\btype=["']([^"']+)["']/i)?.[1] || ""
          if (!encType.includes("image")) {
            audioUrl = encUrl
          }
        }
      }

      if (!audioUrl) continue

      const guid = extractTag(itemXml, "guid") || audioUrl
      const rawPubDate = extractTag(itemXml, "pubDate")
      let pubDate = rawPubDate
      try {
        if (rawPubDate) {
          const d = new Date(rawPubDate)
          if (!isNaN(d.getTime())) {
            pubDate = d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
          }
        }
      } catch {}

      const durationStr =
        extractTag(itemXml, "itunes:duration") ||
        extractAttr(itemXml, "itunes:duration", "value") ||
        ""
      const durationSeconds = parseDuration(durationStr)

      const itemDesc = stripHtml(
        extractTag(itemXml, "itunes:summary") ||
        extractTag(itemXml, "description")
      )
      const itemCover =
        extractAttr(itemXml, "itunes:image", "href") || channelCover

      episodes.push({
        id: "ep-" + Math.abs(hashCode(guid)),
        guid,
        showTitle: channelTitle,
        title: itemTitle,
        author: channelAuthor,
        audioUrl,
        coverUrl: itemCover,
        durationSeconds,
        pubDate: pubDate || "近期",
        description: itemDesc.slice(0, 300),
        status: "READY",
        hasBilingualTranscript: true,
        wpm: 145,
        level: "B2",
      })

      if (episodes.length >= 30) break // limit to latest 30 episodes per feed
    }

    const show = {
      id: "show-" + Math.abs(hashCode(url)),
      feedUrl: url,
      title: channelTitle,
      author: channelAuthor,
      description: channelDesc.slice(0, 400),
      coverUrl: channelCover,
      episodeCount: episodes.length,
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json({
      code: 200,
      message: "解析成功",
      data: {
        show,
        episodes,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: error instanceof Error ? error.message : "抓取或解析播客 RSS 失败",
      },
      { status: 500 }
    )
  }
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return hash
}

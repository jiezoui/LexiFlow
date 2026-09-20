/**
 * 语音桥接服务反向代理 (Speech Bridge Reverse Proxy)
 *
 * 浏览器 → Next.js `/api/speech/*` → 本地 Python 服务 `127.0.0.1:8100`
 *
 * 为什么需要这一层
 * ----------------
 * 1. **同源**：前端与页面同源调用，无需额外 CORS 配置，也不暴露 Python 端口。
 * 2. **穿透 `rewrites`**：`next.config.ts` 把 `/api/:path*` 全部重写到 Spring
 *    Boot:8080。App Router 的 Route Handler 优先于 `rewrites`，因此
 *    `/api/speech/**` 会被本文件拦截，而不会误转发给后端。
 * 3. **统一超时与错误形态**：ASR + 音素对齐单次约 1~4s（CPU），但模型冷启动
 *    可能到 30s+，这里把超时统一设为 120s，并把网络层错误转成结构化 JSON。
 *
 * 服务地址由环境变量 `SPEECH_BRIDGE_URL` 覆盖，默认 `http://127.0.0.1:8100`。
 */

import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SPEECH_BRIDGE_URL = (
  process.env.SPEECH_BRIDGE_URL || "http://127.0.0.1:8100"
).replace(/\/+$/, "")

const UPSTREAM_TIMEOUT_MS = Number(process.env.SPEECH_BRIDGE_TIMEOUT_MS || 120_000)

/** 只透传这些响应头，避免把上游的 hop-by-hop 头带进浏览器响应。 */
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
  "x-tts-engine",
  "x-tts-voice",
  "x-audio-duration",
]

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<Response> {
  const { path } = await context.params
  const suffix = (path || []).join("/")
  const target = `${SPEECH_BRIDGE_URL}/${suffix}${request.nextUrl.search}`

  // 原样转发请求体：multipart（音频上传）与 JSON 都不能被解析后重编码，
  // 否则 boundary / 编码会变化。直接取 ArrayBuffer 最安全。
  let body: ArrayBuffer | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer()
    if (body.byteLength === 0) body = undefined
  }

  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const accept = request.headers.get("accept")
  if (accept) headers.set("accept", accept)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    })
  } catch (error: unknown) {
    const aborted = error instanceof Error && error.name === "AbortError"
    return Response.json(
      {
        success: false,
        error: aborted
          ? `语音桥接服务响应超时（${UPSTREAM_TIMEOUT_MS / 1000}s）。首次调用需要加载 ASR/音素模型，请稍后重试。`
          : `无法连接语音桥接服务 ${SPEECH_BRIDGE_URL}。请先运行 scripts\\start-speech-bridge.ps1。`,
        detail: error instanceof Error ? error.message : String(error),
        bridgeUrl: SPEECH_BRIDGE_URL,
      },
      { status: aborted ? 504 : 503 }
    )
  } finally {
    clearTimeout(timer)
  }

  const outHeaders = new Headers()
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) outHeaders.set(name, value)
  }

  // 音频等二进制响应直接透传，不读取为文本
  const isBinary = (upstream.headers.get("content-type") || "").startsWith("audio/")
  if (isBinary) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    })
  }

  const text = await upstream.text()
  return new Response(text, { status: upstream.status, headers: outHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy

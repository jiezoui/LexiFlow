"use client"

import * as React from "react"
import {
  SparklesIcon,
  CheckIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  KeyIcon,
  ServerIcon,
  CpuIcon,
  ShieldCheckIcon,
  SlidersIcon,
  RotateCcwIcon,
  SaveIcon,
  TriangleAlertIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  AI_PROVIDER_PRESETS,
  type AiProviderId,
  type AiSettings,
  getAiSettings,
  getDefaultAiSettings,
  loadAiSettingsFromServer,
  saveAiSettingsToServer,
} from "@/lib/ai-config"
import { aiApi, type AiModelDetection } from "@/lib/api-client"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function AiSettingsTab() {
  const [settings, setSettings] = React.useState<AiSettings>(getDefaultAiSettings())
  const [showKey, setShowKey] = React.useState(false)
  const [fetchingModels, setFetchingModels] = React.useState(false)
  const [detection, setDetection] = React.useState<AiModelDetection | null>(null)
  const [savedSuccess, setSavedSuccess] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // 初始化：以账号下保存的配置为准，回填并覆盖本地缓存
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fromServer = await loadAiSettingsFromServer()
        if (!cancelled) setSettings(fromServer)
      } catch {
        // 后端不可达时退回本地缓存，保证面板仍可编辑
        if (!cancelled) setSettings(getAiSettings())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeProvider = settings.activeProvider
  const preset = AI_PROVIDER_PRESETS[activeProvider]
  const currentProviderConfig = settings.providers[activeProvider] || {
    apiKey: "",
    apiHost: preset.defaultHost,
    selectedModel: preset.defaultModel,
    customModels: [],
  }

  /**
   * 自动探测：填入 API Key（或切换供应商 / 修改接口地址）后延迟发起一次真实探测。
   * 探测本身会请求上游 /models 接口，因此成功即代表凭据、地址与网络三者都可用，
   * 无需再单独提供一个"测试连通性"按钮；失败时下方会如实给出原因。
   */
  React.useEffect(() => {
    const isOllama = activeProvider === "ollama"
    const apiKey = (currentProviderConfig.apiKey ?? "").trim()
    const apiHost = (currentProviderConfig.apiHost ?? "").trim()

    if (!isOllama && !apiKey) {
      setDetection(null)
      return
    }

    setFetchingModels(true)
    const timer = setTimeout(async () => {
      try {
        const result = await aiApi.fetchModels({
          provider: activeProvider,
          apiHost,
          apiKey,
        })
        setDetection(result)
        // 探测成功时后端已自动选定模型，这里同步回本地，使阅读器立刻可用
        if (result.ok && result.models.length > 0) {
          setSettings((prev) => {
            const current = prev.providers[activeProvider]?.selectedModel
            if (current && result.models.includes(current)) return prev
            return {
              ...prev,
              providers: {
                ...prev.providers,
                [activeProvider]: {
                  ...prev.providers[activeProvider],
                  selectedModel: result.models[0],
                },
              },
            }
          })
        }
      } catch (e) {
        setDetection({
          ok: false,
          status: "REQUEST_FAILED",
          message: e instanceof Error ? e.message : "探测请求失败",
          endpoint: apiHost,
          httpStatus: null,
          elapsedMs: 0,
          models: [],
          detectedAt: Date.now(),
        })
      } finally {
        setFetchingModels(false)
      }
    }, 700)

    return () => clearTimeout(timer)
    // updateCurrent/ setSettings 为稳定引用，不纳入依赖避免循环触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider, currentProviderConfig.apiKey, currentProviderConfig.apiHost])

  // 切换供应商
  const handleSelectProvider = (pid: AiProviderId) => {
    setSettings((prev) => ({
      ...prev,
      activeProvider: pid,
    }))
    setDetection(null)
  }

  // 更新当前供应商的某项配置
  const updateCurrentConfig = (updates: Partial<typeof currentProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [activeProvider]: {
          ...currentProviderConfig,
          ...updates,
        },
      },
    }))
  }

  // 保存设置：写入账号后再回读，确保落库结果与界面一致
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const persisted = await saveAiSettingsToServer(settings)
      setSettings(persisted)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败，请检查登录状态")
    } finally {
      setSaving(false)
    }
  }

  // 清空当前供应商已保存的密钥
  const handleClearKey = async () => {
    updateCurrentConfig({ apiKey: "" })
    setDetection(null)
    try {
      await aiApi.clearProvider(activeProvider)
    } catch {
      // 后端未连通时仅清本地，下次保存会覆盖
    }
  }

  // 重置当前供应商为默认
  const handleResetProvider = () => {
    updateCurrentConfig({
      apiHost: preset.defaultHost,
      selectedModel: preset.defaultModel,
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. 标题区：不再使用卡片容器，标题直接作为页面的一部分 */}
      <div className="flex flex-col items-center gap-3 pb-1 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <SparklesIcon className="size-5 text-primary" />
          <span>AI 助理与大语言模型中心</span>
        </h2>
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-emerald-500/30 bg-background/80 px-2.5 py-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400"
        >
          <ShieldCheckIcon className="size-3.5" />
          <span>凭据托管于账号 · 换设备登录即刻可用</span>
        </Badge>
      </div>

      {/* 2. 供应商选择网格 (Provider Selector) */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          选择模型供应商 (Model Provider)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {(Object.keys(AI_PROVIDER_PRESETS) as AiProviderId[]).map((pid) => {
            const p = AI_PROVIDER_PRESETS[pid]
            const isSelected = activeProvider === pid
            const hasKey = !!settings.providers[pid]?.apiKey

            return (
              <button
                key={pid}
                type="button"
                onClick={() => handleSelectProvider(pid)}
                className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border/70 bg-card hover:bg-muted/50 hover:border-border"
                }`}
              >
                {p.badge && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full mb-1.5 font-medium ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {p.badge}
                  </span>
                )}
                <span className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                  {p.name.split(" ")[0]}
                </span>
                <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {pid === "ollama" ? "本地无需 Key" : hasKey ? "● 已配置 Key" : "○ 待配置"}
                </span>

                {isSelected && (
                  <div className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <CheckIcon className="size-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. 核心凭据配置卡片 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{preset.name} 参数设置</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {preset.description}
              </CardDescription>
            </div>

            {preset.apiKeyUrl && (
              <a
                href={preset.apiKeyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <span>获取 API Key</span>
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <KeyIcon className="size-3.5 text-muted-foreground" />
                <span>API 密钥 (API Key)</span>
              </label>
              <div className="flex items-center gap-3">
                {activeProvider === "ollama" && (
                  <span className="text-[11px] text-muted-foreground">Ollama 本地部署无需真实 Key</span>
                )}
                {currentProviderConfig.apiKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="text-[11px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                    title="清空该供应商已保存的密钥"
                  >
                    <Trash2Icon className="size-2.5" />
                    <span>清空密钥</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={activeProvider === "ollama" ? "ollama (本地免鉴权)" : "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                value={currentProviderConfig.apiKey}
                onChange={(e) => updateCurrentConfig({ apiKey: e.target.value })}
                className="font-mono text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                title={showKey ? "隐藏密钥" : "显示密钥"}
              >
                {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Base URL (API Host) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <ServerIcon className="size-3.5 text-muted-foreground" />
                <span>接口地址 (Base URL)</span>
              </label>
              <button
                type="button"
                onClick={handleResetProvider}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title="重置为官方推荐 Base URL"
              >
                <RotateCcwIcon className="size-2.5" />
                <span>恢复默认地址</span>
              </button>
            </div>
            <Input
              type="text"
              placeholder={preset.defaultHost}
              value={currentProviderConfig.apiHost}
              onChange={(e) => updateCurrentConfig({ apiHost: e.target.value })}
              className="font-mono text-xs"
            />
            <span className="text-[11px] text-muted-foreground block">
              支持填写第三方反向代理、云中转网关或局域网私有端口。
            </span>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <CpuIcon className="size-3.5 text-muted-foreground" />
                <span>主用模型 (Model ID)</span>
              </label>
              {/* 不再提供手动拉取按钮：填入凭据后自动探测，能拉到即说明配置可用 */}
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {fetchingModels ? (
                  <>
                    <Loader2Icon className="size-3 animate-spin" />
                    正在探测服务端
                  </>
                ) : detection?.ok ? (
                  <>
                    <CheckCircle2Icon className="size-3 text-emerald-500" />
                    已连接 · {detection.models.length} 个可用 · {detection.elapsedMs}ms
                  </>
                ) : detection ? (
                  <>
                    <TriangleAlertIcon className="size-3 text-amber-500" />
                    探测未通过
                  </>
                ) : activeProvider !== "ollama" && !currentProviderConfig.apiKey ? (
                  "填写 API Key 后自动探测"
                ) : (
                  "等待探测"
                )}
              </span>
            </div>

            {/* 可用模型由凭据自动探测并自动选定，这里只做结果展示 */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <span className="font-mono text-xs text-foreground">
                {currentProviderConfig.selectedModel || "等待自动检测"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {fetchingModels
                  ? "检测中"
                  : detection?.ok
                    ? "自动选定"
                    : "未检测到可用模型"}
              </span>
            </div>

            {/* 探测结论：失败时给出真实原因，而不是静默清空 */}
            {detection && (
              <div
                className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                  detection.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {detection.ok ? (
                    <CheckCircle2Icon className="mt-0.5 size-3 shrink-0" />
                  ) : (
                    <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-medium">{detection.message}</p>
                    <p className="font-mono text-muted-foreground break-all">
                      {detection.endpoint}
                      {detection.httpStatus ? ` · HTTP ${detection.httpStatus}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. 业务应用与功能联动开关 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersIcon className="size-4 text-muted-foreground" />
            <span>AI 业务应用场景联动</span>
          </CardTitle>
          <CardDescription className="text-xs">
            控制 AI 深度解析在各个研习模块中的自动启用与交互形式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">深度外刊阅读 AI 语境解析</p>
              <p className="text-xs text-muted-foreground">
                在阅读文章点击单词或长句时，启用 AI 语法成分、时态语态与原句深度用法的实时精析
              </p>
            </div>
            <Switch
              checked={settings.enableReadingAi}
              onCheckedChange={(c) => setSettings({ ...settings, enableReadingAi: c })}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">单词闪卡智能助记与造句</p>
              <p className="text-xs text-muted-foreground">
                在闪卡研习与默写通关中，智能生成词根记忆口诀与地道例句拓展
              </p>
            </div>
            <Switch
              checked={settings.enableFlashcardAi}
              onCheckedChange={(c) => setSettings({ ...settings, enableFlashcardAi: c })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. 底部保存操作栏 */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gap-2 font-semibold text-xs px-6 cursor-pointer"
        >
          {saving ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : savedSuccess ? (
            <CheckIcon className="size-4 text-emerald-400" />
          ) : (
            <SaveIcon className="size-4" />
          )}
          <span>{saving ? "正在保存…" : savedSuccess ? "已保存至账号并生效" : "保存 AI 模型配置"}</span>
        </Button>

        <span className="text-[11px] font-mono text-muted-foreground">
          {saveError ? (
            <span className="text-destructive">{saveError}</span>
          ) : (
            "配置随账号同步，阅读器与闪卡模块即时生效"
          )}
        </span>
      </div>
    </div>
  )
}

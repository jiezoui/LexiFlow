"use client"

import * as React from "react"
import {
  CheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  AI_PROVIDER_PRESETS,
  type AiProviderId,
  type AiSettings,
  applyServerAiConfig,
  getProviderPreset,
  getAiSettings,
  getDefaultAiSettings,
  loadAiSettingsFromServer,
  saveAiSettingsToServer,
  toSavePayload,
} from "@/lib/ai-config"
import { aiApi, type AiModelDetection } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const builtinProviders = Object.keys(AI_PROVIDER_PRESETS).filter((id) => id !== "custom") as AiProviderId[]
const builtinLabels: Record<string, string> = {
  deepseek: "DeepSeek",
  siliconflow: "硅基流动",
  openai: "OpenAI",
  claude: "Claude",
  ollama: "Ollama",
  custom: "自定义",
}

function providerLabel(id: string, customName?: string) {
  if (id === "custom") return customName?.trim() || "自定义供应商"
  return builtinLabels[id] ?? customName ?? id
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AiSettingsTab() {
  const [settings, setSettings] = React.useState<AiSettings>(getDefaultAiSettings())
  const [showKey, setShowKey] = React.useState(false)
  const [fetchingModels, setFetchingModels] = React.useState(false)
  const [detection, setDetection] = React.useState<AiModelDetection | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [savedSuccess, setSavedSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [customModelInput, setCustomModelInput] = React.useState("")
  const [addingProvider, setAddingProvider] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [addError, setAddError] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [newProvider, setNewProvider] = React.useState({
    name: "",
    apiHost: "",
    apiKey: "",
    selectedModel: "",
  })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fromServer = await loadAiSettingsFromServer()
        if (!cancelled) setSettings(fromServer)
      } catch {
        if (!cancelled) setSettings(getAiSettings())
      }
    })()
    return () => { cancelled = true }
  }, [])

  const activeProvider = settings.activeProvider
  const preset = getProviderPreset(activeProvider)
  const isBuiltin = builtinProviders.includes(activeProvider)
  const legacyCustom = settings.providers.custom
  const showLegacyCustom = activeProvider === "custom" || Boolean(
    legacyCustom?.apiKey || legacyCustom?.displayName || legacyCustom?.customModels?.length ||
    (legacyCustom?.apiHost && legacyCustom.apiHost !== AI_PROVIDER_PRESETS.custom.defaultHost) ||
    (legacyCustom?.selectedModel && legacyCustom.selectedModel !== AI_PROVIDER_PRESETS.custom.defaultModel),
  )
  const providerIds = [
    ...builtinProviders,
    ...(showLegacyCustom ? ["custom"] : []),
    ...Object.keys(settings.providers).filter((id) => id !== "custom" && !builtinProviders.includes(id)),
  ]
  const currentProviderConfig = settings.providers[activeProvider] ?? {
    apiKey: "",
    apiHost: preset.defaultHost,
    selectedModel: preset.defaultModel,
    customModels: [],
  }
  const providerName = providerLabel(activeProvider, currentProviderConfig.displayName)

  const candidateModels = React.useMemo(() => {
    const list: string[] = []
    const add = (value?: string) => {
      const model = value?.trim()
      if (model && !list.includes(model)) list.push(model)
    }
    add(currentProviderConfig.selectedModel)
    for (const model of preset.presetModels) add(model)
    for (const model of currentProviderConfig.customModels ?? []) add(model)
    if (detection?.ok) for (const model of detection.models ?? []) add(model)
    return list
  }, [currentProviderConfig.selectedModel, currentProviderConfig.customModels, preset.presetModels, detection])

  const triggerDetection = React.useCallback(async () => {
    const isOllama = activeProvider === "ollama"
    const apiKey = (currentProviderConfig.apiKey ?? "").trim()
    const apiHost = (currentProviderConfig.apiHost ?? "").trim()
    if (!isOllama && !apiKey) {
      setDetection(null)
      return
    }
    setFetchingModels(true)
    try {
      const result = await aiApi.fetchModels({ provider: activeProvider, apiHost, apiKey })
      setDetection(result)
      if (result.ok && result.models.length > 0) {
        setSettings((prev) => {
          if (prev.activeProvider !== activeProvider || !prev.providers[activeProvider]) return prev
          const current = prev.providers[activeProvider]?.selectedModel
          if (current && (result.models.includes(current) || preset.presetModels.includes(current))) return prev
          return {
            ...prev,
            providers: {
              ...prev.providers,
              [activeProvider]: { ...prev.providers[activeProvider], selectedModel: result.models[0] },
            },
          }
        })
      }
    } catch (error) {
      setDetection({
        ok: false,
        status: "REQUEST_FAILED",
        message: errorMessage(error, "检测失败"),
        endpoint: apiHost,
        httpStatus: null,
        elapsedMs: 0,
        models: [],
        detectedAt: Date.now(),
      })
    } finally {
      setFetchingModels(false)
    }
  }, [activeProvider, currentProviderConfig.apiKey, currentProviderConfig.apiHost, preset.presetModels])

  React.useEffect(() => {
    const apiKey = (currentProviderConfig.apiKey ?? "").trim()
    if (activeProvider !== "ollama" && !apiKey) {
      setDetection(null)
      return
    }
    const timer = setTimeout(() => { void triggerDetection() }, 700)
    return () => clearTimeout(timer)
  }, [activeProvider, currentProviderConfig.apiKey, currentProviderConfig.apiHost, triggerDetection])

  const updateCurrentConfig = (updates: Partial<typeof currentProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [activeProvider]: { ...prev.providers[activeProvider], ...updates },
      },
    }))
    setSaveError(null)
  }

  const handleSelectProvider = (id: AiProviderId) => {
    setAddingProvider(false)
    setSettings((prev) => ({ ...prev, activeProvider: id }))
    setDetection(null)
    setShowKey(false)
    setCustomModelInput("")
    setSaveError(null)
  }

  const handleAddCustomModel = () => {
    const model = customModelInput.trim()
    if (!model) return
    const customModels = currentProviderConfig.customModels ?? []
    updateCurrentConfig({
      selectedModel: model,
      customModels: customModels.includes(model) ? customModels : [...customModels, model],
    })
    setCustomModelInput("")
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const persisted = await saveAiSettingsToServer(settings)
      setSettings(persisted)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (error) {
      setSaveError(errorMessage(error, "保存失败"))
    } finally {
      setSaving(false)
    }
  }

  const handleClearKey = async () => {
    updateCurrentConfig({ apiKey: "" })
    setDetection(null)
    try {
      await aiApi.clearProvider(activeProvider)
    } catch (error) {
      setSaveError(errorMessage(error, "清除密钥失败"))
    }
  }

  const handleAddProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newProvider.name.trim()
    const apiHost = newProvider.apiHost.trim()
    const apiKey = newProvider.apiKey.trim()
    const selectedModel = newProvider.selectedModel.trim()
    if (!name || !apiHost || !apiKey || !selectedModel) {
      setAddError("请填写全部字段")
      return
    }
    try {
      const url = new URL(apiHost)
      if (!["http:", "https:"].includes(url.protocol)) throw new Error()
    } catch {
      setAddError("接口地址须为 HTTP 或 HTTPS URL")
      return
    }
    const id = `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const next: AiSettings = {
      ...settings,
      activeProvider: id,
      providers: {
        ...settings.providers,
        [id]: { displayName: name, apiHost, apiKey, selectedModel, customModels: [] },
      },
    }
    setAdding(true)
    setAddError(null)
    try {
      const persisted = applyServerAiConfig(await aiApi.saveConfig(toSavePayload(next)))
      setSettings(persisted)
      setAddingProvider(false)
      setNewProvider({ name: "", apiHost: "", apiKey: "", selectedModel: "" })
      setDetection(null)
    } catch (error) {
      setAddError(errorMessage(error, "添加失败"))
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteProvider = async () => {
    if (isBuiltin) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const persisted = applyServerAiConfig(await aiApi.deleteProvider(activeProvider))
      setSettings(persisted)
      setDetection(null)
      setShowKey(false)
      setCustomModelInput("")
      setDeleteOpen(false)
      setSaveError(null)
    } catch (error) {
      setDeleteError(errorMessage(error, "删除失败"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-border/70 bg-muted/20 md:border-b-0 md:border-r">
          <div className="px-4 pb-2 pt-5 text-xs font-medium text-muted-foreground">供应商</div>
          <nav aria-label="AI 供应商" className="flex gap-1 overflow-x-auto px-2 pb-2 md:block md:space-y-0.5 md:overflow-visible">
            {providerIds.map((id) => {
              const provider = settings.providers[id]
              const selected = !addingProvider && id === activeProvider
              const name = providerLabel(id, provider?.displayName)
              const configured = id === "ollama" || Boolean(provider?.apiKey)
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => handleSelectProvider(id)}
                  className={cn(
                    "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full md:min-w-0",
                    selected ? "bg-background font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">{name}</span>
                  <span className={cn("size-1.5 shrink-0 rounded-full", configured ? "bg-emerald-500" : "bg-border")} aria-label={configured ? "已配置" : "未配置"} />
                </button>
              )
            })}
          </nav>
          <div className="border-t border-border/70 p-2">
            <Button
              variant="ghost"
              aria-current={addingProvider ? "true" : undefined}
              className={cn("w-full justify-start gap-2 text-sm", addingProvider && "bg-background font-semibold")}
              onClick={() => { setAddError(null); setShowKey(false); setAddingProvider(true) }}
            >
              <PlusIcon className="size-4" />添加供应商
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          {addingProvider ? (
            <form onSubmit={handleAddProvider}>
              <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-7">
                <h3 className="text-lg font-semibold tracking-tight">添加供应商</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingProvider(false)}>取消</Button>
              </div>
              <div className="space-y-7 px-5 py-6 sm:px-7">
                <section className="space-y-4" aria-labelledby="new-connection-heading">
                  <h4 id="new-connection-heading" className="text-sm font-semibold">连接</h4>
                  <div className="space-y-1.5">
                    <label htmlFor="new-provider-name" className="text-xs font-medium text-muted-foreground">名称</label>
                    <Input id="new-provider-name" autoFocus maxLength={80} value={newProvider.name} onChange={(event) => setNewProvider((prev) => ({ ...prev, name: event.target.value }))} placeholder="供应商名称" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="new-provider-key" className="text-xs font-medium text-muted-foreground">API Key</label>
                    <div className="relative">
                      <Input id="new-provider-key" type={showKey ? "text" : "password"} autoComplete="off" value={newProvider.apiKey} onChange={(event) => setNewProvider((prev) => ({ ...prev, apiKey: event.target.value }))} className="pr-10 font-mono text-xs" placeholder="输入 API Key" />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showKey ? "隐藏密钥" : "显示密钥"}>
                        {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="new-provider-host" className="text-xs font-medium text-muted-foreground">Base URL</label>
                    <Input id="new-provider-host" type="url" value={newProvider.apiHost} onChange={(event) => setNewProvider((prev) => ({ ...prev, apiHost: event.target.value }))} className="font-mono text-xs" placeholder="https://example.com/v1" />
                  </div>
                </section>
                <section className="space-y-3 border-t border-border/70 pt-6" aria-labelledby="new-model-heading">
                  <h4 id="new-model-heading" className="text-sm font-semibold">模型</h4>
                  <div className="space-y-1.5">
                    <label htmlFor="new-provider-model" className="text-xs font-medium text-muted-foreground">模型 ID</label>
                    <Input id="new-provider-model" value={newProvider.selectedModel} onChange={(event) => setNewProvider((prev) => ({ ...prev, selectedModel: event.target.value }))} className="font-mono text-xs" placeholder="输入模型 ID" />
                  </div>
                </section>
                {addError && <p role="alert" className="text-xs text-destructive">{addError}</p>}
              </div>
              <div className="flex justify-end border-t border-border/70 px-5 py-4 sm:px-7">
                <Button type="submit" disabled={adding} className="min-w-24">
                  {adding && <Loader2Icon className="size-4 animate-spin" />}
                  {adding ? "添加中" : "添加"}
                </Button>
              </div>
            </form>
          ) : (
            <>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold tracking-tight">{providerName}</h3>
            </div>
            {preset.apiKeyUrl && (
              <a href={preset.apiKeyUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                获取密钥 <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>

          <div className="space-y-7 px-5 py-6 sm:px-7">
            <section className="space-y-4" aria-labelledby="connection-heading">
              <h4 id="connection-heading" className="text-sm font-semibold">连接</h4>
              {activeProvider !== "ollama" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="provider-key" className="text-xs font-medium text-muted-foreground">API Key</label>
                    {currentProviderConfig.apiKey && (
                      <button type="button" onClick={() => void handleClearKey()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                        <Trash2Icon className="size-3" />清除
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input id="provider-key" type={showKey ? "text" : "password"} autoComplete="off" value={currentProviderConfig.apiKey} onChange={(event) => updateCurrentConfig({ apiKey: event.target.value })} className="pr-10 font-mono text-xs" placeholder="输入 API Key" />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showKey ? "隐藏密钥" : "显示密钥"}>
                      {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="provider-host" className="text-xs font-medium text-muted-foreground">Base URL</label>
                  {isBuiltin && (
                    <button type="button" onClick={() => updateCurrentConfig({ apiHost: preset.defaultHost })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <RotateCcwIcon className="size-3" />恢复默认
                    </button>
                  )}
                </div>
                <Input id="provider-host" type="url" value={currentProviderConfig.apiHost} onChange={(event) => updateCurrentConfig({ apiHost: event.target.value })} className="font-mono text-xs" placeholder="https://example.com/v1" />
              </div>
            </section>

            <section className="space-y-3 border-t border-border/70 pt-6" aria-labelledby="model-heading">
              <div className="flex items-center justify-between gap-3">
                <h4 id="model-heading" className="text-sm font-semibold">模型</h4>
                <button type="button" onClick={() => void triggerDetection()} disabled={fetchingModels || (activeProvider !== "ollama" && !currentProviderConfig.apiKey)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
                  <RefreshCwIcon className={cn("size-3.5", fetchingModels && "animate-spin")} />{fetchingModels ? "检测中" : "检测模型"}
                </button>
              </div>
              {detection && (
                <p role="status" className={cn("text-xs", detection.ok ? "text-muted-foreground" : "text-destructive")}>
                  {detection.ok ? `已连接 · ${detection.models.length} 个模型` : detection.message}
                </p>
              )}
              <div className="max-h-52 overflow-y-auto rounded-md border border-border/70">
                {candidateModels.map((model) => (
                  <button key={model} type="button" onClick={() => updateCurrentConfig({ selectedModel: model })} className={cn("flex w-full items-center justify-between gap-3 border-b border-border/60 px-3.5 py-2.5 text-left font-mono text-xs transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", currentProviderConfig.selectedModel === model && "bg-muted/60 font-semibold")}>
                    <span className="min-w-0 break-all">{model}</span>
                    {currentProviderConfig.selectedModel === model && <CheckIcon className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input aria-label="模型 ID" value={customModelInput} onChange={(event) => setCustomModelInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleAddCustomModel() } }} placeholder="模型 ID" className="h-9 min-w-0 flex-1 font-mono text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={handleAddCustomModel} disabled={!customModelInput.trim()}>添加模型</Button>
              </div>
            </section>

            <details className="group border-t border-border/70 pt-5">
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">使用范围</summary>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="reading-ai" className="text-sm">词句解析</label>
                  <Switch id="reading-ai" checked={settings.enableReadingAi} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, enableReadingAi: value }))} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="story-ai" className="text-sm">语境文章</label>
                  <Switch id="story-ai" checked={settings.enableStoryAi} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, enableStoryAi: value }))} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="subtitle-ai" className="text-sm">账号模型字幕翻译</label>
                  <Switch id="subtitle-ai" checked={settings.enableSubtitleAi} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, enableSubtitleAi: value }))} />
                </div>
              </div>
            </details>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border/70 px-5 py-4 sm:px-7">
            {!isBuiltin && (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(null); setDeleteOpen(true) }}>
                <Trash2Icon className="size-4" />删除供应商
              </Button>
            )}
            <p role="status" className="min-w-0 text-xs text-destructive">{saveError}</p>
            <Button type="button" onClick={() => void handleSave()} disabled={saving} className="ml-auto min-w-24">
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              {saving ? "保存中" : savedSuccess ? "已保存" : "保存"}
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>删除供应商？</DialogTitle>
            <DialogDescription>将删除“{providerName}”及其保存的密钥和模型配置。</DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void handleDeleteProvider()}>
              {deleting && <Loader2Icon className="size-4 animate-spin" />}
              {deleting ? "删除中" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

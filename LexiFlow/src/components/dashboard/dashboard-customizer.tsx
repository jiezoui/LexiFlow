"use client"

import { useState, useEffect } from "react"
import {
  DndContext,
  pointerWithin,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import {
  GripVerticalIcon,
  LayoutGridIcon,
  LockIcon,
  RotateCcwIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HeroMissionCard } from "@/components/dashboard/hero-mission-card"
import { RecentCaptures } from "@/components/dashboard/recent-captures"
import { QuickActionDock } from "@/components/dashboard/quick-action-dock"
import { DailyCuratedQuote } from "@/components/dashboard/daily-curated-quote"
import { LearningVelocityCompositeChart } from "@/components/dashboard/learning-velocity-composite"
import { FsrsRetentionChart } from "@/components/dashboard/fsrs-retention-chart"
import { MultimodalRadarChart } from "@/components/dashboard/multimodal-radar-chart"
import { CognitiveLoadChart } from "@/components/dashboard/cognitive-load-chart"
import { CorpusDonutChart } from "@/components/dashboard/corpus-donut-chart"
import { ActiveWordbookCard } from "@/components/dashboard/active-wordbook-card"

type WidgetSize = "sm" | "lg" | "full"

type Block = {
  id: string
  label: string
  size: WidgetSize
  component: React.ReactNode
}

const defaultBlocks: Block[] = [
  { id: "active-wordbook", label: "当前主研习词书指标看板", size: "full", component: <ActiveWordbookCard /> },
  { id: "learning-velocity", label: "全景研习流速与记忆留存复合图谱", size: "full", component: <LearningVelocityCompositeChart /> },
  { id: "fsrs-retention", label: "FSRS 记忆保持率与遗忘衰减对比", size: "lg", component: <FsrsRetentionChart /> },
  { id: "multimodal-radar", label: "6 维声学与认知雷达", size: "sm", component: <MultimodalRadarChart /> },
  { id: "cognitive-load", label: "14 天认知负荷与复习通量", size: "lg", component: <CognitiveLoadChart /> },
  { id: "corpus-donut", label: "语境切片来源分布", size: "sm", component: <CorpusDonutChart /> },
  { id: "recent-captures", label: "语境快照流", size: "full", component: <RecentCaptures /> },
  { id: "quick-actions", label: "快捷心流操作台", size: "full", component: <QuickActionDock /> },
]

const sizeClass: Record<WidgetSize, string> = {
  sm: "col-span-12 lg:col-span-4",
  lg: "col-span-12 lg:col-span-8",
  full: "col-span-12",
}

const STORAGE_ORDER_KEY = "lexiflow-dashboard-order-v6"
const STORAGE_MODE_KEY = "lexiflow-dashboard-mode"

// Null strategy: let CSS Grid handle layout
const nullStrategy = () => null

function SortableWidget({
  block,
  editing,
}: {
  block: Block
  editing: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: block.id,
    disabled: !editing,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        sizeClass[block.size],
        "relative transition-opacity duration-200",
        isDragging && "opacity-30",
        editing && !isDragging && "rounded-3xl ring-2 ring-dashed ring-zinc-400 dark:ring-zinc-600 p-1",
      )}
    >
      {editing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 cursor-grab items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11px] font-mono font-medium text-background shadow-lg active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3" />
          {block.label}
        </div>
      )}
      <div className={cn("h-full [&>*]:h-full", editing && "pointer-events-none select-none")}>
        {block.component}
      </div>
    </div>
  )
}

export function DashboardCustomizer() {
  const [mode, setMode] = useState<"zen" | "analytics">("zen")
  const [editing, setEditing] = useState(false)
  const [blocks, setBlocks] = useState(() => {
    if (typeof window === "undefined") return defaultBlocks
    try {
      const saved = localStorage.getItem(STORAGE_ORDER_KEY)
      if (saved) {
        const order: string[] = JSON.parse(saved)
        const reordered = order
          .map((id) => defaultBlocks.find((b) => b.id === id))
          .filter(Boolean) as Block[]
        for (const b of defaultBlocks) {
          if (!reordered.find((r) => r.id === b.id)) reordered.push(b)
        }
        return reordered
      }
    } catch {}
    return defaultBlocks
  })
  const [activeId, setActiveId] = useState<string | null>(null)

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY)
      if (savedMode === "zen" || savedMode === "analytics") {
        setMode(savedMode)
      }
    } catch {}
  }, [])

  const handleModeChange = (newMode: "zen" | "analytics") => {
    setMode(newMode)
    try {
      localStorage.setItem(STORAGE_MODE_KEY, newMode)
    } catch {}
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id)
      const newIndex = prev.findIndex((b) => b.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(next.map((b) => b.id)))
      return next
    })
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleReset = () => {
    setBlocks(defaultBlocks)
    localStorage.removeItem(STORAGE_ORDER_KEY)
  }

  const activeBlock = blocks.find((b) => b.id === activeId)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-3 max-w-6xl mx-auto w-full">
      {/* Top Header Bar with Dual Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground font-semibold uppercase">
            Workspace · 语脉研习工作台
          </div>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            今日学习概览
          </h1>
        </div>

        {/* Mode Selector & Customizer Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Zen vs Analytics Switch */}
          <div className="inline-flex items-center rounded-xl border border-border bg-secondary p-1 text-xs">
            <button
              onClick={() => handleModeChange("zen")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition-all",
                mode === "zen"
                  ? "bg-card text-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SparklesIcon className="size-3" />
              极简心流 (Zen)
            </button>
            <button
              onClick={() => handleModeChange("analytics")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition-all",
                mode === "analytics"
                  ? "bg-card text-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGridIcon className="size-3" />
              全景数据 (Analytics)
            </button>
          </div>

          {/* Customize Button (Only active in Analytics Mode) */}
          {mode === "analytics" && (
            <>
              {editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                >
                  <RotateCcwIcon className="size-3 mr-1" />
                  重置
                </Button>
              )}
              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-xl"
                onClick={() => setEditing(!editing)}
              >
                {editing ? (
                  <>
                    <LockIcon className="size-3.5" />
                    完成锁定
                  </>
                ) : (
                  <>
                    <SlidersHorizontalIcon className="size-3.5" />
                    调整布局
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mode Render Strategy */}
      {mode === "zen" ? (
        /* ──────── 1. 极简心流模式 (Zen Mode): 留白充分、无认知过载 ──────── */
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Unified Mission Card (Merged with Wordbook) */}
          <HeroMissionCard minimal={true} />

          {/* Single High-Impact Curated Context Sentence */}
          <DailyCuratedQuote />

          {/* Quick Action Dock */}
          <div className="pt-2">
            <QuickActionDock />
          </div>
        </div>
      ) : (
        /* ──────── 2. 全景数据模式 (Analytics Mode) ──────── */
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={nullStrategy}
          >
            <div className="grid grid-cols-12 gap-5 items-stretch animate-in fade-in duration-300">
              {blocks.map((block) => (
                <SortableWidget
                  key={block.id}
                  block={block}
                  editing={editing}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeBlock ? (
              <div className="rounded-2xl bg-card p-5 shadow-2xl ring-2 ring-foreground/20 rotate-[1deg] scale-[1.02]">
                <p className="text-sm font-bold text-foreground">
                  {activeBlock.label}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

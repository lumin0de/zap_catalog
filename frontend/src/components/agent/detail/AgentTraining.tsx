import { useState, useEffect, useCallback } from "react"
import { Search, FileText, Globe, Video, File, Database } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { callEdgeFunction } from "@/lib/api"
import { TrainingItemForm } from "./TrainingItemForm"
import { DocumentUploadForm } from "./DocumentUploadForm"
import { TrainingItemCard } from "./TrainingItemCard"
import type { AgentTrainingItem, TrainingItemType } from "@/types/agent"

const MAX_KNOWLEDGE_CHARS = 32_000

interface AgentTrainingProps {
  agentId: string
}

const tabs: { type: TrainingItemType; label: string; icon: React.ElementType }[] = [
  { type: "texto", label: "Texto", icon: FileText },
  { type: "website", label: "Website", icon: Globe },
  { type: "video", label: "Video", icon: Video },
  { type: "documento", label: "Documento", icon: File },
]

export function AgentTraining({ agentId }: AgentTrainingProps) {
  const [activeType, setActiveType] = useState<TrainingItemType>("texto")
  const [items, setItems] = useState<AgentTrainingItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const loadItems = useCallback(async () => {
    try {
      const res = await callEdgeFunction<{ items: AgentTrainingItem[] }>(
        "list-training-items",
        { agentId },
      )
      setItems(res.items)
    } catch {
      // silent fail, items will be empty
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleCreated = (item: AgentTrainingItem) => {
    setItems((prev) => [item, ...prev])
  }

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const totalChars = items.reduce((sum, i) => sum + (i.char_count ?? 0), 0)
  const usagePercent = Math.min(100, (totalChars / MAX_KNOWLEDGE_CHARS) * 100)

  const filtered = items.filter((item) => {
    const matchType = item.type === activeType
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Treinamentos</h2>
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar treinamento"
            className="pl-9"
          />
        </div>
      </div>

      {/* Knowledge base usage bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>Base de conhecimento</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {totalChars.toLocaleString("pt-BR")} / {MAX_KNOWLEDGE_CHARS.toLocaleString("pt-BR")} caracteres
          </span>
          <div className="h-2 w-24 rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                usagePercent > 90 ? "bg-destructive" : usagePercent > 70 ? "bg-yellow-500" : "bg-primary",
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const count = items.filter((i) => i.type === tab.type).length
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => setActiveType(tab.type)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                activeType === tab.type
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Form */}
      {activeType === "documento" ? (
        <DocumentUploadForm agentId={agentId} onCreated={handleCreated} />
      ) : (
        <TrainingItemForm
          agentId={agentId}
          activeType={activeType}
          onCreated={handleCreated}
        />
      )}

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search
            ? "Nenhum treinamento encontrado para essa busca."
            : "Nenhum treinamento cadastrado nessa categoria ainda."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <TrainingItemCard
              key={item.id}
              item={item}
              onDeleted={handleDeleted}
              onReprocessed={loadItems}
            />
          ))}
        </div>
      )}

      {/* Total count */}
      <p className="text-right text-xs text-muted-foreground">
        Itens: {items.length}
      </p>
    </div>
  )
}

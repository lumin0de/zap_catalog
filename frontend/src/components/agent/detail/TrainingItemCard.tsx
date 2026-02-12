import { useState } from "react"
import {
  FileText,
  Globe,
  Video,
  File,
  Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { AgentTrainingItem, TrainingItemType } from "@/types/agent"

interface TrainingItemCardProps {
  item: AgentTrainingItem
  onDeleted: (id: string) => void
}

const typeConfig: Record<
  TrainingItemType,
  { icon: React.ElementType; label: string }
> = {
  texto: { icon: FileText, label: "Texto" },
  website: { icon: Globe, label: "Website" },
  video: { icon: Video, label: "Video" },
  documento: { icon: File, label: "Documento" },
}

export function TrainingItemCard({ item, onDeleted }: TrainingItemCardProps) {
  const [deleting, setDeleting] = useState(false)
  const config = typeConfig[item.type]
  const Icon = config.icon

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await callEdgeFunction("delete-training-item", {
        trainingItemId: item.id,
      })
      onDeleted(item.id)
      toast.success("Item removido!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {item.title || config.label}
          </p>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {item.content}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

import { useState } from "react"
import {
  FileText,
  Globe,
  Video,
  File,
  Trash2,
  Loader2,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/config/supabase"
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TrainingItemCard({ item, onDeleted }: TrainingItemCardProps) {
  const [deleting, setDeleting] = useState(false)
  const config = typeConfig[item.type]
  const Icon = config.icon

  const isDocument = item.type === "documento" && item.storage_path

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

  const handleDownload = async () => {
    if (!item.storage_path) return
    try {
      const { data, error } = await supabase.storage
        .from("training-documents")
        .createSignedUrl(item.storage_path, 60)
      if (error) throw error
      window.open(data.signedUrl, "_blank")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar")
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
            {item.title || item.file_name || config.label}
          </p>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {config.label}
          </span>
        </div>
        {isDocument && item.file_size ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.file_name} - {formatSize(item.file_size)}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {item.content}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isDocument && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
    </div>
  )
}

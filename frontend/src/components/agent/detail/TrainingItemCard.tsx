import { useState } from "react"
import {
  FileText,
  Globe,
  Video,
  File,
  Trash2,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/config/supabase"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { AgentTrainingItem, TrainingItemType } from "@/types/agent"

interface TrainingItemCardProps {
  item: AgentTrainingItem
  onDeleted: (id: string) => void
  onReprocessed?: () => void
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

function formatCharCount(chars: number): string {
  if (chars < 1000) return `${chars} chars`
  return `${(chars / 1000).toFixed(1)}K chars`
}

export function TrainingItemCard({ item, onDeleted, onReprocessed }: TrainingItemCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
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

  const handleReprocess = async () => {
    setReprocessing(true)
    try {
      await callEdgeFunction("reprocess-training-item", {
        agentId: item.agent_id,
        trainingItemId: item.id,
      }, 45_000)
      toast.success("Item reprocessado!")
      onReprocessed?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reprocessar")
    } finally {
      setReprocessing(false)
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

          {/* Processing status badge */}
          {item.processing_status === "processing" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processando
            </Badge>
          )}
          {item.processing_status === "done" && item.char_count > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              {formatCharCount(item.char_count)}
            </Badge>
          )}
          {item.processing_status === "error" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
              <AlertCircle className="h-3 w-3" />
              Erro
            </Badge>
          )}
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
        {item.processing_status === "error" && item.processing_error && (
          <p className="mt-1 text-xs text-destructive line-clamp-1">
            {item.processing_error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.processing_status === "error" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={handleReprocess}
            disabled={reprocessing}
            title="Reprocessar"
          >
            {reprocessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
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

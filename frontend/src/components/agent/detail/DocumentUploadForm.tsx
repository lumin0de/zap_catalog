import { useState, useRef, useCallback } from "react"
import { Upload, File, X, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { supabase } from "@/config/supabase"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { AgentTrainingItem } from "@/types/agent"

interface DocumentUploadFormProps {
  agentId: string
  onCreated: (item: AgentTrainingItem) => void
}

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
}

const ACCEPT_STRING = Object.keys(ACCEPTED_TYPES).join(",") + ",.pdf,.doc,.docx,.txt"
const MAX_SIZE = 100 * 1024 * 1024 // 100MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtLabel(file: File): string {
  const mime = ACCEPTED_TYPES[file.type]
  if (mime) return mime
  const ext = file.name.split(".").pop()?.toUpperCase()
  return ext ?? "FILE"
}

export function DocumentUploadForm({ agentId, onCreated }: DocumentUploadFormProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<"idle" | "uploading" | "saving" | "done">("idle")
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE) {
      return `Arquivo muito grande (${formatSize(file.size)}). Maximo permitido: 100MB.`
    }
    const ext = file.name.split(".").pop()?.toLowerCase()
    const validExts = ["pdf", "doc", "docx", "txt"]
    if (!validExts.includes(ext ?? "")) {
      return "Formato nao suportado. Aceitos: PDF, DOC, DOCX, TXT."
    }
    return null
  }

  const handleFile = (file: File) => {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setProgress("idle")
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setProgress("uploading")

    try {
      // 1) Upload to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sessao expirada")

      const timestamp = Date.now()
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${agentId}/${timestamp}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        })

      if (uploadError) throw new Error(uploadError.message)

      // 2) Create training item record
      setProgress("saving")
      const res = await callEdgeFunction<{ item: AgentTrainingItem }>(
        "create-training-item",
        {
          agentId,
          type: "documento",
          content: "",
          title: selectedFile.name,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          storagePath,
        },
        60_000,
      )

      setProgress("done")
      onCreated(res.item)
      toast.success("Documento enviado com sucesso!")

      // Reset after brief delay
      setTimeout(() => {
        setSelectedFile(null)
        setProgress("idle")
      }, 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar documento")
      setProgress("idle")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Novo treinamento via documento</p>

      {/* Drop zone */}
      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/50",
          )}
        >
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            dragOver ? "bg-primary/15" : "bg-muted",
          )}>
            <Upload className={cn(
              "h-6 w-6 transition-colors",
              dragOver ? "text-primary" : "text-muted-foreground",
            )} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              Arraste e solte seu arquivo aqui
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ou clique para selecionar
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, DOC, DOCX ou TXT - max. 100MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_STRING}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        /* Selected file preview */
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <File className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getExtLabel(selectedFile)}</span>
              <span>-</span>
              <span>{formatSize(selectedFile.size)}</span>
            </div>
          </div>

          {progress === "done" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          ) : !uploading ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          )}
        </div>
      )}

      {/* Upload button */}
      {selectedFile && progress !== "done" && (
        <Button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full"
          size="sm"
        >
          {progress === "uploading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando arquivo...
            </>
          ) : progress === "saving" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando conteudo...
            </>
          ) : (
            "Enviar documento"
          )}
        </Button>
      )}
    </div>
  )
}

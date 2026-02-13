import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { AgentTrainingItem, TrainingItemType } from "@/types/agent"

interface TrainingItemFormProps {
  agentId: string
  activeType: TrainingItemType
  onCreated: (item: AgentTrainingItem) => void
}

const placeholders: Record<TrainingItemType, string> = {
  texto:
    "Escreva uma afirmacao e tecle enter para cadastrar...\nEx: Nosso horario de funcionamento e de segunda a sexta, das 9h as 18h.",
  website: "https://www.seusite.com.br/pagina-de-ajuda",
  video: "https://www.youtube.com/watch?v=...",
  documento: "Descreva o conteudo do documento ou cole o texto aqui...",
}

const MAX_CONTENT = 1028

export function TrainingItemForm({
  agentId,
  activeType,
  onCreated,
}: TrainingItemFormProps) {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [saving, setSaving] = useState(false)

  const isUrl = activeType === "website" || activeType === "video"

  const handleSubmit = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      const res = await callEdgeFunction<{ item: AgentTrainingItem }>(
        "create-training-item",
        {
          agentId,
          type: activeType,
          content: content.trim(),
          title: title.trim() || undefined,
        },
        45_000,
      )
      onCreated(res.item)
      setContent("")
      setTitle("")
      toast.success("Treinamento cadastrado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Novo treinamento via {activeType}
        </p>
        <span className="text-xs text-muted-foreground">
          {content.length}/{MAX_CONTENT}
        </span>
      </div>

      {isUrl ? (
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholders[activeType]}
          maxLength={MAX_CONTENT}
        />
      ) : (
        <Textarea
          value={content}
          onChange={(e) =>
            e.target.value.length <= MAX_CONTENT &&
            setContent(e.target.value)
          }
          placeholder={placeholders[activeType]}
          rows={3}
          className="resize-none text-sm"
        />
      )}

      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo (opcional)"
          maxLength={100}
          className="flex-1"
        />
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          size="sm"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            "Cadastrar"
          )}
        </Button>
      </div>
    </div>
  )
}

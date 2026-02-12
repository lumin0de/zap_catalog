import { useState } from "react"
import { Bot, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { Agent } from "@/types/agent"

interface AgentProfileProps {
  agent: Agent
  onUpdated: (agent: Agent) => void
}

const objectiveLabels = {
  suporte: "Suporte",
  vendas: "Vendas",
  pessoal: "Uso Pessoal",
}

export function AgentProfile({ agent, onUpdated }: AgentProfileProps) {
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.company_description)
  const [saving, setSaving] = useState(false)

  const hasChanges =
    name !== agent.name || description !== agent.company_description

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await callEdgeFunction<{ agent: Agent }>("update-agent", {
        agentId: agent.id,
        name,
        companyDescription: description,
      })
      onUpdated(res.agent)
      toast.success("Perfil atualizado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{agent.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">
                  {objectiveLabels[agent.objective]}
                </Badge>
                <Badge variant={agent.is_active ? "default" : "outline"}>
                  {agent.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacoes do Agente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Nome do agente</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-desc">Descricao da empresa</Label>
            <Textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length}/500
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alteracoes"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

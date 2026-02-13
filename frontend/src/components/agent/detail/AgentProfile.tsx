import { useState } from "react"
import { Bot, Loader2, Trash2 } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { Agent, AgentObjective } from "@/types/agent"

interface AgentProfileProps {
  agent: Agent
  onUpdated: (agent: Agent) => void
  onDeleted: () => void
}

const objectiveLabels: Record<AgentObjective, string> = {
  suporte: "Suporte",
  vendas: "Vendas",
  pessoal: "Uso Pessoal",
}

export function AgentProfile({ agent, onUpdated, onDeleted }: AgentProfileProps) {
  const [name, setName] = useState(agent.name)
  const [objective, setObjective] = useState<AgentObjective>(agent.objective)
  const [description, setDescription] = useState(agent.company_description)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const hasChanges =
    name !== agent.name ||
    objective !== agent.objective ||
    description !== agent.company_description

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await callEdgeFunction<{ agent: Agent }>("update-agent", {
        agentId: agent.id,
        name,
        objective,
        companyDescription: description,
      })
      // Recompile prompt since name/objective/description affect it
      await callEdgeFunction("compile-prompt", { agentId: agent.id })
      onUpdated(res.agent)
      toast.success("Perfil atualizado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await callEdgeFunction("delete-agent", { agentId: agent.id })
      toast.success("Agente removido com sucesso!")
      setDeleteDialogOpen(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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

            {/* Delete button */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir agente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Excluir agente</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja excluir <span className="font-semibold text-foreground">{agent.name}</span>?
                    Todos os treinamentos e configuracoes serao perdidos permanentemente.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      "Sim, excluir"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Edit card */}
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
            <Label htmlFor="agent-objective">Objetivo</Label>
            <Select value={objective} onValueChange={(val) => setObjective(val as AgentObjective)}>
              <SelectTrigger id="agent-objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suporte">Suporte</SelectItem>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="pessoal">Uso Pessoal</SelectItem>
              </SelectContent>
            </Select>
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

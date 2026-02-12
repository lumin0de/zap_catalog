import { useState } from "react"
import {
  UserCheck,
  Smile,
  ShieldAlert,
  SplitSquareVertical,
  Loader2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { AgentWizardData, Agent } from "@/types/agent"

interface StepConfigFlagsProps {
  data: AgentWizardData
  onUpdate: (partial: Partial<AgentWizardData>) => void
  onDone: (agent: Agent) => void
}

const flags = [
  {
    key: "transferToHuman" as const,
    label: "Transferir para humano",
    description:
      "Habilite para que o agente possa transferir o atendimento para a equipe humana.",
    icon: UserCheck,
  },
  {
    key: "useEmojis" as const,
    label: "Usar Emojis nas Respostas",
    description: "Define se o agente pode utilizar emojis em suas respostas.",
    icon: Smile,
  },
  {
    key: "restrictTopics" as const,
    label: "Restringir Temas Permitidos",
    description:
      "Marque essa opcao para que o agente nao fale sobre outros assuntos.",
    icon: ShieldAlert,
  },
  {
    key: "splitResponses" as const,
    label: "Dividir resposta em partes",
    description:
      "Em caso da mensagem ficar grande, o agente pode separar em varias mensagens.",
    icon: SplitSquareVertical,
  },
]

export function StepConfigFlags({
  data,
  onUpdate,
  onDone,
}: StepConfigFlagsProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = (
    key: "transferToHuman" | "useEmojis" | "restrictTopics" | "splitResponses",
    value: boolean,
  ) => {
    onUpdate({ [key]: value })
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await callEdgeFunction<{ agent: Agent }>("create-agent", {
        name: data.name,
        objective: data.objective,
        companyDescription: data.companyDescription,
        transferToHuman: data.transferToHuman,
        useEmojis: data.useEmojis,
        restrictTopics: data.restrictTopics,
        splitResponses: data.splitResponses,
      })
      onDone(res.agent)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao criar agente",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Configuracoes de {data.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Defina abaixo as configuracoes sobre os atendimentos que mais faz
          sentido para voce.
        </p>
      </div>

      <div className="w-full space-y-1">
        {flags.map((flag) => {
          const Icon = flag.icon
          return (
            <div
              key={flag.key}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{flag.label}</p>
                <p className="text-xs text-muted-foreground">
                  {flag.description}
                </p>
              </div>
              <Switch
                checked={data[flag.key]}
                onCheckedChange={(val) => handleToggle(flag.key, val)}
              />
            </div>
          )
        })}
      </div>

      <Button
        onClick={handleCreate}
        disabled={loading}
        className="w-full max-w-sm h-11"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando agente...
          </>
        ) : (
          "Criar Agente"
        )}
      </Button>
    </div>
  )
}

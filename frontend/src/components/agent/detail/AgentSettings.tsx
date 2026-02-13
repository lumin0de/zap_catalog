import { useState } from "react"
import {
  UserCheck,
  FileText,
  Smile,
  Pen,
  ShieldAlert,
  SplitSquareVertical,
  Bell,
  GraduationCap,
  Clock,
  Timer,
  Hash,
  Loader2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { callEdgeFunction } from "@/lib/api"
import { toast } from "sonner"
import type { Agent } from "@/types/agent"

interface AgentSettingsProps {
  agent: Agent
  onUpdated: (agent: Agent) => void
}

export function AgentSettings({ agent, onUpdated }: AgentSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    transferToHuman: agent.transfer_to_human,
    summaryOnTransfer: agent.summary_on_transfer,
    useEmojis: agent.use_emojis,
    signAgentName: agent.sign_agent_name,
    restrictTopics: agent.restrict_topics,
    splitResponses: agent.split_responses,
    allowReminders: agent.allow_reminders,
    smartSearch: agent.smart_search,
    timezone: agent.timezone,
    responseTime: agent.response_time,
    interactionLimit: agent.interaction_limit,
  })

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await callEdgeFunction<{ agent: Agent }>("update-agent", {
        agentId: agent.id,
        ...settings,
      })
      // Recompile prompt since config flags affect it
      await callEdgeFunction("compile-prompt", { agentId: agent.id })
      onUpdated(res.agent)
      toast.success("Configuracoes salvas!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const toggleFlags: {
    key: keyof typeof settings
    label: string
    description: string
    icon: React.ElementType
    badge?: string
    dependsOn?: keyof typeof settings
  }[] = [
    {
      key: "transferToHuman",
      label: "Transferir para humano",
      description:
        "Habilite para que o agente possa transferir o atendimento para aba 'em espera' de equipe humana.",
      icon: UserCheck,
    },
    {
      key: "summaryOnTransfer",
      label: "Resumo ao transferir para humano",
      description:
        "Habilite para gerar automaticamente um resumo do atendimento ao transferir a conversa da IA para um atendente humano.",
      icon: FileText,
      dependsOn: "transferToHuman",
    },
    {
      key: "useEmojis",
      label: "Usar Emojis nas Respostas",
      description:
        "Define se o agente pode utilizar emojis em suas respostas.",
      icon: Smile,
    },
    {
      key: "signAgentName",
      label: "Assinar nome do agente nas respostas",
      description:
        "Ative esta opcao para que o agente de IA adicione automaticamente sua assinatura em cada resposta enviada ao usuario.",
      icon: Pen,
    },
    {
      key: "restrictTopics",
      label: "Restringir Temas Permitidos",
      description:
        "Marque essa opcao para que o agente nao fale sobre outros assuntos.",
      icon: ShieldAlert,
    },
    {
      key: "splitResponses",
      label: "Dividir resposta em partes",
      description:
        "Em caso da mensagem ficar grande, o agente pode separar em varias mensagens.",
      icon: SplitSquareVertical,
    },
    {
      key: "allowReminders",
      label: "Permitir registrar lembretes",
      description:
        "Habilite essa opcao para que o agente tenha a capacidade de registrar lembretes ao usuario.",
      icon: Bell,
    },
    {
      key: "smartSearch",
      label: "Busca inteligente do treinamento",
      description:
        "O agente consulta a base de treinamentos no momento certo, para trazer respostas mais precisas.",
      icon: GraduationCap,
      badge: "Beta",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Configuracoes de {agent.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Toggle flags */}
        {toggleFlags.map((flag) => {
          const Icon = flag.icon
          const isHidden =
            flag.dependsOn && !settings[flag.dependsOn]

          if (isHidden) return null

          return (
            <div
              key={flag.key}
              className="flex items-center gap-4 rounded-lg px-2 py-3"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{flag.label}</p>
                  {flag.badge && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {flag.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {flag.description}
                </p>
              </div>
              <Switch
                checked={settings[flag.key] as boolean}
                onCheckedChange={() => toggle(flag.key)}
              />
            </div>
          )
        })}

        <Separator className="my-4" />

        {/* Select fields */}
        <div className="space-y-4">
          {/* Timezone */}
          <div className="flex items-center gap-4 rounded-lg px-2 py-3">
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Timezone do agente</p>
              <p className="text-xs text-muted-foreground">
                Escolha o timezone que agente usara para datas, por exemplo
                agendar reunioes.
              </p>
            </div>
            <Select
              value={settings.timezone}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, timezone: val }))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">
                  (GMT-03:00) Sao Paulo
                </SelectItem>
                <SelectItem value="America/Manaus">
                  (GMT-04:00) Manaus
                </SelectItem>
                <SelectItem value="America/Belem">
                  (GMT-03:00) Belem
                </SelectItem>
                <SelectItem value="America/Fortaleza">
                  (GMT-03:00) Fortaleza
                </SelectItem>
                <SelectItem value="America/Bahia">
                  (GMT-03:00) Bahia
                </SelectItem>
                <SelectItem value="America/Cuiaba">
                  (GMT-04:00) Cuiaba
                </SelectItem>
                <SelectItem value="America/Rio_Branco">
                  (GMT-05:00) Rio Branco
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Response time */}
          <div className="flex items-center gap-4 rounded-lg px-2 py-3">
            <Timer className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Tempo de resposta</p>
              <p className="text-xs text-muted-foreground">
                Defina um intervalo para o agente esperar e dar uma resposta.
              </p>
            </div>
            <Select
              value={settings.responseTime}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, responseTime: val }))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Imediatamente</SelectItem>
                <SelectItem value="5s">5 segundos</SelectItem>
                <SelectItem value="10s">10 segundos</SelectItem>
                <SelectItem value="15s">15 segundos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interaction limit */}
          <div className="flex items-center gap-4 rounded-lg px-2 py-3">
            <Hash className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Limite de interacoes por atendimento
              </p>
              <p className="text-xs text-muted-foreground">
                Defina a quantidade de interacoes que o agente pode aceitar
                por atendimento.
              </p>
            </div>
            <Select
              value={String(settings.interactionLimit)}
              onValueChange={(val) =>
                setSettings((prev) => ({
                  ...prev,
                  interactionLimit: Number(val),
                }))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem limite</SelectItem>
                <SelectItem value="5">5 interacoes</SelectItem>
                <SelectItem value="10">10 interacoes</SelectItem>
                <SelectItem value="20">20 interacoes</SelectItem>
                <SelectItem value="50">50 interacoes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-4" />

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar configuracoes"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

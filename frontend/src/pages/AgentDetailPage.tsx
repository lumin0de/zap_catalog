import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "react-router"
import { Loader2 } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { callEdgeFunction } from "@/lib/api"
import { AgentProfile } from "@/components/agent/detail/AgentProfile"
import { AgentTraining } from "@/components/agent/detail/AgentTraining"
import { AgentSettings } from "@/components/agent/detail/AgentSettings"
import type { Agent } from "@/types/agent"

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeTab = searchParams.get("tab") || "perfil"

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const res = await callEdgeFunction<{ agent: Agent }>("get-agent", {
          agentId: id,
        })
        setAgent(res.agent)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar agente",
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  const handleUpdated = (updated: Agent) => {
    setAgent(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">{error || "Agente nao encontrado"}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dados do agente
        </h1>
        <p className="text-sm text-muted-foreground">
          Visualize informacoes, faca treinamentos ou ajuste as configuracoes
          do seu agente.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="treinamentos">Treinamentos</TabsTrigger>
          <TabsTrigger value="configuracoes">Configuracoes</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <AgentProfile agent={agent} onUpdated={handleUpdated} />
        </TabsContent>

        <TabsContent value="treinamentos" className="mt-6">
          <AgentTraining agentId={agent.id} />
        </TabsContent>

        <TabsContent value="configuracoes" className="mt-6">
          <AgentSettings agent={agent} onUpdated={handleUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

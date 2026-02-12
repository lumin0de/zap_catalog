import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router"
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

export default function AgentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  const activeTab = searchParams.get("tab") || "perfil"

  const loadAgent = useCallback(async () => {
    try {
      const res = await callEdgeFunction<{ agents: Agent[] }>("list-agents")
      if (res.agents.length > 0) {
        setAgent(res.agents[0])
      } else {
        // Nenhum agente existe, redirecionar para o wizard
        navigate("/app/agent/new", { replace: true })
      }
    } catch {
      // Em caso de erro, permitir criar um novo
      navigate("/app/agent/new", { replace: true })
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    loadAgent()
  }, [loadAgent])

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  const handleUpdated = (updated: Agent) => {
    setAgent(updated)
  }

  const handleDeleted = () => {
    setAgent(null)
    navigate("/app/agent/new", { replace: true })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!agent) return null

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
          <AgentProfile
            agent={agent}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
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

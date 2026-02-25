import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Webhook, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export function WebhooksTab() {
  const { whatsapp, refreshIntegrations } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleReconfigure = async () => {
    setLoading(true)
    try {
      await callEdgeFunction("webhook", {})
      await refreshIntegrations()
      toast.success("Webhook reconfigurado com sucesso!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reconfigurar webhook")
    } finally {
      setLoading(false)
    }
  }

  if (!whatsapp?.instance_token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook do Agente</CardTitle>
          <CardDescription>Integração automática de mensagens via WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Webhook className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Conecte o WhatsApp primeiro para ativar o agente.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isActive = !!(whatsapp.webhook_url && whatsapp.webhook_enabled)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook do Agente</CardTitle>
        <CardDescription>
          O agente recebe e responde mensagens automaticamente via WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          {isActive ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-yellow-500" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isActive ? "Webhook ativo" : "Webhook não configurado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isActive
                ? "O agente está recebendo mensagens e respondendo automaticamente."
                : "Clique em Configurar para ativar o agente."}
            </p>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <Button onClick={handleReconfigure} disabled={loading} variant="outline">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isActive ? "Reconfigurar webhook" : "Configurar webhook"}
        </Button>
      </CardContent>
    </Card>
  )
}

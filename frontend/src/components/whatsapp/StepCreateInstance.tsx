import { useState } from "react"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquare, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

interface StepCreateInstanceProps {
  onNext: () => void
}

export function StepCreateInstance({ onNext }: StepCreateInstanceProps) {
  const { refreshIntegrations } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      await callEdgeFunction("init")
      await refreshIntegrations()
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Criar instância WhatsApp</h3>
        <p className="text-sm text-muted-foreground">
          Vamos criar uma instância na UAZAPI para conectar seu WhatsApp. Isso leva apenas alguns
          segundos.
        </p>
      </div>

      <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Use um número exclusivo para o bot
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              A partir da conexão, <strong>todas as mensagens recebidas</strong> por esse número serão
              respondidas automaticamente pelo agente. Recomendamos conectar um número novo, sem histórico
              de conversas, dedicado exclusivamente ao atendimento via bot.
            </p>
          </div>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={loading} className="w-full max-w-xs">
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="mr-2 h-4 w-4" />
        )}
        Criar instância
      </Button>
    </div>
  )
}

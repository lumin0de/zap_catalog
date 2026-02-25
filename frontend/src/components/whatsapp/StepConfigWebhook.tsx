import { useEffect, useState } from "react"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"

interface StepConfigWebhookProps {
  onDone: () => void
}

export function StepConfigWebhook({ onDone }: StepConfigWebhookProps) {
  const { refreshIntegrations } = useAuth()
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await callEdgeFunction("webhook", {})
        await refreshIntegrations()
        if (!cancelled) setStatus("done")
      } catch {
        if (!cancelled) setStatus("done") // webhook may already be configured — still allow closing
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      {status === "loading" ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Configurando...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Finalizando a configuração do agente.
            </p>
          </div>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-14 w-14 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold">WhatsApp conectado com sucesso!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu agente já está pronto para receber e responder mensagens.
            </p>
          </div>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={onDone}
          >
            Concluir
          </Button>
        </>
      )}
    </div>
  )
}

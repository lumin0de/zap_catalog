import { useState } from "react"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquare } from "lucide-react"
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

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { webhookSchema, type WebhookFormData } from "@/lib/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface StepConfigWebhookProps {
  onDone: () => void
}

export function StepConfigWebhook({ onDone }: StepConfigWebhookProps) {
  const { refreshIntegrations } = useAuth()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { webhookUrl: "" },
  })

  const onSubmit = async (data: WebhookFormData) => {
    if (!data.webhookUrl) {
      onDone()
      return
    }
    setLoading(true)
    try {
      await callEdgeFunction("webhook", { webhookUrl: data.webhookUrl })
      await refreshIntegrations()
      toast.success("Webhook configurado!")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao configurar webhook")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h3 className="text-lg font-semibold">WhatsApp conectado!</h3>
        <p className="text-sm text-muted-foreground">
          Opcionalmente, configure um webhook para receber eventos em tempo real. Você pode
          configurar depois nas configurações.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhookUrl">URL do Webhook (opcional)</Label>
          <Input
            id="webhookUrl"
            placeholder="https://sua-api.com/webhook"
            {...register("webhookUrl")}
          />
          {errors.webhookUrl && (
            <p className="text-sm text-destructive">{errors.webhookUrl.message}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
            Pular por agora
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar webhook
          </Button>
        </div>
      </form>
    </div>
  )
}

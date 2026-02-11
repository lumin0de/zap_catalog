import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { webhookSchema, type WebhookFormData } from "@/lib/validators"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Webhook } from "lucide-react"
import { toast } from "sonner"

export function WebhooksTab() {
  const { whatsapp, refreshIntegrations } = useAuth()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      webhookUrl: whatsapp?.webhook_url ?? "",
    },
  })

  const onSubmit = async (data: WebhookFormData) => {
    setLoading(true)
    try {
      await callEdgeFunction("webhook", { webhookUrl: data.webhookUrl })
      await refreshIntegrations()
      toast.success("Webhook atualizado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar webhook")
    } finally {
      setLoading(false)
    }
  }

  if (!whatsapp?.instance_token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Webhooks</CardTitle>
          <CardDescription>Configure onde os eventos do WhatsApp serão enviados</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Webhook className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Conecte o WhatsApp primeiro para configurar webhooks.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Webhooks</CardTitle>
        <CardDescription>
          Configure a URL que receberá os eventos do WhatsApp em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL do Webhook</Label>
            <Input
              id="webhookUrl"
              placeholder="https://sua-api.com/webhook"
              {...register("webhookUrl")}
            />
            {errors.webhookUrl && (
              <p className="text-sm text-destructive">{errors.webhookUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Os eventos serão enviados via POST para esta URL.
            </p>
          </div>

          {whatsapp.webhook_url && whatsapp.webhook_enabled && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              Webhook ativo: {whatsapp.webhook_url}
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar configuração
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

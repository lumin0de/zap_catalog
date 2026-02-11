import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Shield, Webhook, Layers } from "lucide-react"

const features = [
  {
    icon: MessageSquare,
    title: "Conexão em minutos",
    description:
      "Conecte seu WhatsApp em segundos escaneando um QR code. Sem configurações complexas.",
  },
  {
    icon: Shield,
    title: "Proxy seguro",
    description:
      "Todas as chamadas passam por uma edge function segura. Seus tokens nunca ficam expostos no navegador.",
  },
  {
    icon: Webhook,
    title: "Webhooks em tempo real",
    description:
      "Receba eventos de mensagens, atualizações de status e mais em tempo real via webhooks.",
  },
  {
    icon: Layers,
    title: "Multi-plataforma",
    description:
      "WhatsApp hoje, Mercado Livre amanhã. Um painel único para todas as suas integrações.",
  },
]

export function Features() {
  return (
    <section className="bg-card py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Por que ZapCatalog?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tudo que você precisa para integrar o WhatsApp ao seu negócio
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-0 shadow-sm">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

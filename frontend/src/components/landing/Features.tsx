import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Clock, MessageSquare, Package, TrendingUp, Shield } from "lucide-react"

const features = [
  {
    icon: Package,
    title: "Catálogo sincronizado",
    description:
      "Conecte sua conta do Mercado Livre e o agente aprende automaticamente seus produtos, preços, variações e disponibilidade.",
  },
  {
    icon: Bot,
    title: "Agente inteligente",
    description:
      "Responde perguntas sobre seus produtos com precisão — detalhes técnicos, prazos de entrega, formas de pagamento e mais.",
  },
  {
    icon: Clock,
    title: "Atendimento 24/7",
    description:
      "Seus clientes recebem respostas imediatas a qualquer hora do dia. Sem fila de espera, sem cliente perdido.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp nativo",
    description:
      "O cliente conversa no WhatsApp como faria com qualquer vendedor. Sem apps extras, sem fricção.",
  },
  {
    icon: TrendingUp,
    title: "Mais vendas, menos esforço",
    description:
      "Converta consultas em vendas automaticamente. O agente guia o cliente do interesse até o fechamento.",
  },
  {
    icon: Shield,
    title: "Seguro e confiável",
    description:
      "Seus dados ficam protegidos. O agente só acessa informações públicas do seu catálogo e nunca compartilha dados sensíveis.",
  },
]

export function Features() {
  return (
    <section className="bg-card py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Tudo que seu negócio precisa para vender mais
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Um agente que conhece seus produtos tão bem quanto você — e atende sem parar
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

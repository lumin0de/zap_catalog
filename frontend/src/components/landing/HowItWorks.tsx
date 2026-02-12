import { ShoppingBag, MessageSquare, Bot, Rocket } from "lucide-react"

const steps = [
  {
    icon: ShoppingBag,
    title: "Conecte seu Mercado Livre",
    description:
      "Autorize sua conta com um clique. O sistema importa seu catálogo de produtos automaticamente.",
  },
  {
    icon: MessageSquare,
    title: "Conecte seu WhatsApp",
    description:
      "Escaneie o QR Code e vincule seu número de WhatsApp em segundos.",
  },
  {
    icon: Bot,
    title: "O agente aprende seu catálogo",
    description:
      "A IA é treinada com seus produtos, preços e estoque. Pronta para responder como um vendedor especialista.",
  },
  {
    icon: Rocket,
    title: "Comece a vender",
    description:
      "Clientes enviam mensagens e recebem respostas instantâneas e precisas sobre seus produtos.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Quatro passos simples para transformar seu WhatsApp em uma máquina de vendas
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-lg font-bold">{i + 1}</span>
              </div>
              <step.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>

              {i < steps.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-0.5 w-full translate-x-1/2 bg-border md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

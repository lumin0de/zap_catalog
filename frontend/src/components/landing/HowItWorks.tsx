import { UserPlus, QrCode, Webhook } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    title: "Crie sua conta",
    description: "Cadastre-se em segundos com e-mail e senha.",
  },
  {
    icon: QrCode,
    title: "Escaneie o QR Code",
    description: "Conecte seu WhatsApp escaneando o QR code gerado automaticamente.",
  },
  {
    icon: Webhook,
    title: "Configure webhooks",
    description: "Defina a URL do webhook e comece a receber eventos em tempo real.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Três passos simples para começar
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
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

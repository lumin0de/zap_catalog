import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, ShoppingBag, Zap } from "lucide-react"

export function Hero() {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-secondary/50" />
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Para vendedores do Mercado Livre
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Seu catálogo do ML,{" "}
            <span className="text-primary">vendendo pelo WhatsApp</span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Conecte sua loja do Mercado Livre a um agente inteligente no WhatsApp.
            Ele conhece seus produtos, preços e estoque — e atende seus clientes 24 horas por dia, 7 dias por semana.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/signup")} className="gap-2">
              Começar grátis
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
              Já tenho conta
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Sincroniza com o ML</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Agente treinado com seu estoque</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Respostas instantâneas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

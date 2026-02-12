import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  const navigate = useNavigate()

  return (
    <section className="bg-primary py-24">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-primary-foreground">
          Pare de perder vendas no WhatsApp
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/80">
          Cada mensagem sem resposta é uma venda perdida. Conecte seu catálogo do Mercado Livre
          e deixe a IA atender seus clientes enquanto você foca no que importa.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate("/signup")}
            className="gap-2"
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

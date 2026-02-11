import { useAuth } from "@/contexts/AuthContext"
import { MessageSquare } from "lucide-react"

export function WelcomeBanner() {
  const { profile, whatsapp } = useAuth()

  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário"

  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">
        Olá, {firstName}!
      </h1>
      <p className="text-muted-foreground">
        {whatsapp?.is_connected ? (
          "Seu WhatsApp está conectado e funcionando."
        ) : (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            Conecte seu WhatsApp para começar a usar o ZapCatalog.
          </span>
        )}
      </p>
    </div>
  )
}

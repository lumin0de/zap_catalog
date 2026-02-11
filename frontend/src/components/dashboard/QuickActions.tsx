import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Settings, Webhook } from "lucide-react"

interface QuickActionsProps {
  onConnectWhatsApp: () => void
}

export function QuickActions({ onConnectWhatsApp }: QuickActionsProps) {
  const { whatsapp } = useAuth()
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ações rápidas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {!whatsapp?.is_connected && (
          <Button onClick={onConnectWhatsApp} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conectar WhatsApp
          </Button>
        )}
        {whatsapp?.is_connected && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/app/settings")}
          >
            <Webhook className="h-4 w-4" />
            Configurar Webhook
          </Button>
        )}
        <Button variant="outline" className="gap-2" onClick={() => navigate("/app/settings")}>
          <Settings className="h-4 w-4" />
          Configurações
        </Button>
      </CardContent>
    </Card>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner"
import { StatusCard } from "@/components/dashboard/StatusCard"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { ConnectModal } from "@/components/whatsapp/ConnectModal"
import { startMeliOAuth } from "@/lib/meli"
import { MessageSquare, ShoppingBag } from "lucide-react"

export default function DashboardPage() {
  const { whatsapp, meli } = useAuth()
  const navigate = useNavigate()
  const [connectModalOpen, setConnectModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <WelcomeBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatusCard
          title="WhatsApp"
          icon={MessageSquare}
          status={whatsapp?.is_connected ? "connected" : "disconnected"}
          details={
            whatsapp?.is_connected
              ? `Instância: ${whatsapp.instance_name}`
              : whatsapp?.instance_token
                ? "Instância criada, aguardando conexão"
                : "Nenhuma instância conectada"
          }
          actionLabel={
            whatsapp?.is_connected
              ? "Gerenciar"
              : whatsapp?.instance_token
                ? "Reconectar"
                : "Conectar"
          }
          onAction={() => setConnectModalOpen(true)}
        />
        <StatusCard
          title="Mercado Livre"
          icon={ShoppingBag}
          status={meli?.is_connected ? "connected" : "disconnected"}
          details={
            meli?.is_connected
              ? `Vendedor: ${meli.nickname}`
              : "Nenhuma conta conectada"
          }
          actionLabel={meli?.is_connected ? "Gerenciar" : "Conectar"}
          onAction={() => {
            if (meli?.is_connected) {
              navigate("/app/settings?tab=meli")
            } else {
              startMeliOAuth()
            }
          }}
        />
      </div>

      <QuickActions onConnectWhatsApp={() => setConnectModalOpen(true)} />

      <ConnectModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
    </div>
  )
}

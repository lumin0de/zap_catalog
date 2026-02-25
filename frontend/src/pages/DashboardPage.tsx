import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { ConnectModal } from "@/components/whatsapp/ConnectModal"
import { startMeliOAuth } from "@/lib/meli"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Package,
  MessageSquare,
  ShoppingBag,
  Bot,
  ArrowRight,
  Wifi,
  WifiOff,
} from "lucide-react"

interface DashboardStats {
  conversation_count: number
  catalog_count: number
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  subtitle,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  loading?: boolean
  subtitle?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function IntegrationCard({
  title,
  icon: Icon,
  iconColor,
  connected,
  detail,
  actionLabel,
  onAction,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  connected: boolean
  detail?: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${connected ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{title}</span>
              {connected ? (
                <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 text-[10px]">
                  <Wifi className="h-2.5 w-2.5" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 bg-destructive/10 text-destructive text-[10px]">
                  <WifiOff className="h-2.5 w-2.5" />
                  Desconectado
                </Badge>
              )}
            </div>
            {detail && <p className="text-xs text-muted-foreground mt-0.5 truncate">{detail}</p>}
          </div>
          <Button
            size="sm"
            variant={connected ? "outline" : "default"}
            onClick={onAction}
            className="shrink-0 gap-1"
          >
            {actionLabel}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { profile, whatsapp, meli } = useAuth()
  const navigate = useNavigate()
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário"

  useEffect(() => {
    callEdgeFunction<DashboardStats>("dashboard-stats")
      .then(setStats)
      .catch(() => setStats({ conversation_count: 0, catalog_count: 0 }))
      .finally(() => setStatsLoading(false))
  }, [])

  const waDetail = whatsapp?.is_connected
    ? whatsapp.phone_number
      ? `+${whatsapp.phone_number}`
      : "Número conectado"
    : whatsapp?.instance_token
      ? "Aguardando conexão"
      : "Nenhuma instância"

  const meliDetail = meli?.is_connected
    ? meli.nickname ?? "Conta conectada"
    : "Nenhuma conta conectada"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Olá, {firstName}!</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {whatsapp?.is_connected
            ? "Seu agente está ativo e pronto para atender clientes."
            : "Conecte o WhatsApp para começar a usar o ZapCatalog."}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Clientes atendidos"
          value={stats?.conversation_count ?? 0}
          icon={Users}
          loading={statsLoading}
          subtitle="Contatos únicos atendidos pelo agente"
        />
        <StatCard
          title="Produtos no catálogo"
          value={stats?.catalog_count ?? 0}
          icon={Package}
          loading={statsLoading}
          subtitle="Produtos sincronizados com o agente IA"
        />
      </div>

      {/* Integrations status */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Integrações</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <IntegrationCard
            title="WhatsApp"
            icon={MessageSquare}
            iconColor="text-green-600"
            connected={!!whatsapp?.is_connected}
            detail={waDetail}
            actionLabel={whatsapp?.is_connected ? "Gerenciar" : whatsapp?.instance_token ? "Reconectar" : "Conectar"}
            onAction={() => {
              if (whatsapp?.is_connected) {
                navigate("/app/integrations?tab=whatsapp")
              } else {
                setConnectModalOpen(true)
              }
            }}
          />
          <IntegrationCard
            title="Mercado Livre"
            icon={ShoppingBag}
            iconColor="text-yellow-600"
            connected={!!meli?.is_connected}
            detail={meliDetail}
            actionLabel={meli?.is_connected ? "Gerenciar" : "Conectar"}
            onAction={() => {
              if (meli?.is_connected) {
                navigate("/app/integrations?tab=meli")
              } else {
                startMeliOAuth()
              }
            }}
          />
        </div>
      </div>

      {/* Quick access */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Acesso rápido</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/app/agent")}
          >
            <Bot className="h-4 w-4" />
            Agente IA
          </Button>
          {meli?.is_connected && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate("/app/catalogo")}
            >
              <ShoppingBag className="h-4 w-4" />
              Catálogo ML
            </Button>
          )}
          {!whatsapp?.is_connected && (
            <Button className="gap-2" onClick={() => setConnectModalOpen(true)}>
              <MessageSquare className="h-4 w-4" />
              Conectar WhatsApp
            </Button>
          )}
        </div>
      </div>

      <ConnectModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
    </div>
  )
}

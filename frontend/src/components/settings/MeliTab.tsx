import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { startMeliOAuth } from "@/lib/meli"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/whatsapp/StatusBadge"
import { Loader2, ShoppingBag, Unplug } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function MeliTab() {
  const { meli, refreshIntegrations } = useAuth()
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)

  const handleDisconnect = async () => {
    setDisconnectLoading(true)
    try {
      await callEdgeFunction("meli-disconnect")
      toast.success("Mercado Livre desconectado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar")
    }
    setDisconnectLoading(false)
    setDisconnectOpen(false)
    try {
      await refreshIntegrations()
    } catch {
      // ignore refresh errors
    }
  }

  if (!meli?.is_connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integração Mercado Livre</CardTitle>
          <CardDescription>Conecte sua conta do Mercado Livre para sincronizar catálogos</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma conta conectada</p>
          <Button onClick={startMeliOAuth}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Conectar Mercado Livre
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integração Mercado Livre</CardTitle>
          <CardDescription>Gerencie sua conexão com o Mercado Livre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge connected={meli.is_connected} />
            </div>
            {meli.nickname && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vendedor</span>
                <span className="font-medium">{meli.nickname}</span>
              </div>
            )}
            {meli.seller_id && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ID do Vendedor</span>
                <span className="font-mono text-xs">{meli.seller_id}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectOpen(true)}
            >
              <Unplug className="mr-2 h-3 w-3" />
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Mercado Livre</DialogTitle>
            <DialogDescription>
              Isso irá remover a conexão com o Mercado Livre. Você precisará autorizar novamente
              para reconectar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectLoading}>
              {disconnectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

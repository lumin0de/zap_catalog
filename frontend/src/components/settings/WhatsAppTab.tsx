import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/whatsapp/StatusBadge"
import { ConnectModal } from "@/components/whatsapp/ConnectModal"
import { Loader2, MessageSquare, RefreshCw, Trash2, Unplug, Link } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function WhatsAppTab() {
  const { whatsapp, refreshIntegrations } = useAuth()
  const [connectOpen, setConnectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)

  const handleCheckStatus = async () => {
    setStatusLoading(true)
    try {
      await callEdgeFunction("status")
      await refreshIntegrations()
      toast.success("Status atualizado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao verificar status")
    } finally {
      setStatusLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnectLoading(true)
    try {
      await callEdgeFunction("disconnect")
      toast.success("WhatsApp desconectado. Você pode reconectar a qualquer momento.")
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

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await callEdgeFunction("delete")
      toast.success("Instância removida com sucesso")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover instância")
    }
    // Always close dialog and refresh, even on error
    setDeleteLoading(false)
    setDeleteOpen(false)
    try {
      await refreshIntegrations()
    } catch {
      // ignore refresh errors
    }
  }

  // No instance at all
  if (!whatsapp?.instance_token) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Integração WhatsApp</CardTitle>
            <CardDescription>Conecte seu WhatsApp para começar a receber mensagens</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
            <Button onClick={() => setConnectOpen(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Conectar WhatsApp
            </Button>
          </CardContent>
        </Card>
        <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integração WhatsApp</CardTitle>
          <CardDescription>Gerencie sua conexão com o WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge connected={whatsapp.is_connected} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Instância</span>
              <span className="font-mono text-xs">{whatsapp.instance_name}</span>
            </div>
            {whatsapp.webhook_url && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Webhook</span>
                <span className="max-w-[250px] truncate font-mono text-xs">
                  {whatsapp.webhook_url}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={statusLoading}>
              {statusLoading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Verificar status
            </Button>

            {!whatsapp.is_connected && (
              <Button size="sm" onClick={() => setConnectOpen(true)}>
                <Link className="mr-2 h-3 w-3" />
                Reconectar
              </Button>
            )}

            {whatsapp.is_connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisconnectOpen(true)}
              >
                <Unplug className="mr-2 h-3 w-3" />
                Desconectar
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Excluir instância
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect confirmation */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar WhatsApp</DialogTitle>
            <DialogDescription>
              Isso irá desconectar seu WhatsApp, mas a instância será mantida. Você poderá reconectar
              escaneando o QR code novamente sem precisar criar uma nova instância.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleDisconnect} disabled={disconnectLoading}>
              {disconnectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir instância</DialogTitle>
            <DialogDescription>
              Isso irá remover completamente a instância do WhatsApp. Você precisará criar uma nova
              instância e escanear o QR code para reconectar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}

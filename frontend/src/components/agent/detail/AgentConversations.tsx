import { useState, useEffect, useCallback } from "react"
import { callEdgeFunction } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RefreshCw, User, Bot, Inbox, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Conversation {
  id: string
  contact_phone: string
  messages: Message[]
  message_count: number
  last_interaction_at: string
  created_at: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

function formatPhone(phone: string) {
  // Brazilian format: 5511999999999 → +55 (11) 99999-9999
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4)
    const num = digits.slice(4)
    const part1 = num.slice(0, num.length - 4)
    const part2 = num.slice(-4)
    return `+55 (${ddd}) ${part1}-${part2}`
  }
  return `+${digits}`
}

export function AgentConversations({ agentId }: { agentId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await callEdgeFunction<{ conversations: Conversation[] }>(
        "list-conversations",
        { agentId },
      )
      setConversations(res.conversations ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar conversas")
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await callEdgeFunction("delete-conversation", { conversationId: deleteTarget.id })
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      if (selected?.id === deleteTarget.id) setSelected(null)
      toast.success("Conversa apagada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar conversa")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Histórico de conversas recebidas pelo agente via WhatsApp.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <div className="text-center">
            <p className="text-sm font-medium">Nenhuma conversa ainda</p>
            <p className="text-xs mt-1">
              As mensagens recebidas pelo agente aparecem aqui.
            </p>
          </div>
        </div>
      )}

      {!loading && conversations.length > 0 && (
        <div className="divide-y rounded-lg border">
          {conversations.map((conv) => {
            const lastMsg = conv.messages?.[conv.messages.length - 1]
            return (
              <div key={conv.id} className="flex w-full items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <button
                  onClick={() => setSelected(conv)}
                  className="flex flex-1 items-start gap-3 text-left min-w-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatPhone(conv.contact_phone)}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(conv.last_interaction_at)}
                      </span>
                    </div>
                    {lastMsg && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {lastMsg.role === "assistant" ? "🤖 " : "👤 "}
                        {lastMsg.content}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {conv.message_count} msg
                  </Badge>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv) }}
                  className="ml-1 shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 [div:hover>&]:opacity-100"
                  title="Apagar conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Conversation detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">
              {selected ? formatPhone(selected.contact_phone) : ""}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {selected?.message_count ?? 0} mensagens · iniciado em{" "}
              {selected ? new Date(selected.created_at).toLocaleDateString("pt-BR") : ""}
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {selected?.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "assistant" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.role === "assistant" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                </div>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa com {deleteTarget ? formatPhone(deleteTarget.contact_phone) : ""} será apagada permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

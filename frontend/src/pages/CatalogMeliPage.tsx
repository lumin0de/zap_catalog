import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ShoppingBag, RefreshCw, ExternalLink, PackageOpen, Bot, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface Agent { id: string; name: string; is_active: boolean }

interface MeliItem {
  id: string
  title: string
  price: number
  currency_id: string
  available_quantity: number
  sold_quantity: number
  status: "active" | "paused" | "closed" | "under_review" | string
  thumbnail: string | null
  permalink: string | null
  condition: "new" | "used" | string
}

interface MeliItemsResponse {
  items: MeliItem[]
  total: number
  offset: number
  limit: number
}

const PAGE_SIZE = 50

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  closed: "Encerrado",
  under_review: "Em revisão",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  paused: "secondary",
  closed: "destructive",
  under_review: "outline",
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : currency,
    minimumFractionDigits: 2,
  }).format(price)
}

export default function CatalogMeliPage() {
  const { meli } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<MeliItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ items: number; time: string } | null>(null)

  const handleSyncToAgent = useCallback(async () => {
    setSyncing(true)
    try {
      // Get first active agent
      const agentsRes = await callEdgeFunction<{ agents: Agent[] }>("list-agents")
      const activeAgent = agentsRes.agents.find((a) => a.is_active)
      if (!activeAgent) {
        toast.error("Nenhum agente ativo encontrado. Crie um agente primeiro.")
        return
      }
      const res = await callEdgeFunction<{ success: boolean; items_synced: number }>(
        "meli-sync-catalog",
        { agentId: activeAgent.id },
      )
      if (res.success) {
        setLastSyncResult({ items: res.items_synced, time: new Date().toLocaleTimeString("pt-BR") })
        toast.success(`Catálogo sincronizado! ${res.items_synced} produtos enviados para o agente "${activeAgent.name}".`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar catálogo")
    } finally {
      setSyncing(false)
    }
  }, [])

  const fetchItems = useCallback(async (currentOffset: number, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await callEdgeFunction<MeliItemsResponse>("meli-items", {
        limit: PAGE_SIZE,
        offset: currentOffset,
      })
      if (append) {
        setItems((prev) => [...prev, ...res.items])
      } else {
        setItems(res.items)
      }
      setTotal(res.total)
      setOffset(currentOffset + res.items.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar itens")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (meli?.is_connected) {
      fetchItems(0)
    }
  }, [meli?.is_connected, fetchItems])

  if (!meli?.is_connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Nenhuma conta do Mercado Livre conectada</p>
        <p className="text-sm text-muted-foreground">Conecte sua conta nas configurações para ver seu catálogo.</p>
        <Button onClick={() => navigate("/app/integrations?tab=meli")}>
          Conectar Mercado Livre
        </Button>
      </div>
    )
  }

  const filteredItems =
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter)

  const hasMore = offset < total

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo Mercado Livre</h1>
          <p className="text-sm text-muted-foreground">
            {meli.nickname && <span className="font-medium">{meli.nickname}</span>}
            {total > 0 && <span> · {total} {total === 1 ? "item" : "itens"}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setOffset(0); fetchItems(0) }}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Sync to agent banner */}
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Sincronizar catálogo com o Agente IA</p>
            <p className="text-xs text-muted-foreground">
              O agente usará os produtos ativos para responder clientes no WhatsApp.
              {lastSyncResult && (
                <span className="ml-1 inline-flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  {lastSyncResult.items} produtos · às {lastSyncResult.time}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleSyncToAgent} disabled={syncing || loading}>
          {syncing
            ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            : <Bot className="mr-2 h-4 w-4" />}
          {syncing ? "Sincronizando..." : "Sincronizar no Agente"}
        </Button>
      </div>

      {/* Status filter chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", "active", "paused", "closed", "under_review"].map((s) => {
            const count =
              s === "all" ? items.length : items.filter((i) => i.status === s).length
            if (s !== "all" && count === 0) return null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {s === "all" ? "Todos" : STATUS_LABEL[s] ?? s} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="mb-3 h-28 w-full rounded-md" />
                <Skeleton className="mb-1 h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Items grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                {item.thumbnail ? (
                  <div className="flex min-h-24 max-h-32 w-full items-center justify-center bg-muted p-2">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="max-h-28 w-auto max-w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-muted">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <p className="line-clamp-2 text-xs font-medium leading-snug" title={item.title}>
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-primary">
                      {formatPrice(item.price, item.currency_id)}
                    </span>
                    <Badge
                      variant={STATUS_VARIANT[item.status] ?? "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Estoque: {item.available_quantity}</span>
                    <span>Vendidos: {item.sold_quantity ?? 0}</span>
                  </div>
                  {item.permalink && (
                    <a
                      href={item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver no ML
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <PackageOpen className="h-10 w-10" />
          <p className="text-sm">
            {statusFilter === "all"
              ? "Nenhum item encontrado no seu catálogo."
              : `Nenhum item com status "${STATUS_LABEL[statusFilter] ?? statusFilter}".`}
          </p>
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && statusFilter === "all" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchItems(offset, true)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Carregar mais ({total - offset} restantes)
          </Button>
        </div>
      )}
    </div>
  )
}

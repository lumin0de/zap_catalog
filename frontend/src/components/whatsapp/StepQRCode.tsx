import { useState, useEffect, useRef, useCallback } from "react"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import type { ConnectResponse, StatusResponse } from "@/types/api"

const QR_TIMEOUT_MS = 120_000 // 2 minutes per UAZAPI docs
const STATUS_POLL_MS = 4_000

interface StepQRCodeProps {
  onNext: () => void
}

export function StepQRCode({ onNext }: StepQRCodeProps) {
  const { refreshIntegrations } = useAuth()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [expired, setExpired] = useState(false)

  // Use refs to avoid dependency issues in callbacks
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
  const refreshRef = useRef(refreshIntegrations)
  refreshRef.current = refreshIntegrations
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const fetchIdRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const handleConnected = useCallback(async () => {
    stopPolling()
    setConnected(true)
    try {
      await refreshRef.current()
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (mountedRef.current) {
        onNextRef.current()
      }
    }, 2000)
  }, [stopPolling])

  const fetchQRCode = useCallback(async () => {
    // Increment fetch ID to invalidate any in-flight request from a previous call
    const currentFetchId = ++fetchIdRef.current
    stopPolling()
    setLoading(true)
    setError(null)
    setQrCode(null)
    setExpired(false)

    try {
      const res = await callEdgeFunction<ConnectResponse>("connect")

      // Ignore response if component unmounted or a newer fetch was triggered
      if (!mountedRef.current || fetchIdRef.current !== currentFetchId) return

      // If already connected, skip QR code
      if (res.connected) {
        await handleConnected()
        return
      }

      if (res.qrcode) {
        setQrCode(res.qrcode)
        setSecondsLeft(Math.floor(QR_TIMEOUT_MS / 1000))

        // Start countdown timer
        const start = Date.now()
        countdownRef.current = setInterval(() => {
          if (!mountedRef.current) return
          const elapsed = Date.now() - start
          const remaining = Math.max(0, Math.ceil((QR_TIMEOUT_MS - elapsed) / 1000))
          setSecondsLeft(remaining)
          if (remaining <= 0) {
            setExpired(true)
            setQrCode(null)
            stopPolling()
          }
        }, 1000)

        // Start status polling
        pollingRef.current = setInterval(async () => {
          try {
            const status = await callEdgeFunction<StatusResponse>("status")
            if (status.connected && mountedRef.current) {
              await handleConnected()
            }
          } catch {
            // silently ignore status check errors
          }
        }, STATUS_POLL_MS)
      } else {
        setError("QR Code vazio. Tente novamente.")
      }
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : "Erro ao gerar QR code"
      setError(msg)
      toast.error(msg)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [stopPolling, handleConnected])

  // Fetch QR code once on mount
  useEffect(() => {
    mountedRef.current = true
    fetchQRCode()
    return () => {
      mountedRef.current = false
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (connected) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h3 className="text-lg font-semibold">WhatsApp conectado!</h3>
        <p className="text-sm text-muted-foreground">
          Redirecionando...
        </p>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">QR Code expirado</h3>
          <p className="text-sm text-muted-foreground">
            O tempo de 2 minutos para escanear foi atingido. Gere um novo QR Code.
          </p>
        </div>

        <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-muted/30">
          <div className="flex flex-col items-center gap-2">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Expirado</p>
          </div>
        </div>

        <Button onClick={fetchQRCode} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Gerar novo QR Code
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Escaneie o QR Code</h3>
        <p className="text-sm text-muted-foreground">
          Abra o WhatsApp &rarr; Aparelhos conectados &rarr; Conectar aparelho
        </p>
      </div>

      <div className="relative flex h-64 w-64 items-center justify-center rounded-lg border bg-white">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
          </div>
        ) : qrCode ? (
          <img src={qrCode} alt="QR Code WhatsApp" className="h-56 w-56" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error || "Erro ao carregar QR Code"}</p>
          </div>
        )}
      </div>

      {!loading && qrCode && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Aguardando leitura do QR Code...
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            Expira em {formatTime(secondsLeft)}
          </span>
        </div>
      )}

      {(error || (!loading && !qrCode)) && (
        <Button variant="outline" size="sm" onClick={fetchQRCode} disabled={loading}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Tentar novamente
        </Button>
      )}

      {!loading && qrCode && (
        <Button variant="ghost" size="sm" onClick={fetchQRCode} disabled={loading}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Gerar novo QR Code
        </Button>
      )}
    </div>
  )
}

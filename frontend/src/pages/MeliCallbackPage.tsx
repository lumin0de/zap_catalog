import { useEffect, useRef, useState } from "react"
import { useSearchParams, useNavigate } from "react-router"
import { callEdgeFunction } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { validateMeliOAuthState } from "@/lib/meli"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MeliCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshIntegrations } = useAuth()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const code = searchParams.get("code")
    const state = searchParams.get("state")

    if (!code) {
      setStatus("error")
      setErrorMsg("Código de autorização não encontrado na URL.")
      return
    }

    if (!validateMeliOAuthState(state)) {
      setStatus("error")
      setErrorMsg("Validação de segurança falhou. Tente conectar novamente.")
      return
    }

    const exchange = async () => {
      try {
        await callEdgeFunction("meli-exchange", { code })
        await refreshIntegrations()
        setStatus("success")
        setTimeout(() => navigate("/app/settings?tab=meli", { replace: true }), 2000)
      } catch (err) {
        setStatus("error")
        setErrorMsg(err instanceof Error ? err.message : "Erro ao conectar com o Mercado Livre")
      }
    }

    exchange()
  }, [searchParams, navigate, refreshIntegrations])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Conectando ao Mercado Livre...</p>
        <p className="text-sm text-muted-foreground">Trocando código de autorização por tokens</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <p className="text-lg font-semibold">Mercado Livre conectado!</p>
        <p className="text-sm text-muted-foreground">Redirecionando para configurações...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-lg font-semibold">Erro ao conectar</p>
      <p className="text-sm text-muted-foreground">{errorMsg}</p>
      <Button onClick={() => navigate("/app/settings?tab=meli", { replace: true })}>
        Voltar para configurações
      </Button>
    </div>
  )
}

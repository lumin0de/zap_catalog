import { Outlet } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

export function AppLayout() {
  const { loadError, retryLoadUserData } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {loadError === "unavailable" && (
          <div className="flex items-center justify-between gap-4 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
            <span className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Serviço temporariamente indisponível. Tente novamente em alguns segundos.
            </span>
            <Button variant="outline" size="sm" onClick={retryLoadUserData}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Tentar novamente
            </Button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

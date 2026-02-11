import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { Loader2 } from "lucide-react"

export function ProtectedRoute() {
  const { session, initialized, loading } = useAuth()

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

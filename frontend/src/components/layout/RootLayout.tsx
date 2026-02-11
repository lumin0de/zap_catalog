import { Outlet } from "react-router"
import { AuthProvider } from "@/contexts/AuthContext"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function RootLayout() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </AuthProvider>
  )
}

import { Link, Outlet, useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { Logo } from "@/components/common/Logo"
import { Button } from "@/components/ui/button"
import { Footer } from "./Footer"

export function PublicLayout() {
  const { session } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <Button onClick={() => navigate("/app")}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")}>
                  Entrar
                </Button>
                <Button onClick={() => navigate("/signup")}>Começar grátis</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

import { NavLink } from "react-router"
import { LayoutDashboard, Settings, Bot, ShoppingBag, Plug } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/common/Logo"
import { useAuth } from "@/contexts/AuthContext"

export function Sidebar() {
  const { meli } = useAuth()

  const navItems = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/agent", label: "Agente IA", icon: Bot, end: false },
    ...(meli?.is_connected
      ? [{ to: "/app/catalogo", label: "Catálogo ML", icon: ShoppingBag, end: false }]
      : []),
    { to: "/app/integrations", label: "Integrações", icon: Plug, end: false },
    { to: "/app/settings", label: "Configurações", icon: Settings, end: false },
  ]

  return (
    <aside className="hidden w-60 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-16 items-center border-b px-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

import { NavLink } from "react-router"
import { LayoutDashboard, Settings, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/common/Logo"

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/agent/new", label: "Agente IA", icon: Bot, end: false },
  { to: "/app/settings", label: "Configurações", icon: Settings, end: false },
]

export function Sidebar() {
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

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  connected: boolean
  className?: string
}

export function StatusBadge({ connected, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5",
        connected
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
          : "bg-red-100 text-red-800 hover:bg-red-100",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          connected ? "bg-emerald-500" : "bg-red-500",
        )}
      />
      {connected ? "Conectado" : "Desconectado"}
    </Badge>
  )
}

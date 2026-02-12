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
          ? "bg-accent text-accent-foreground hover:bg-accent"
          : "bg-destructive/15 text-destructive hover:bg-destructive/15",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          connected ? "bg-primary" : "bg-destructive",
        )}
      />
      {connected ? "Conectado" : "Desconectado"}
    </Badge>
  )
}

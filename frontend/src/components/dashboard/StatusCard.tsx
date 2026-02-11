import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusCardProps {
  title: string
  icon: LucideIcon
  status: "connected" | "disconnected" | "coming-soon"
  details?: string
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
}

export function StatusCard({
  title,
  icon: Icon,
  status,
  details,
  actionLabel,
  onAction,
  disabled,
}: StatusCardProps) {
  return (
    <Card className={cn(disabled && "opacity-60")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <Badge
              variant="secondary"
              className="gap-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Conectado
            </Badge>
          )}
          {status === "disconnected" && (
            <Badge
              variant="secondary"
              className="gap-1.5 bg-red-100 text-red-800 hover:bg-red-100"
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Desconectado
            </Badge>
          )}
          {status === "coming-soon" && (
            <Badge variant="secondary" className="gap-1.5">
              Em breve
            </Badge>
          )}
        </div>
        {details && <p className="text-sm text-muted-foreground">{details}</p>}
        {actionLabel && (
          <Button
            size="sm"
            variant={status === "connected" ? "outline" : "default"}
            onClick={onAction}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

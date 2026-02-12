import { useEffect } from "react"
import { useNavigate } from "react-router"
import { GraduationCap, MessageSquare, Settings, ArrowRight, Bot } from "lucide-react"
import confetti from "canvas-confetti"
import { cn } from "@/lib/utils"

interface StepCelebrationProps {
  agentName: string
  agentId: string
}

const actions = [
  {
    label: "Fazer treinamentos",
    description: "Ensine seu agente com conteudos personalizados",
    icon: GraduationCap,
    color: "bg-purple-100 text-purple-600",
    getPath: (id: string) => `/app/agent/${id}?tab=treinamentos`,
  },
  {
    label: "Conectar canais",
    description: "Conecte o WhatsApp para comecar a atender",
    icon: MessageSquare,
    color: "bg-green-100 text-green-600",
    getPath: () => "/app/settings",
  },
  {
    label: "Ajustar configuracoes",
    description: "Personalize o comportamento do agente",
    icon: Settings,
    color: "bg-orange-100 text-orange-600",
    getPath: (id: string) => `/app/agent/${id}?tab=configuracoes`,
  },
]

export function StepCelebration({ agentName, agentId }: StepCelebrationProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ["#644a40", "#ffdfb5", "#e54d2e", "#2e7d32", "#1976d2"],
      })
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ["#644a40", "#ffdfb5", "#e54d2e", "#2e7d32", "#1976d2"],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
          <Bot className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white text-lg">
          *
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Boas vindas a {agentName}!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu agente foi criado com sucesso, o que deseja fazer?
        </p>
      </div>

      <div className="w-full space-y-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.getPath(agentId))}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
                "hover:border-primary/40 hover:shadow-sm cursor-pointer",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                  action.color,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

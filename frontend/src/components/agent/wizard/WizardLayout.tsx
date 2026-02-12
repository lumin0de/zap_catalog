import { X, Check } from "lucide-react"
import { useNavigate } from "react-router"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const stepLabels = ["Nome", "Objetivo", "Empresa", "Ajustes", "Pronto!"]

interface WizardLayoutProps {
  currentStep: number
  children: React.ReactNode
}

export function WizardLayout({ currentStep, children }: WizardLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Criar Agente
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/app")}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 px-4 py-6">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                  i < currentStep
                    ? "bg-primary text-primary-foreground scale-90"
                    : i === currentStep
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  i <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <div
                className={cn(
                  "mb-5 h-0.5 w-8 rounded-full transition-colors duration-300",
                  i < currentStep ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-400">
          {children}
        </div>
      </div>
    </div>
  )
}

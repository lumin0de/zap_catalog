import { useState } from "react"
import { Headphones, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AgentObjective, AgentWizardData } from "@/types/agent"

interface StepObjectiveProps {
  data: AgentWizardData
  onUpdate: (partial: Partial<AgentWizardData>) => void
  onNext: () => void
}

const objectives: {
  value: AgentObjective
  label: string
  description: string
  icon: React.ElementType
}[] = [
  {
    value: "suporte",
    label: "Suporte",
    description: "Atendimento e suporte ao cliente",
    icon: Headphones,
  },
  {
    value: "vendas",
    label: "Vendas",
    description: "Vender produtos e servicos",
    icon: ShoppingBag,
  },
  {
    value: "pessoal",
    label: "Uso Pessoal",
    description: "Assistente pessoal para uso geral",
    icon: User,
  },
]

export function StepObjective({ data, onUpdate, onNext }: StepObjectiveProps) {
  const [selected, setSelected] = useState<AgentObjective | null>(
    data.objective,
  )

  const handleSelect = (value: AgentObjective) => {
    setSelected(value)
    onUpdate({ objective: value })
  }

  const handleContinue = () => {
    if (selected) onNext()
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Qual sera o objetivo de {data.name}?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isso ajuda a personalizar o comportamento do agente
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3">
        {objectives.map((obj) => {
          const Icon = obj.icon
          const isSelected = selected === obj.value
          return (
            <button
              key={obj.value}
              type="button"
              onClick={() => handleSelect(obj.value)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                  isSelected ? "bg-primary/15" : "bg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "h-7 w-7 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "font-semibold",
                    isSelected ? "text-primary" : "text-foreground",
                  )}
                >
                  {obj.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {obj.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full max-w-sm h-11"
      >
        Continuar
      </Button>
    </div>
  )
}

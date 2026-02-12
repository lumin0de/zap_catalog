import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { agentNameSchema, type AgentNameFormData } from "@/lib/agent-validators"
import type { AgentWizardData } from "@/types/agent"

interface StepNameProps {
  data: AgentWizardData
  onUpdate: (partial: Partial<AgentWizardData>) => void
  onNext: () => void
}

export function StepName({ data, onUpdate, onNext }: StepNameProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AgentNameFormData>({
    resolver: zodResolver(agentNameSchema),
    defaultValues: { name: data.name },
    mode: "onChange",
  })

  const onSubmit = (formData: AgentNameFormData) => {
    onUpdate({ name: formData.name })
    onNext()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col items-center gap-6 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-10 w-10 text-primary animate-pulse" />
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Como vamos chamar seu agente?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha um nome que combine com a personalidade do seu negocio
        </p>
      </div>

      <div className="w-full max-w-sm">
        <Input
          {...register("name")}
          placeholder="Ex: Luna, Carlos, Atena..."
          className="text-center text-lg h-12"
          autoFocus
        />
        {errors.name && (
          <p className="mt-1.5 text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={!isValid} className="w-full max-w-sm h-11">
        Continuar
      </Button>
    </form>
  )
}

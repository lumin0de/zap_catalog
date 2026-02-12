import { useState } from "react"
import { FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { AgentWizardData } from "@/types/agent"

interface StepCompanyDescriptionProps {
  data: AgentWizardData
  onUpdate: (partial: Partial<AgentWizardData>) => void
  onNext: () => void
}

const MAX_CHARS = 500

export function StepCompanyDescription({
  data,
  onUpdate,
  onNext,
}: StepCompanyDescriptionProps) {
  const [description, setDescription] = useState(data.companyDescription)

  const handleChange = (value: string) => {
    if (value.length <= MAX_CHARS) {
      setDescription(value)
      onUpdate({ companyDescription: value })
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <FileText className="h-10 w-10 text-primary" />
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Onde {data.name} vai trabalhar?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Forneca uma breve descricao sobre sua empresa para que{" "}
          <span className="font-medium text-foreground">{data.name}</span>{" "}
          entenda o contexto
        </p>
      </div>

      <div className="w-full">
        <Textarea
          value={description}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Ex. A empresa X fornece solucoes tecnologicas para lojistas de todo o comercio. Inaugurada em 2003, hoje nosso produto conta com mais de 2 mil licencas.`}
          rows={5}
          className="resize-none text-sm"
          autoFocus
        />
        <p className="mt-1.5 text-right text-xs text-muted-foreground">
          {description.length}/{MAX_CHARS}
        </p>
      </div>

      <Button onClick={onNext} className="w-full max-w-sm h-11">
        Continuar
      </Button>
    </div>
  )
}

import { useState } from "react"
import { WizardLayout } from "@/components/agent/wizard/WizardLayout"
import { StepName } from "@/components/agent/wizard/StepName"
import { StepObjective } from "@/components/agent/wizard/StepObjective"
import { StepCompanyDescription } from "@/components/agent/wizard/StepCompanyDescription"
import { StepConfigFlags } from "@/components/agent/wizard/StepConfigFlags"
import { StepCelebration } from "@/components/agent/wizard/StepCelebration"
import type { Agent, AgentWizardData } from "@/types/agent"

export default function AgentWizardPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null)
  const [wizardData, setWizardData] = useState<AgentWizardData>({
    name: "",
    objective: null,
    companyDescription: "",
    transferToHuman: true,
    useEmojis: false,
    restrictTopics: false,
    splitResponses: false,
  })

  const handleUpdate = (partial: Partial<AgentWizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }))
  }

  const handleAgentCreated = (agent: Agent) => {
    setCreatedAgent(agent)
    setCurrentStep(4)
  }

  return (
    <WizardLayout currentStep={currentStep}>
      {currentStep === 0 && (
        <StepName
          data={wizardData}
          onUpdate={handleUpdate}
          onNext={() => setCurrentStep(1)}
        />
      )}
      {currentStep === 1 && (
        <StepObjective
          data={wizardData}
          onUpdate={handleUpdate}
          onNext={() => setCurrentStep(2)}
        />
      )}
      {currentStep === 2 && (
        <StepCompanyDescription
          data={wizardData}
          onUpdate={handleUpdate}
          onNext={() => setCurrentStep(3)}
        />
      )}
      {currentStep === 3 && (
        <StepConfigFlags
          data={wizardData}
          onUpdate={handleUpdate}
          onDone={handleAgentCreated}
        />
      )}
      {currentStep === 4 && createdAgent && (
        <StepCelebration
          agentName={createdAgent.name}
          agentId={createdAgent.id}
        />
      )}
    </WizardLayout>
  )
}

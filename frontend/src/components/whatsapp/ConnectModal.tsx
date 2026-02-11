import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StepCreateInstance } from "./StepCreateInstance"
import { StepQRCode } from "./StepQRCode"
import { StepConfigWebhook } from "./StepConfigWebhook"
import { cn } from "@/lib/utils"

interface ConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const steps = ["Criar instância", "QR Code", "Webhook"]

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
  const { whatsapp } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const wasOpenRef = useRef(false)

  // Only calculate the initial step when the modal OPENS (closed → open transition)
  // Do NOT recalculate when whatsapp state changes during the wizard
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Modal just opened - determine starting step
      if (!whatsapp?.instance_token) {
        setCurrentStep(0) // No instance → create
      } else if (!whatsapp.is_connected) {
        setCurrentStep(1) // Has instance, not connected → QR code
      } else {
        setCurrentStep(2) // Connected → webhook
      }
    }
    wasOpenRef.current = open
  }, [open, whatsapp?.instance_token, whatsapp?.is_connected])

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    i < currentStep
                      ? "bg-primary text-primary-foreground"
                      : i === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i < currentStep ? "\u2713" : i + 1}
                </div>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "mb-4 h-0.5 w-8 transition-colors",
                    i < currentStep ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {currentStep === 0 && <StepCreateInstance onNext={() => setCurrentStep(1)} />}
        {currentStep === 1 && <StepQRCode onNext={() => setCurrentStep(2)} />}
        {currentStep === 2 && <StepConfigWebhook onDone={handleClose} />}
      </DialogContent>
    </Dialog>
  )
}

import { z } from "zod"

export const agentNameSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome muito longo"),
})

export const companyDescriptionSchema = z.object({
  companyDescription: z.string().max(500, "Maximo de 500 caracteres"),
})

export const trainingItemSchema = z.object({
  type: z.enum(["texto", "website", "video", "documento"]),
  title: z.string().min(1, "Titulo obrigatorio").max(100),
  content: z.string().min(1, "Conteudo obrigatorio").max(1028),
})

export type AgentNameFormData = z.infer<typeof agentNameSchema>
export type CompanyDescriptionFormData = z.infer<typeof companyDescriptionSchema>
export type TrainingItemFormData = z.infer<typeof trainingItemSchema>

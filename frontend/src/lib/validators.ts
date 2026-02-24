import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
})

export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "A nova senha deve ser diferente da senha atual",
    path: ["newPassword"],
  })

export const profileSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  companyName: z.string().optional(),
})

export const webhookSchema = z.object({
  webhookUrl: z.string().url("URL inválida").or(z.literal("")),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
export type ProfileFormData = z.infer<typeof profileSchema>
export type WebhookFormData = z.infer<typeof webhookSchema>

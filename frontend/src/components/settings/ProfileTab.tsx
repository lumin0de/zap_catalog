import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import {
  profileSchema,
  changePasswordSchema,
  type ProfileFormData,
  type ChangePasswordFormData,
} from "@/lib/validators"
import { supabase } from "@/config/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    if (!user?.email) return
    setPwLoading(true)
    try {
      // Verify current password by re-authenticating
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: data.currentPassword,
      })
      if (authError) {
        toast.error("Senha atual incorreta")
        return
      }
      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      })
      if (updateError) throw updateError
      toast.success("Senha alterada com sucesso!")
      resetPw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha")
    } finally {
      setPwLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? "",
      companyName: profile?.company_name ?? "",
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true)
    try {
      await callEdgeFunction("update-profile", {
        fullName: data.fullName,
        companyName: data.companyName ?? "",
      })
      await refreshProfile()
      toast.success("Perfil atualizado!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações do perfil</CardTitle>
          <CardDescription>Atualize seu nome e informações da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" {...register("fullName")} />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Empresa</Label>
              <Input id="companyName" placeholder="Nome da empresa" {...register("companyName")} />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado por aqui.
              </p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Para sua segurança, confirme a senha atual antes de definir uma nova</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitPw(onSubmitPassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  {...registerPw("currentPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.currentPassword && (
                <p className="text-sm text-destructive">{pwErrors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  {...registerPw("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.newPassword && (
                <p className="text-sm text-destructive">{pwErrors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  {...registerPw("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.confirmPassword && (
                <p className="text-sm text-destructive">{pwErrors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={pwLoading}>
              {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Membro desde{" "}
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/contexts/AuthContext"
import { callEdgeFunction } from "@/lib/api"
import { profileSchema, type ProfileFormData } from "@/lib/validators"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)

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

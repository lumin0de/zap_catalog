import { ProfileTab } from "@/components/settings/ProfileTab"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e sua conta.</p>
      </div>

      <ProfileTab />
    </div>
  )
}

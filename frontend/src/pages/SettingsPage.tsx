import { useSearchParams } from "react-router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileTab } from "@/components/settings/ProfileTab"
import { WhatsAppTab } from "@/components/settings/WhatsAppTab"
import { MeliTab } from "@/components/settings/MeliTab"
import { WebhooksTab } from "@/components/settings/WebhooksTab"
import { User, MessageSquare, ShoppingBag, Webhook } from "lucide-react"

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get("tab") || "profile"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta e integrações.</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="meli" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Mercado Livre
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>
        <TabsContent value="meli">
          <MeliTab />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

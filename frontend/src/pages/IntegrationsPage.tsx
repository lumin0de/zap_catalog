import { useSearchParams } from "react-router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsAppTab } from "@/components/settings/WhatsAppTab"
import { MeliTab } from "@/components/settings/MeliTab"

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function MercadoLivreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0C5.374 0 0 5.374 0 12s5.374 12 12 12 12-5.374 12-12S18.626 0 12 0zm-.002 3.6c1.88 0 3.534.768 4.754 2l-4.754 4.754L7.245 5.6A6.67 6.67 0 0111.998 3.6zm6.802 6.8l-6.8 6.8-6.802-6.8A6.635 6.635 0 015.6 12c0 3.535 2.864 6.4 6.4 6.4 3.535 0 6.4-2.865 6.4-6.4 0-.927-.196-1.807-.544-2.6z" />
    </svg>
  )
}

export default function IntegrationsPage() {
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get("tab") || "whatsapp"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">Gerencie suas conexões com WhatsApp e Mercado Livre.</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-2">
            <WhatsAppIcon className="h-4 w-4 text-green-600" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="meli" className="gap-2">
            <MercadoLivreIcon className="h-4 w-4 text-yellow-500" />
            Mercado Livre
          </TabsTrigger>
        </TabsList>
        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>
        <TabsContent value="meli">
          <MeliTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

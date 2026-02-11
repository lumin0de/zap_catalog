import { Logo } from "@/components/common/Logo"

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Logo size="sm" />
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ZapCatalog. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

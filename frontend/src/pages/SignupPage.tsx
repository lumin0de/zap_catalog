import { Link, Navigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { SignupForm } from "@/components/auth/SignupForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/common/Logo"

export default function SignupPage() {
  const { session } = useAuth()

  if (session) return <Navigate to="/app" replace />

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <CardTitle className="text-2xl">Criar sua conta</CardTitle>
          <CardDescription>Comece a integrar seu WhatsApp em minutos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignupForm />
          <div className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

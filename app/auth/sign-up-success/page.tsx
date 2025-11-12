import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conta Criada!</CardTitle>
          <CardDescription>Sua conta foi criada com sucesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">
            Um email de confirmação foi enviado para você. Por favor, confirme seu email antes de fazer login.
          </p>
          <Link href="/auth/login" className="block">
            <Button className="w-full">Ir para Login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

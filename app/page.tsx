import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Controle Financeiro</h1>
          <p className="text-slate-300">Gerencie suas finanças de forma simples e inteligente</p>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-lg space-y-4">
          <p className="text-slate-300 text-sm">
            Acompanhe suas receitas, despesas e crie gráficos para visualizar melhor suas finanças.
          </p>
          <div className="space-y-3">
            <Link href="/auth/sign-up" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Criar Conta</Button>
            </Link>
            <Link href="/auth/login" className="block">
              <Button variant="outline" className="w-full bg-transparent">
                Fazer Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

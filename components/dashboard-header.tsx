"use client"

import type { User } from "@supabase/supabase-js"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { BarChart3, LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function DashboardHeader({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Controle Financeiro</h1>
            <p className="text-xs text-muted-foreground">Painel inteligente de gastos</p>
          </div>
        </Link>
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-border"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <span className="hidden sm:inline text-sm text-muted-foreground">{user.email}</span>
          <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2 rounded-full bg-transparent">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardOverview } from "@/components/dashboard-overview"
import { TransactionsList } from "@/components/transactions-list"
import { FixedTransactions } from "@/components/fixed-transactions"
import { AdvancedAnalytics } from "@/components/advanced-analytics"
import { CardsDashboard } from "@/components/cards-dashboard"
import { SavingsAnalytics } from "@/components/savings-analytics"
import { InvestmentsDashboard } from "@/components/investments-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader user={data.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-10">
          <DashboardOverview userId={data.user.id} />

          <Tabs defaultValue="transactions" className="w-full">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <TabsList className="flex w-full gap-2 rounded-full bg-muted/50 p-1 md:grid md:grid-cols-6 md:gap-0">
                  <TabsTrigger value="transactions" className="flex-1 whitespace-nowrap">
                    Transações
                  </TabsTrigger>
                  <TabsTrigger value="fixed" className="flex-1 whitespace-nowrap">
                    Receitas/Despesas Fixas
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex-1 whitespace-nowrap">
                    Análises
                  </TabsTrigger>
                  <TabsTrigger value="savings" className="flex-1 whitespace-nowrap">
                    Poupança
                  </TabsTrigger>
                  <TabsTrigger value="cards" className="flex-1 whitespace-nowrap">
                    Cartões
                  </TabsTrigger>
                  <TabsTrigger value="investments" className="flex-1 whitespace-nowrap">
                    Investimentos
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="transactions" className="space-y-4">
              <TransactionsList userId={data.user.id} />
            </TabsContent>

            <TabsContent value="fixed" className="space-y-4">
              <FixedTransactions userId={data.user.id} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <AdvancedAnalytics userId={data.user.id} />
            </TabsContent>

            <TabsContent value="savings" className="space-y-4">
              <SavingsAnalytics userId={data.user.id} />
            </TabsContent>

            <TabsContent value="cards" className="space-y-4">
              <CardsDashboard userId={data.user.id} />
            </TabsContent>

            <TabsContent value="investments" className="space-y-4">
              <InvestmentsDashboard userId={data.user.id} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

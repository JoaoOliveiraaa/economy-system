"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PeriodFilter } from "@/components/period-filter" // Assuming PeriodFilter is imported from this path
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface Transaction {
  id: string
  type: "income" | "expense"
  category: string
  amount: number
  transaction_date: string
  card_id: string | null
}

interface Investment {
  id: string
  name: string
  amount: number
  expected_return: number
  start_date: string
  category: string
}

export function AdvancedAnalytics({ userId }: { userId: string }) {
  const [monthlyData, setMonthlyData] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [cardData, setCardData] = useState([])
  const [investmentData, setInvestmentData] = useState([])
  const [investmentSummary, setInvestmentSummary] = useState({ total: 0, projected: 0, averageReturn: 0 })
  const [recurringSummary, setRecurringSummary] = useState({ income: 0, expense: 0 })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("1y") // Added period filter state

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: allTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: true })

      const { data: cards } = await supabase
        .from("cards")
        .select("id, nickname, brand")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })

      const { data: recurringTransactions } = await supabase
        .from("recurring_transactions")
        .select("type, amount, category, active")
        .eq("user_id", userId)
        .eq("active", true)

      const { data: investments } = await supabase
        .from("investments")
        .select("id, name, amount, expected_return, start_date, category")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })

      if (allTransactions) {
        const now = new Date()
        const transactionsUpToToday = allTransactions.filter((t) => new Date(t.transaction_date) <= now)

        let startDate = new Date()

        if (period === "3m") startDate.setMonth(now.getMonth() - 3)
        else if (period === "6m") startDate.setMonth(now.getMonth() - 6)
        else if (period === "1y") startDate.setFullYear(now.getFullYear() - 1)
        else if (period === "2y") startDate.setFullYear(now.getFullYear() - 2)
        else startDate = new Date("2000-01-01")

        const filtered = transactionsUpToToday.filter((t) => new Date(t.transaction_date) >= startDate)

        const monthlyMap = new Map()
        filtered.forEach((tx: Transaction) => {
          const month = tx.transaction_date.substring(0, 7)
          if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expense: 0 })
          }
          const data = monthlyMap.get(month)
          if (tx.type === "income") {
            data.income += Number.parseFloat(tx.amount.toString())
          } else {
            data.expense += Number.parseFloat(tx.amount.toString())
          }
        })

        const recurringIncome =
          recurringTransactions
            ?.filter((rt) => rt.type === "income")
            .reduce((sum, rt) => sum + Number.parseFloat(rt.amount.toString()), 0) || 0

        const recurringExpense =
          recurringTransactions
            ?.filter((rt) => rt.type === "expense")
            .reduce((sum, rt) => sum + Number.parseFloat(rt.amount.toString()), 0) || 0

        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        if (recurringIncome !== 0 || recurringExpense !== 0) {
          if (!monthlyMap.has(currentMonthKey)) {
            monthlyMap.set(currentMonthKey, { month: currentMonthKey, income: 0, expense: 0 })
          }
          const entry = monthlyMap.get(currentMonthKey)
          entry.income += recurringIncome
          entry.expense += recurringExpense
          monthlyMap.set(currentMonthKey, entry)
        }

        setRecurringSummary({ income: recurringIncome, expense: recurringExpense })

        const monthly = Array.from(monthlyMap.values()).slice(-12)
        const trendReady = monthly.map((row) => ({
          ...row,
          net: row.income - row.expense,
        }))

        setMonthlyData(trendReady)

        const categoryMap = new Map()
        filtered
          .filter((tx: Transaction) => tx.type === "expense")
          .forEach((tx: Transaction) => {
            const amount = Number.parseFloat(tx.amount.toString())
            categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount)
          })

        if (recurringTransactions) {
          recurringTransactions
            .filter((rt) => rt.type === "expense")
            .forEach((rt) => {
              const amount = Number.parseFloat(rt.amount.toString())
              categoryMap.set(rt.category, (categoryMap.get(rt.category) || 0) + amount)
            })
        }

        const categories = Array.from(categoryMap.entries()).map(([name, value]) => ({
          name,
          value,
        }))

        setCategoryData(categories)

        if (cards) {
          const cardSpendMap = new Map<string, { name: string; value: number }>()
          filtered
            .filter((tx: Transaction) => tx.type === "expense" && tx.card_id)
            .forEach((tx: Transaction) => {
              const card = cards.find((c) => c.id === tx.card_id)
              const amount = Number.parseFloat(tx.amount.toString())
              if (card) {
                cardSpendMap.set(card.id, {
                  name: card.nickname,
                  value: (cardSpendMap.get(card.id)?.value || 0) + amount,
                })
              }
            })

          setCardData(Array.from(cardSpendMap.values()))
        }

        if (investments) {
          const totalInvested = investments.reduce((sum, inv: Investment) => sum + Number(inv.amount), 0)
          const averageReturn =
            totalInvested > 0
              ? investments.reduce(
                  (sum, inv: Investment) => sum + Number(inv.amount) * Number(inv.expected_return),
                  0,
                ) / totalInvested
              : 0

          const projectedGain =
            investments.reduce((sum, inv: Investment) => {
              const monthlyRate = Number(inv.expected_return) / 12 / 100
              return sum + Number(inv.amount) * Math.pow(1 + monthlyRate, 12)
            }, 0) - totalInvested

          const dataset = investments.map((inv: Investment) => ({
            name: inv.name,
            category: inv.category,
            amount: Number(inv.amount),
            projection12: Number(inv.amount) * Math.pow(1 + Number(inv.expected_return) / 12 / 100, 12),
          }))

          setInvestmentSummary({ total: totalInvested, projected: projectedGain, averageReturn })
          setInvestmentData(dataset)
        } else {
          setInvestmentSummary({ total: 0, projected: 0, averageReturn: 0 })
          setInvestmentData([])
        }
      } else {
        setRecurringSummary({ income: 0, expense: 0 })
      }

      setLoading(false)
    }

    fetchData()
  }, [userId, supabase, period])

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

  const totalIncome = useMemo(() => monthlyData.reduce((sum: number, item: any) => sum + (item.income || 0), 0), [monthlyData])
  const totalExpense = useMemo(
    () => monthlyData.reduce((sum: number, item: any) => sum + (item.expense || 0), 0),
    [monthlyData],
  )
  const net = totalIncome - totalExpense

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-sky-500 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),transparent)]" />
        <CardContent className="relative z-10 grid gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-white/70">Panorama financeiro</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">Análises Avançadas</h2>
              <p className="text-sm text-white/80 mt-2">
                Entenda seu comportamento de gastos, cartões e investimentos com visão consolidada.
              </p>
            </div>
            <PeriodFilter selectedPeriod={period} onPeriodChange={setPeriod} />
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <AnalyticTile title="Total de entradas" value={totalIncome} variant="income" />
            <AnalyticTile title="Total de saídas" value={totalExpense} variant="expense" />
            <AnalyticTile title="Resultado líquido" value={net} variant={net >= 0 ? "income" : "expense"} />
            <AnalyticTile
              title="Fixas no mês"
              value={recurringSummary.income - recurringSummary.expense}
              variant={recurringSummary.income - recurringSummary.expense >= 0 ? "income" : "expense"}
              helper={
                recurringSummary.income + recurringSummary.expense !== 0
                  ? `Receitas: ${recurringSummary.income.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })} · Despesas: ${recurringSummary.expense.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Evolução Mensal</CardTitle>
          <CardDescription>Últimos 12 meses - Receitas vs Despesas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="income"
                name="Receitas"
                stroke="#10b981"
                fill="url(#colorIncome)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesas"
                stroke="#ef4444"
                fill="url(#colorExpense)"
                strokeWidth={2}
                dot={false}
              />
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Comparação Mensal</CardTitle>
          <CardDescription>Análise em barras dos últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }} />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="Receitas" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" fill="#ef4444" name="Despesas" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Distribuição de Despesas</CardTitle>
          <CardDescription>Por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma despesa registrada</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: R$ ${value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Investimentos</CardTitle>
          <CardDescription>Panorama dos aportes e projeção de 12 meses.</CardDescription>
        </CardHeader>
        <CardContent>
          {investmentData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cadastre investimentos para visualizar esta seção.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={investmentData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                  <Legend />
                  <Bar dataKey="amount" name="Aplicado" fill="var(--chart-2)" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="projection12" name="Proj. 12 meses" fill="var(--chart-3)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total investido</p>
                  <p className="text-2xl font-semibold">
                    {investmentSummary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Rentabilidade média (a.a.)</p>
                  <p className="text-2xl font-semibold text-primary">{investmentSummary.averageReturn.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ganho estimado 12m</p>
                  <p className="text-2xl font-semibold text-emerald-600">
                    {investmentSummary.projected.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground">Considerando rentabilidade anual informada em cada aporte.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Cartões mais utilizados</CardTitle>
          <CardDescription>Distribuição de despesas por cartão no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {cardData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Associe despesas a cartões para visualizar este gráfico.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart
                innerRadius="20%"
                outerRadius="90%"
                data={cardData}
                startAngle={90}
                endAngle={-270}
                barSize={14}
              >
                <RadialBar background dataKey="value">
                  {cardData.map((entry: any, index: number) => (
                    <Cell key={`cell-card-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </RadialBar>
                <Legend iconSize={12} layout="vertical" verticalAlign="middle" align="right" />
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toFixed(2)}`}
                  contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AnalyticTile({
  title,
  value,
  variant,
  helper,
}: {
  title: string
  value: number
  variant: "income" | "expense"
  helper?: string
}) {
  return (
    <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
      <CardContent className="space-y-2 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p
          className={`text-2xl font-semibold ${variant === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
        >
          {value.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  )
}

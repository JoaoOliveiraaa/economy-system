"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Wallet, Calendar, PiggyBank, Wallet2 } from "lucide-react"

interface OverviewData {
  totalIncome: number
  totalExpense: number
  balance: number
  monthlyIncome: number
  monthlyExpense: number
  previousMonthlyExpense: number
  previousMonthlyIncome: number
  recurringIncome: number
  recurringExpense: number
  rollingMovement: number
  baseline: number
  currentReserves: number
}

export function DashboardOverview({ userId }: { userId: string }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const todayISO = new Date().toISOString().split("T")[0]
      const { data: allTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .lte("transaction_date", todayISO)

      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      const { data: monthlyTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("transaction_date", currentMonthStart.toISOString().split("T")[0])
        .lt("transaction_date", nextMonthStart.toISOString().split("T")[0])
        .lte("transaction_date", todayISO)

      const { data: previousMonthTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("transaction_date", previousMonthStart.toISOString().split("T")[0])
        .lt("transaction_date", currentMonthStart.toISOString().split("T")[0])

      const { data: recurringTransactions } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)

      const { data: baselineData } = await supabase
        .from("savings_baseline")
        .select("amount")
        .eq("user_id", userId)
        .maybeSingle()

      const rollingWindowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      const transactionsUpToToday = (allTransactions || []).filter((t) => new Date(t.transaction_date) <= now)
      const rollingTransactions = transactionsUpToToday.filter((t) => new Date(t.transaction_date) >= rollingWindowStart)

      const totalIncome =
        transactionsUpToToday
          ?.filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const totalExpense =
        transactionsUpToToday
          ?.filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const monthlyIncome =
        monthlyTransactions
          ?.filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const monthlyExpense =
        monthlyTransactions
          ?.filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const previousMonthlyIncome =
        previousMonthTransactions
          ?.filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const previousMonthlyExpense =
        previousMonthTransactions
          ?.filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const recurringIncome =
        recurringTransactions
          ?.filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const recurringExpense =
        recurringTransactions
          ?.filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0) || 0

      const rollingMovement = rollingTransactions.reduce(
        (sum, t) => sum + Number.parseFloat(t.amount),
        0,
      )

      const baselineAmount =
        baselineData?.amount !== undefined ? Number.parseFloat(baselineData.amount.toString()) : 0

      const adjustedMonthlyIncome = monthlyIncome + recurringIncome
      const adjustedMonthlyExpense = monthlyExpense + recurringExpense
      const monthlyNet = adjustedMonthlyIncome - adjustedMonthlyExpense
      const totalNet = totalIncome - totalExpense + recurringIncome - recurringExpense

      setData({
        totalIncome: totalIncome + recurringIncome,
        totalExpense: totalExpense + recurringExpense,
        balance: totalNet + baselineAmount,
        monthlyIncome: adjustedMonthlyIncome,
        monthlyExpense: adjustedMonthlyExpense,
        previousMonthlyIncome,
        previousMonthlyExpense,
        recurringIncome,
        recurringExpense,
        rollingMovement: rollingMovement + recurringIncome - recurringExpense,
        baseline: baselineAmount,
        currentReserves: baselineAmount + monthlyNet,
      })
      setLoading(false)
    }

    fetchData()
  }, [userId, supabase])

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    })

  const monthlyDelta = useMemo(() => {
    if (!data) return { income: 0, expense: 0 }
    const income = data.monthlyIncome - data.previousMonthlyIncome
    const expense = data.monthlyExpense - data.previousMonthlyExpense
    return { income, expense }
  }, [data])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  if (!data) return null

  return (
    <section className="grid gap-4 lg:grid-cols-[1.3fr,0.7fr]">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/90 via-primary to-primary-foreground/20 text-primary-foreground shadow-xl">
        <div className="absolute -left-16 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-12 -bottom-16 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
        <CardContent className="relative z-10 grid gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-white/70">Visão Geral</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">Saúde financeira</h2>
            </div>
            <Badge variant="secondary" className="self-start rounded-full bg-white/20 text-xs text-white backdrop-blur">
              Atualizado automaticamente
            </Badge>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-white/80">
                <Wallet className="h-4 w-4" />
                Saldo acumulado
              </span>
              <p className="text-3xl font-bold sm:text-4xl">{formatCurrency(data.balance)}</p>
              <p className="text-sm text-white/70">
                {data.balance >= 0 ? "Superávit" : "Déficit"} considerando todo o histórico registrado.
              </p>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-white/80">
                <TrendingUp className="h-4 w-4" />
                Entradas do mês
              </span>
              <p className="text-3xl font-semibold text-emerald-100">{formatCurrency(data.monthlyIncome)}</p>
              <div className="space-y-1">
                <p className="text-sm text-white/70">
                  {monthlyDelta.income >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(monthlyDelta.income))} vs. mês anterior
                </p>
                {data.recurringIncome > 0 && (
                  <p className="text-xs text-white/60">
                    Inclui {formatCurrency(data.recurringIncome)} de receitas fixas
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-white/80">
                <TrendingDown className="h-4 w-4" />
                Saídas do mês
              </span>
              <p className="text-3xl font-semibold text-rose-100">{formatCurrency(data.monthlyExpense)}</p>
              <div className="space-y-1">
                <p className="text-sm text-white/70">
                  {monthlyDelta.expense >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(monthlyDelta.expense))} vs. mês anterior
                </p>
                {data.recurringExpense > 0 && (
                  <p className="text-xs text-white/60">
                    Inclui {formatCurrency(data.recurringExpense)} de despesas fixas
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <MetricCard
          title="Reservas atuais"
          description="Saldo mensal restante após despesas."
          value={formatCurrency(data.currentReserves)}
          icon={<PiggyBank className="h-5 w-5 text-emerald-500" />}
          positive={data.currentReserves >= 0}
          helper={`Sobra do mês: ${formatCurrency(data.monthlyIncome - data.monthlyExpense)} · Saldo inicial: ${formatCurrency(data.baseline)}`}
        />
        <MetricCard
          title="Total movimentado (12 meses)"
          description="Entradas e saídas registradas no período recente."
          value={formatCurrency(data.rollingMovement)}
          icon={<Wallet2 className="h-5 w-5 text-sky-500" />}
          positive
        />
      </div>
    </section>
  )
}

function MetricCard({
  title,
  description,
  value,
  icon,
  positive,
  helper,
}: {
  title: string
  description: string
  value: string
  icon: React.ReactNode
  positive?: boolean
  helper?: string
}) {
  return (
    <Card className="border-0 bg-card/80 shadow-lg backdrop-blur transition-shadow hover:shadow-xl">
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${positive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

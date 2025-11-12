"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PeriodFilter } from "./period-filter"
import { PiggyBank, TrendingUp, Percent, ArrowUpRight, Sparkles } from "lucide-react"

interface Transaction {
  id: string
  type: "income" | "expense"
  amount: number
  transaction_date: string
}

interface SavingsData {
  month: string
  income: number
  expense: number
  savings: number
  savingsRate: number
}

const formatBRLMoney = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  })

export function SavingsAnalytics({ userId }: { userId: string }) {
  const [savingsData, setSavingsData] = useState<SavingsData[]>([])
  const [period, setPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [totalStats, setTotalStats] = useState({
    totalSavings: 0,
    avgSavingsRate: 0,
    bestMonth: "",
    fixedIncome: 0,
    fixedExpense: 0,
  })
  const [baseline, setBaseline] = useState(0)
  const [baselineLoading, setBaselineLoading] = useState(true)
  const [baselineDialog, setBaselineDialog] = useState(false)
  const [baselineInput, setBaselineInput] = useState("")
  const [savingBaseline, setSavingBaseline] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: true })

      const { data: recurringTransactions } = await supabase
        .from("recurring_transactions")
        .select("type, amount, active")
        .eq("user_id", userId)
        .eq("active", true)

      if (transactions) {
        const now = new Date()
        const transactionsUpToToday = transactions.filter((t) => new Date(t.transaction_date) <= now)
        let startDate = new Date()

        if (period === "3m") startDate.setMonth(now.getMonth() - 3)
        else if (period === "6m") startDate.setMonth(now.getMonth() - 6)
        else if (period === "1y") startDate.setFullYear(now.getFullYear() - 1)
        else if (period === "2y") startDate.setFullYear(now.getFullYear() - 2)
        else startDate = new Date("2000-01-01")

        const filtered = transactionsUpToToday.filter((t) => new Date(t.transaction_date) >= startDate)

        const monthlyMap = new Map<string, SavingsData>()
        filtered.forEach((tx: Transaction) => {
          const month = tx.transaction_date.substring(0, 7)
          if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expense: 0, savings: 0, savingsRate: 0 })
          }
          const data = monthlyMap.get(month)!
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

        if (recurringIncome !== 0 || recurringExpense !== 0) {
          const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
          if (!monthlyMap.has(currentMonthKey)) {
            monthlyMap.set(currentMonthKey, { month: currentMonthKey, income: 0, expense: 0, savings: 0, savingsRate: 0 })
          }
          const current = monthlyMap.get(currentMonthKey)!
          current.income += recurringIncome
          current.expense += recurringExpense
          monthlyMap.set(currentMonthKey, current)
        }

        const savingsArray = Array.from(monthlyMap.values()).map((d) => ({
          ...d,
          savings: d.income - d.expense,
          savingsRate: d.income > 0 ? ((d.income - d.expense) / d.income) * 100 : 0,
        }))

        setSavingsData(savingsArray)

        const totalSavings = savingsArray.reduce((sum, d) => sum + d.savings, 0)
        const totalIncome = savingsArray.reduce((sum, d) => sum + d.income, 0)
        const avgSavingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
        const bestMonth =
          savingsArray.length > 0
            ? savingsArray.reduce((prev, current) => (current.savings > prev.savings ? current : prev)).month
            : ""

        setTotalStats({
          totalSavings,
          avgSavingsRate,
          bestMonth,
          fixedIncome: recurringIncome,
          fixedExpense: recurringExpense,
        })
      } else {
        setTotalStats({ totalSavings: 0, avgSavingsRate: 0, bestMonth: "", fixedIncome: 0, fixedExpense: 0 })
      }

      setLoading(false)
    }

    fetchData()
  }, [userId, supabase, period])

  useEffect(() => {
    const fetchBaseline = async () => {
      setBaselineLoading(true)
      const { data, error } = await supabase
        .from("savings_baseline")
        .select("amount")
        .eq("user_id", userId)
        .maybeSingle()

      if (!error && data?.amount !== undefined) {
        const stored = Number.parseFloat(data.amount.toString())
        if (Number.isFinite(stored)) {
          setBaseline(stored)
          setBaselineInput(formatBRLMoney(stored).replace(/^R\$\s?/, ""))
        } else {
          setBaseline(0)
          setBaselineInput("")
        }
      } else {
        setBaseline(0)
        setBaselineInput("")
      }
      setBaselineLoading(false)
    }

    fetchBaseline()
  }, [userId, supabase])

  useEffect(() => {
    setBaselineInput(formatBRLMoney(baseline).replace(/^R\$\s?/, ""))
  }, [baseline])

  const handleSaveBaseline = async () => {
    let processed = baselineInput.trim()
    if (processed === "") processed = "0"
    if (processed.includes(",")) {
      processed = processed.replace(/\./g, "").replace(",", ".")
    } else {
      processed = processed.replace(/\s/g, "")
    }
    const value = Number.parseFloat(processed)
    if (!Number.isFinite(value)) {
      toast({
        title: "Valor inválido",
        description: "Informe um número no formato 15.000,00 ou 15000.00",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingBaseline(true)
      const timestamp = new Date().toISOString()

      const { data: existing, error: fetchError } = await supabase
        .from("savings_baseline")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("savings_baseline")
          .update({ amount: value, updated_at: timestamp })
          .eq("id", existing.id)

        if (updateError) {
          throw updateError
        }
      } else {
        const { error: insertError } = await supabase
          .from("savings_baseline")
          .insert({ user_id: userId, amount: value, updated_at: timestamp })

        if (insertError) {
          throw insertError
        }
      }

      setBaseline(value)
      setBaselineInput(formatBRLMoney(value).replace(/^R\$\s?/, ""))
      setBaselineDialog(false)
      toast({
        title: "Saldo inicial atualizado",
        description: `Poupança total agora considera ${formatBRLMoney(value)}.`,
      })
    } catch (error: any) {
      toast({
        title: "Erro ao salvar saldo inicial",
        description: error?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      })
    } finally {
      setSavingBaseline(false)
    }
  }

  const bestMonths = useMemo(
    () =>
      [...savingsData]
        .sort((a, b) => b.savings - a.savings)
        .slice(0, 3)
        .map((item) => ({
          month: item.month,
          savings: item.savings,
          rate: item.savingsRate,
        })),
    [savingsData],
  )

  const cumulativeProjection = useMemo(() => {
    const projectionRates = [3, 6, 12, 24, 36]
    const averageSavings =
      savingsData.length > 0 ? savingsData.reduce((sum, item) => sum + item.savings, 0) / savingsData.length : 0
    return projectionRates.map((months) => ({
      period: `${months} meses`,
      value: averageSavings * months,
    }))
  }, [savingsData])

  const radialData = useMemo(
    () => [
      {
        name: "Taxa média",
        value: Number(totalStats.avgSavingsRate.toFixed(1)),
        fill: "var(--chart-2)",
      },
    ],
    [totalStats.avgSavingsRate],
  )

  const displayTotalSavings = totalStats.totalSavings + baseline

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    )
  }

  return (
    <section className="space-y-8">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-500 text-violet-50 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),transparent)]" />
        <CardContent className="relative z-10 grid gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-violet-100">Acúmulo inteligente</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">Poupança & Performance</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-white/20 text-white backdrop-blur">
                Melhor mês: {totalStats.bestMonth ? totalStats.bestMonth : "—"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20"
                onClick={() => {
                  setBaselineInput(baseline.toString())
                  setBaselineDialog(true)
                }}
                disabled={baselineLoading}
              >
                Ajustar saldo inicial
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile
              icon={<PiggyBank className="h-5 w-5" />}
              label="Total acumulado"
              value={displayTotalSavings}
              suffix="BRL"
              helper={baseline > 0 ? `Saldo inicial: ${formatBRLMoney(baseline)}` : undefined}
            />
            <StatTile
              icon={<Percent className="h-5 w-5" />}
              label="Taxa média de poupança"
              value={totalStats.avgSavingsRate}
              suffix="%"
            />
            <StatTile
              icon={<TrendingUp className="h-5 w-5" />}
              label="Ticket médio mensal"
              value={savingsData.length > 0 ? totalStats.totalSavings / savingsData.length : 0}
              suffix="BRL"
              helper={
                totalStats.fixedIncome + totalStats.fixedExpense !== 0
                  ? `Inclui ${(totalStats.fixedIncome - totalStats.fixedExpense).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })} de fixas`
                  : "Baseado nos meses disponíveis"
              }
            />
            <StatTile
              icon={<Sparkles className="h-5 w-5" />}
              label="Fixas do mês"
              value={totalStats.fixedIncome - totalStats.fixedExpense}
              suffix="BRL"
              helper={
                totalStats.fixedIncome + totalStats.fixedExpense !== 0
                  ? `Receitas: ${totalStats.fixedIncome.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })} · Despesas: ${totalStats.fixedExpense.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}`
                  : "Sem lançamentos fixos"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">Visão consolidada</h3>
          <p className="text-sm text-muted-foreground">Analise o comportamento da poupança e planeje os próximos meses.</p>
        </div>
        <PeriodFilter selectedPeriod={period} onPeriodChange={setPeriod} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Evolução mensal das reservas</CardTitle>
            <CardDescription>Quanto foi guardado em cada mês selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {savingsData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savingsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                  <Area type="monotone" dataKey="savings" stroke="var(--chart-2)" fill="url(#savingsGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/70 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Top 3 meses</CardTitle>
              <CardDescription>Maiores contribuições para a reserva.</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              Ranking
            </Badge>
          </CardHeader>
          <CardContent>
            {bestMonths.length === 0 ? (
              <EmptyState />
            ) : (
              <ScrollArea className="h-60 pr-4">
                <div className="space-y-4">
                  {bestMonths.map((item, index) => (
                    <div
                      key={item.month}
                      className="flex items-center justify-between rounded-2xl border border-muted bg-muted/30 p-4 transition hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{item.month}</p>
                          <p className="text-xs text-muted-foreground">Taxa {item.rate.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {item.savings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr,0.8fr]">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Receitas vs Despesas vs Poupança</CardTitle>
            <CardDescription>Comparação completa do período selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {savingsData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="var(--chart-1)" name="Receitas" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="var(--chart-4)" name="Despesas" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="savings" stroke="var(--chart-2)" name="Poupança" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Projeção de capital</CardTitle>
            <CardDescription>Média do aporte mensal projetada para diferentes horizontes.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {savingsData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeProjection} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {cumulativeProjection.map((entry, index) => (
                      <Cell key={entry.period} fill={index % 2 === 0 ? "var(--chart-2)" : "var(--chart-3)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Taxa média</CardTitle>
            <CardDescription>Percentual de renda direcionado à reserva.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-72 flex-col items-center justify-center gap-6">
            {savingsData.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="70%">
                  <RadialBarChart innerRadius="60%" outerRadius="95%" barSize={18} data={radialData} startAngle={180} endAngle={-180}>
                    <RadialBar background dataKey="value" cornerRadius={10} />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-3xl font-semibold text-primary">{totalStats.avgSavingsRate.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">Meta sugerida: manter acima de 20%</span>
                  <Badge variant="outline" className="mt-2 w-fit rounded-full px-3 py-1 text-[11px]">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Fluxo saudável
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={baselineDialog} onOpenChange={setBaselineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saldo inicial da poupança</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o valor já guardado fora do período monitorado. Ele será somado aos cálculos exibidos, sem afetar as
              movimentações mensais.
            </p>
            <Input
              type="text"
              inputMode="decimal"
              value={baselineInput}
              onChange={(event) => setBaselineInput(event.target.value)}
              placeholder="Ex.: 15.000,00"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBaselineDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBaseline} disabled={savingBaseline}>
              {savingBaseline ? "Salvando..." : "Salvar saldo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <ArrowUpRight className="h-6 w-6" />
      Sem dados disponíveis para o período selecionado.
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  suffix,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix: string
  helper?: string
}) {
  const formatted =
    suffix === "BRL"
      ? value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : `${value.toFixed(1)}${suffix}`
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/15 p-4 text-white backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-semibold">{formatted}</p>
      <span className="text-xs text-white/70">{helper ?? "Monitorado automaticamente"}</span>
    </div>
  )
}

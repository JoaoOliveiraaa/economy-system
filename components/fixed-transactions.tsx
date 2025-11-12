"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, Tooltip } from "recharts"
import { CalendarClock, PenSquare, Plus, TrendingUp, TrendingDown, ShieldCheck, Trash2 } from "lucide-react"

interface RecurringTransaction {
  id: string
  type: "income" | "expense"
  category: string
  amount: number
  description: string
  day_of_month: number
  active: boolean
}

const CATEGORIES = {
  income: ["Salário", "Aluguel", "Aposentadoria", "Freelance", "Bônus", "Outro"],
  expense: ["Alimentação", "Transporte", "Utilities", "Saúde", "Educação", "Lazer", "Outro"],
}

export function FixedTransactions({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<"income" | "expense">("income")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [description, setDescription] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<RecurringTransaction | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchTransactions()
  }, [userId])

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("day_of_month", { ascending: true })

    setTransactions(data || [])
    setLoading(false)
  }

  const handleAddTransaction = async () => {
    if (!category || !amount) return

    const { error } = await supabase.from("recurring_transactions").insert({
      user_id: userId,
      type,
      category,
      amount: Number.parseFloat(amount),
      day_of_month: Number.parseInt(dayOfMonth),
      description,
      active: true,
    })

    if (error) {
      toast({
        title: "Não foi possível adicionar",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Recorrência criada",
      description: "Lançamento fixo adicionado ao seu mês.",
    })

    setAmount("")
    setDescription("")
    setCategory("")
    setDayOfMonth("1")
    fetchTransactions()
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("recurring_transactions").update({ active: !active }).eq("id", id)
    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      })
      return
    }
    toast({
      title: active ? "Recorrência pausada" : "Recorrência reativada",
    })
    fetchTransactions()
  }

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id)
    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      })
      return
    }
    toast({
      title: "Recorrência removida",
    })
    fetchTransactions()
  }

  const openEditDialog = (transaction: RecurringTransaction) => {
    setEditData({ ...transaction })
    setEditOpen(true)
  }

  const handleUpdateTransaction = async () => {
    if (!editData) return

    setEditing(true)
    const { error } = await supabase
      .from("recurring_transactions")
      .update({
        type: editData.type,
        category: editData.category,
        amount: Number.parseFloat(editData.amount.toString()),
        day_of_month: editData.day_of_month,
        description: editData.description,
        active: editData.active,
      })
      .eq("id", editData.id)

    setEditing(false)

    if (error) {
      toast({
        title: "Erro ao atualizar recorrência",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Recorrência atualizada",
      description: "Valores ajustados com sucesso.",
    })

    setEditOpen(false)
    setEditData(null)
    fetchTransactions()
  }

  const metrics = useMemo(() => {
    const activeTransactions = transactions.filter((t) => t.active)
    const totalMonthlyIncome = activeTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number.parseFloat(t.amount.toString()), 0)
    const totalMonthlyExpense = activeTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number.parseFloat(t.amount.toString()), 0)

    const averageDay =
      activeTransactions.length > 0
        ? Math.round(activeTransactions.reduce((sum, t) => sum + t.day_of_month, 0) / activeTransactions.length)
        : null

    const stabilityIndex =
      totalMonthlyIncome + totalMonthlyExpense > 0
        ? Math.min(100, Math.round((totalMonthlyIncome / (totalMonthlyExpense || 1)) * 35 + activeTransactions.length * 5))
        : 0

    return {
      activeTransactions,
      totalMonthlyIncome,
      totalMonthlyExpense,
      net: totalMonthlyIncome - totalMonthlyExpense,
      averageDay,
      stabilityIndex,
    }
  }, [transactions])

  const chartData = useMemo(() => {
    const grouped = new Map<string, { category: string; income: number; expense: number }>()
    transactions
      .filter((tx) => tx.active)
      .forEach((tx) => {
        const entry = grouped.get(tx.category) || { category: tx.category, income: 0, expense: 0 }
        if (tx.type === "income") {
          entry.income += Number.parseFloat(tx.amount.toString())
        } else {
          entry.expense += Number.parseFloat(tx.amount.toString())
        }
        grouped.set(tx.category, entry)
      })
    return Array.from(grouped.values())
  }, [transactions])

  return (
    <section className="space-y-8">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/90 via-primary to-violet-600 text-primary-foreground shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),transparent)]" />
        <CardContent className="relative z-10 grid gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-white/70">Compromissos mensais</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">Receitas & Despesas Fixas</h2>
            </div>
            <Badge variant="secondary" className="rounded-full bg-white/20 text-white backdrop-blur">
              {metrics.activeTransactions.length} lançamentos ativos
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile
              icon={<TrendingUp className="h-5 w-5" />}
              label="Entradas recorrentes"
              value={metrics.totalMonthlyIncome}
              tone="positive"
            />
            <SummaryTile
              icon={<TrendingDown className="h-5 w-5" />}
              label="Saídas recorrentes"
              value={metrics.totalMonthlyExpense}
              tone="negative"
            />
            <SummaryTile
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Saldo mensal fixo"
              value={metrics.net}
              tone={metrics.net >= 0 ? "positive" : "negative"}
              helper={
                metrics.averageDay
                  ? `Dia médio de pagamento: ${metrics.averageDay}`
                  : "Adicione lançamentos para acompanhar o fluxo"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Adicionar receita/despesa fixa</CardTitle>
              <CardDescription>Acompanhe vencimentos automáticos e mantenha o fluxo controlado.</CardDescription>
            </div>
            <Badge variant="outline" className="mt-2 w-fit rounded-full border-dashed px-4 py-1 text-xs uppercase">
              Recorrência mensal
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={type} onValueChange={(value: "income" | "expense") => setType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES[type].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Valor mensal"
              />
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Dia de cobrança" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
            />

            <Button onClick={handleAddTransaction} className="w-full gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Salvar recorrência
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Padrão de categorias</CardTitle>
            <CardDescription>Visão rápida das recorrências ativas.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {metrics.activeTransactions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                Adicione lançamentos fixos para visualizar a distribuição por categoria.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 8,
                    right: 16,
                    left: -16,
                    bottom: 8,
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" className="text-xs" tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar dataKey="income" stackId="a" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expense" stackId="a" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Agenda de recorrências</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Visualize o fluxo previsto do mês
              </span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            Índice de estabilidade {metrics.stabilityIndex}%
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48" />
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma transação fixa configurada</p>
            </div>
          ) : (
            <ScrollArea className="h-[360px] pr-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Dia</TableHead>
                    <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-16">Ativo</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className={`transition hover:bg-muted/40 ${!tx.active ? "opacity-60" : ""}`}>
                      <TableCell className="font-semibold">{tx.day_of_month}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{tx.category}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            tx.type === "income"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
                          }
                        >
                          {tx.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {tx.type === "income" ? "+" : "-"} R$ {Number.parseFloat(tx.amount.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Switch checked={tx.active} onCheckedChange={() => handleToggleActive(tx.id, tx.active)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(tx)}
                            className="h-8 w-8 rounded-full"
                          >
                            <PenSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="h-8 w-8 rounded-full"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(value) => {
          setEditOpen(value)
          if (!value) setEditData(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar receita/despesa fixa</DialogTitle>
          </DialogHeader>
          {editData ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={editData.type}
                  onValueChange={(value: "income" | "expense") =>
                    setEditData((prev) => (prev ? { ...prev, type: value, category: CATEGORIES[value][0] } : prev))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={editData.category}
                  onValueChange={(value) => setEditData((prev) => (prev ? { ...prev, category: value } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[editData.type].map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editData.amount.toString()}
                  onChange={(event) =>
                    setEditData((prev) => (prev ? { ...prev, amount: Number(event.target.value) } : prev))
                  }
                  placeholder="Valor"
                />
                <Select
                  value={editData.day_of_month.toString()}
                  onValueChange={(value) =>
                    setEditData((prev) => (prev ? { ...prev, day_of_month: Number(value) } : prev))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dia do mês" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Dia {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={editData.description ?? ""}
                onChange={(event) =>
                  setEditData((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                placeholder="Descrição"
                className="min-h-[80px] resize-none"
              />

              <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                <Switch
                  checked={editData.active}
                  onCheckedChange={(value) =>
                    setEditData((prev) => (prev ? { ...prev, active: value } : prev))
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {editData.active ? "Recorrência ativa" : "Recorrência pausada"}
                </span>
              </div>
            </div>
          ) : (
            <Skeleton className="h-40" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTransaction} disabled={editing} className="gap-2">
              {editing ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: "positive" | "negative"
  helper?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/15 p-4 text-white backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-semibold">
        {value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
      </p>
      {helper ? (
        <span className="text-xs text-white/80">{helper}</span>
      ) : (
        <span className="text-xs text-white/60">{tone === "positive" ? "Boa estabilidade" : "Atenção ao fluxo"}</span>
      )}
    </div>
  )
}

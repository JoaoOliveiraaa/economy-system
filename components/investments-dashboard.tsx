"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
} from "recharts"
import { Plus, TrendingUp, Coins, LineChart as LineIcon, Pencil, Trash2 } from "lucide-react"

interface Investment {
  id: string
  name: string
  category: string
  broker: string | null
  amount: number
  expected_return: number
  start_date: string
  risk_level: string
  notes: string | null
  created_at: string
}

type FormState = {
  name: string
  category: string
  broker: string
  amount: string
  expectedReturn: string
  startDate: string
  riskLevel: string
  notes: string
}

const CATEGORIES = ["Renda Fixa", "Ações", "Fundos Imobiliários", "ETF", "Cripto", "Poupança", "Previdência", "Outro"]
const RISK_LEVELS = ["conservador", "moderado", "arrojado"]
const PROJECTIONS = [3, 6, 12, 24, 36]

const sanitizeNumber = (input: string): number | null => {
  if (!input) return null
  let value = input.trim()
  if (value === "") return null
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".")
  } else {
    value = value.replace(/\s/g, "")
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const formatNumberForInput = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function InvestmentsDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: "",
    category: "Renda Fixa",
    broker: "",
    amount: "",
    expectedReturn: "8.0",
    startDate: new Date().toISOString().split("T")[0],
    riskLevel: "moderado",
    notes: "",
  })

  useEffect(() => {
    fetchInvestments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchInvestments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      toast({
        title: "Erro ao carregar investimentos",
        description: error.message,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    setInvestments(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({
      name: "",
      category: "Renda Fixa",
      broker: "",
      amount: "",
      expectedReturn: "8.0",
      startDate: new Date().toISOString().split("T")[0],
      riskLevel: "moderado",
      notes: "",
    })
    setEditing(null)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.amount || !form.expectedReturn || !form.startDate) {
      toast({
        title: "Preencha os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    const amountValue = sanitizeNumber(form.amount)
    const expectedReturnValue = sanitizeNumber(form.expectedReturn)

    if (amountValue === null || Number.isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Valor aplicado inválido",
        description: "Informe um número válido, por exemplo 25.000,00",
        variant: "destructive",
      })
      return
    }

    if (expectedReturnValue === null || Number.isNaN(expectedReturnValue)) {
      toast({
        title: "Rentabilidade inválida",
        description: "Informe a rentabilidade no formato 11,50 ou 11.50",
        variant: "destructive",
      })
      return
    }

    const payload = {
      user_id: userId,
      name: form.name.trim(),
      category: form.category,
      broker: form.broker.trim() || null,
      amount: amountValue,
      expected_return: expectedReturnValue,
      start_date: form.startDate,
      risk_level: form.riskLevel,
      notes: form.notes.trim() || null,
    }

    try {
      setSaving(true)
      const { error } = editing
        ? await supabase.from("investments").update(payload).eq("id", editing.id)
        : await supabase.from("investments").insert(payload)

      if (error) {
        throw error
      }

      toast({
        title: editing ? "Investimento atualizado" : "Investimento adicionado",
        description: "Projeções recalculadas automaticamente.",
      })

      setOpen(false)
      resetForm()
      fetchInvestments()
    } catch (error: any) {
      toast({
        title: "Erro ao salvar investimento",
        description: error?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (investment: Investment) => {
    setEditing(investment)
    setForm({
      name: investment.name,
      category: investment.category,
      broker: investment.broker || "",
      amount: formatNumberForInput(Number(investment.amount)),
      expectedReturn: formatNumberForInput(Number(investment.expected_return)),
      startDate: investment.start_date,
      riskLevel: investment.risk_level,
      notes: investment.notes || "",
    })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("investments").delete().eq("id", id)
    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Investimento removido",
    })
    fetchInvestments()
  }

  const totals = useMemo(() => {
    const totalAmount = investments.reduce((sum, item) => sum + Number(item.amount), 0)
    const weightedReturn =
      totalAmount > 0
        ? investments.reduce((sum, item) => sum + Number(item.amount) * Number(item.expected_return), 0) / totalAmount
        : 0

    const radarData = RISK_LEVELS.map((level) => ({
      risk: level,
      valor: investments.filter((item) => item.risk_level === level).reduce((sum, inv) => sum + Number(inv.amount), 0),
    }))

    return { totalAmount, weightedReturn, radarData }
  }, [investments])

  const projectionData = useMemo(() => {
    return PROJECTIONS.map((months) => {
      const projected = investments.reduce((sum, inv) => {
        const monthlyRate = Number(inv.expected_return) / 12 / 100
        const futureValue = Number(inv.amount) * Math.pow(1 + monthlyRate, months)
        return sum + futureValue
      }, 0)
    return {
        period: `${months}m`,
        total: projected,
      }
    })
  }, [investments])

  const detailedProjection = (investment: Investment) =>
    PROJECTIONS.map((months) => {
      const monthlyRate = Number(investment.expected_return) / 12 / 100
      const futureValue = Number(investment.amount) * Math.pow(1 + monthlyRate, months)
      return {
        label: `${months} meses`,
        value: futureValue,
      }
    })

  return (
    <section className="space-y-8">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-700 via-violet-600 to-purple-500 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),transparent)]" />
        <CardContent className="relative z-10 grid gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.4em] text-white/70">Carteira de investimentos</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">Aportes & Projeções</h2>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-2 rounded-full bg-white/15 text-white hover:bg-white/25">
              <Plus className="h-4 w-4" />
              Novo investimento
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile
              icon={<Coins className="h-5 w-5" />}
              label="Capital investido"
              value={totals.totalAmount}
              variant="primary"
            />
            <SummaryTile
              icon={<TrendingUp className="h-5 w-5" />}
              label="Rentabilidade média (a.a.)"
              value={totals.weightedReturn}
              variant="success"
              suffix="%"
            />
            <SummaryTile
              icon={<LineIcon className="h-5 w-5" />}
              label="Projeção em 12 meses"
              value={
                investments.reduce((sum, inv) => {
                  const monthlyRate = Number(inv.expected_return) / 12 / 100
                  return sum + Number(inv.amount) * Math.pow(1 + monthlyRate, 12)
                }, 0) - totals.totalAmount
              }
              variant="highlight"
              helper="Ganho futuro estimado"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Projeção acumulada</CardTitle>
            <CardDescription>Projeção considerando todos os investimentos atuais.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {investments.length === 0 ? (
              <Skeleton className="h-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="investGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--chart-2)" fill="url(#investGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Distribuição por risco</CardTitle>
              <CardDescription>Equilíbrio da carteira por perfil.</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
              Perfil
            </Badge>
          </CardHeader>
          <CardContent className="h-72">
            {investments.length === 0 ? (
              <Skeleton className="h-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={totals.radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="risk" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Radar name="Capital" dataKey="valor" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.4} />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Investimentos ativos</CardTitle>
          <CardDescription>Detalhes de aportes, rentabilidade e projeções.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum investimento cadastrado. Utilize o botão acima para começar.
            </div>
          ) : (
            <ScrollArea className="h-[420px] pr-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {investments.map((investment) => (
                  <div key={investment.id} className="space-y-4 rounded-3xl border border-border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{investment.name}</h3>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{investment.category}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase">
                        {investment.risk_level}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Aplicado</span>
                        <span className="font-semibold text-foreground">
                          {Number(investment.amount).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Retorno (a.a.)</span>
                        <span className="font-semibold text-primary">{Number(investment.expected_return).toFixed(2)}%</span>
                      </div>
                      {investment.broker && (
                        <div className="flex items-center justify-between">
                          <span>Corretora</span>
                          <span className="font-medium">{investment.broker}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Início</span>
                        <span>{new Date(investment.start_date).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Projeções futuras</p>
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        {detailedProjection(investment).map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className="font-semibold text-foreground">
                              {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {investment.notes && (
                      <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{investment.notes}</p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleEdit(investment)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive"
                        onClick={() => handleDelete(investment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) {
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar investimento" : "Adicionar investimento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Nome do investimento</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex.: Tesouro IPCA 2029"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Categoria</label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Corretora (opcional)</label>
                <Input
                  value={form.broker}
                  onChange={(event) => setForm((prev) => ({ ...prev, broker: event.target.value }))}
                  placeholder="Ex.: Nubank, XP, Banco Inter..."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Valor aplicado</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="R$ 5.000,00"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Rentabilidade esperada (a.a.)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.expectedReturn}
                  onChange={(event) => setForm((prev) => ({ ...prev, expectedReturn: event.target.value }))}
                  placeholder="8,0%"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Data do aporte</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Nível de risco</label>
                <Select value={form.riskLevel} onValueChange={(value) => setForm((prev) => ({ ...prev, riskLevel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((risk) => (
                      <SelectItem key={risk} value={risk}>
                        {risk.charAt(0).toUpperCase() + risk.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Observações</label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Informações relevantes, metas de resgate, etc."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving ? "Salvando..." : editing ? "Atualizar" : "Adicionar"}
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
  variant,
  suffix,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: number
  variant: "primary" | "success" | "highlight"
  suffix?: "%" | "BRL"
  helper?: string
}) {
  const formatted =
    suffix === "%"
      ? `${value.toFixed(2)}%`
      : value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/15 p-4 text-white backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-semibold">{formatted}</p>
      <span className="text-xs text-white/70">{helper ?? "Atualizado em tempo real"}</span>
    </div>
  )
}


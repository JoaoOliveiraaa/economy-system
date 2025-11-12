"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { BarChart3, CreditCard, Loader2, RefreshCcw, Trash2 } from "lucide-react"

interface PaymentCard {
  id: string
  nickname: string
  brand: CardPresetKey
  network: string | null
  credit_limit: number | null
  closing_day: number
  due_day: number
  gradient_from: string | null
  gradient_to: string | null
}

interface Transaction {
  id: string
  amount: number
  transaction_date: string
  type: "income" | "expense"
  card_id: string | null
}

type CardPresetKey = "nubank" | "magalu" | "visa-signature" | "mastercard-black" | "renner"

const CARD_PRESETS: Record<
  CardPresetKey,
  {
    label: string
    network: string
    gradientFrom: string
    gradientTo: string
    logo: string
    accentClass: string
  }
> = {
  nubank: {
    label: "Nubank Roxo",
    network: "Mastercard",
    gradientFrom: "#431372",
    gradientTo: "#a259ff",
    logo: "/cards/nubank.svg",
    accentClass: "text-white",
  },
  magalu: {
    label: "Magalu",
    network: "Visa",
    gradientFrom: "#0079f2",
    gradientTo: "#64e3ff",
    logo: "/cards/magalu.svg",
    accentClass: "text-white",
  },
  renner: {
    label: "Cartão Renner",
    network: "Visa",
    gradientFrom: "#a0001e",
    gradientTo: "#ff3b4d",
    logo: "/cards/renner.svg",
    accentClass: "text-white",
  },
  "visa-signature": {
    label: "Visa Signature",
    network: "Visa",
    gradientFrom: "#0f172a",
    gradientTo: "#1e293b",
    logo: "/cards/visa.svg",
    accentClass: "text-slate-100",
  },
  "mastercard-black": {
    label: "Mastercard Black",
    network: "Mastercard",
    gradientFrom: "#111111",
    gradientTo: "#2c2c2c",
    logo: "/cards/mastercard.svg",
    accentClass: "text-slate-100",
  },
}

interface FormState {
  nickname: string
  preset: CardPresetKey
  network: string
  limit: string
  closingDay: string
  dueDay: string
}

interface CardMetrics {
  currentCycleStart: Date
  currentCycleEnd: Date
  nextDueDate: Date
  spentInCycle: number
  utilization: number | null
  remainingLimit: number | null
  transactionsCount: number
}

export function CardsDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const [cards, setCards] = useState<PaymentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>({
    nickname: "",
    preset: "nubank",
    network: CARD_PRESETS.nubank.network,
    limit: "",
    closingDay: "5",
    dueDay: "15",
  })
  const [metrics, setMetrics] = useState<Record<string, CardMetrics>>({})

  const orderedCards = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const metricA = metrics[a.id]
        const metricB = metrics[b.id]
        const utilizationA = metricA?.utilization ?? 0
        const utilizationB = metricB?.utilization ?? 0
        return utilizationB - utilizationA
      }),
    [cards, metrics],
  )

  useEffect(() => {
    fetchCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    const preset = CARD_PRESETS[form.preset]
    setForm((prev) => ({
      ...prev,
      network: preset.network,
    }))
  }, [form.preset])

  const fetchCards = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (error) {
      toast({
        title: "Erro ao carregar cartões",
        description: error.message,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    const normalized = (data || []).map((card) => {
      const preset = CARD_PRESETS[card.brand as CardPresetKey] ?? CARD_PRESETS.nubank
      return {
        ...card,
        gradient_from: card.gradient_from || preset.gradientFrom,
        gradient_to: card.gradient_to || preset.gradientTo,
        network: card.network || preset.network,
      }
    })

    setCards(normalized)
    setLoading(false)

    if ((data || []).length) {
      await fetchMetrics(normalized)
    } else {
      setMetrics({})
    }
  }

  const fetchMetrics = async (cardList: PaymentCard[]) => {
    const cardIds = cardList.map((card) => card.id)
    if (!cardIds.length) return

    const rangeStart = cardList.reduce((earliest, card) => {
      const { currentCycleStart } = calculateCycle(card.closing_day, card.due_day)
      return currentCycleStart < earliest ? currentCycleStart : earliest
    }, new Date())

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, amount, transaction_date, type, card_id")
      .eq("user_id", userId)
      .in("card_id", cardIds)
      .gte("transaction_date", rangeStart.toISOString().split("T")[0])

    if (error) {
      toast({
        title: "Erro ao carregar gastos dos cartões",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    const metricsMap: Record<string, CardMetrics> = {}

    cardList.forEach((card) => {
      const cycle = calculateCycle(card.closing_day, card.due_day)
      const cardTransactions =
        transactions?.filter(
          (tx) =>
            tx.card_id === card.id &&
            tx.type === "expense" &&
            new Date(tx.transaction_date) >= cycle.currentCycleStart &&
            new Date(tx.transaction_date) <= cycle.currentCycleEnd,
        ) ?? []

      const spent = cardTransactions.reduce((sum, tx) => sum + Number.parseFloat(tx.amount.toString()), 0)
      const utilization =
        card.credit_limit && card.credit_limit > 0 ? Math.min(1, spent / Number(card.credit_limit)) : null
      const remainingLimit =
        card.credit_limit && card.credit_limit > 0 ? Math.max(0, Number(card.credit_limit) - spent) : null

      metricsMap[card.id] = {
        ...cycle,
        spentInCycle: spent,
        utilization,
        remainingLimit,
        transactionsCount: cardTransactions.length,
      }
    })

    setMetrics(metricsMap)
  }

  const calculateCycle = (closingDay: number, dueDay: number): CardMetrics => {
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

    const safeClosing = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), Math.min(closingDay, daysInMonth(date.getFullYear(), date.getMonth())))

    const currentReference = safeClosing(todayMidnight)
    const cycleEnd =
      todayMidnight >= currentReference
        ? currentReference
        : safeClosing(new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() - 1, 1))

    const previousClosing = safeClosing(new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, 1))
    const cycleStart = new Date(previousClosing)
    cycleStart.setDate(previousClosing.getDate() + 1)

    const nextDueDateBase = new Date(cycleEnd)
    nextDueDateBase.setMonth(nextDueDateBase.getMonth() + 1)
    const dueDaySafe = Math.min(dueDay, daysInMonth(nextDueDateBase.getFullYear(), nextDueDateBase.getMonth()))
    nextDueDateBase.setDate(dueDaySafe)

    return {
      currentCycleStart: cycleStart,
      currentCycleEnd: cycleEnd,
      nextDueDate: nextDueDateBase,
      spentInCycle: 0,
      utilization: null,
      remainingLimit: null,
      transactionsCount: 0,
    }
  }

  const handleCreateCard = async () => {
    if (!form.nickname.trim()) {
      toast({
        title: "Informe um nome para o cartão",
        variant: "destructive",
      })
      return
    }

    const preset = CARD_PRESETS[form.preset]

    const payload = {
      user_id: userId,
      nickname: form.nickname.trim(),
      brand: form.preset,
      network: form.network,
      credit_limit: form.limit ? Number.parseFloat(form.limit) : null,
      closing_day: Number.parseInt(form.closingDay),
      due_day: Number.parseInt(form.dueDay),
      gradient_from: preset.gradientFrom,
      gradient_to: preset.gradientTo,
    }

    const { error } = await supabase.from("cards").insert(payload)

    if (error) {
      toast({
        title: "Erro ao adicionar cartão",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Cartão adicionado com sucesso",
      description: `${form.nickname} disponível para novos lançamentos.`,
    })

    setOpen(false)
    setForm({
      nickname: "",
      preset: "nubank",
      network: CARD_PRESETS.nubank.network,
      limit: "",
      closingDay: "5",
      dueDay: "15",
    })

    await fetchCards()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cards").delete().eq("id", id)

    if (error) {
      toast({
        title: "Erro ao remover cartão",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Cartão removido",
      description: "Você pode associar um novo cartão a qualquer momento.",
    })

    await fetchCards()
  }

  const handleSync = async () => {
    setSyncing(true)
    await fetchCards()
    setSyncing(false)
  }

  const daysUntil = (date: Date) => {
    const diff = Math.ceil((date.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
    return diff
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    })

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Cartões</h2>
          <p className="text-sm text-muted-foreground">
            Organize gastos por cartão, acompanhe limite, fechamento e vencimento da fatura.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <CreditCard className="h-4 w-4" />
                Novo Cartão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar cartão</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="nickname">Nome exibido</Label>
                  <Input
                    id="nickname"
                    value={form.nickname}
                    onChange={(event) => setForm((prev) => ({ ...prev, nickname: event.target.value }))}
                    placeholder="Ex.: Cartão Nubank"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Modelo</Label>
                  <Select
                    value={form.preset}
                    onValueChange={(value: CardPresetKey) => setForm((prev) => ({ ...prev, preset: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CARD_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="network">Bandeira</Label>
                  <Input
                    id="network"
                    value={form.network}
                    onChange={(event) => setForm((prev) => ({ ...prev, network: event.target.value }))}
                    placeholder="Visa, Mastercard..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="limit">Limite (opcional)</Label>
                    <Input
                      id="limit"
                      value={form.limit}
                      onChange={(event) => setForm((prev) => ({ ...prev, limit: event.target.value }))}
                      placeholder="R$ 5.000,00"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="closingDay">Fechamento</Label>
                    <Input
                      id="closingDay"
                      value={form.closingDay}
                      onChange={(event) => setForm((prev) => ({ ...prev, closingDay: event.target.value }))}
                      type="number"
                      min={1}
                      max={31}
                    />
                  </div>
                </div>

                <div className="grid gap-2 md:w-1/2">
                  <Label htmlFor="dueDay">Vencimento</Label>
                  <Input
                    id="dueDay"
                    value={form.dueDay}
                    onChange={(event) => setForm((prev) => ({ ...prev, dueDay: event.target.value }))}
                    type="number"
                    min={1}
                    max={31}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateCard}>Salvar cartão</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Skeleton className="h-64 rounded-3xl" key={index} />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <UICard className="border-dashed border-muted-foreground/30 bg-muted/20 text-center">
          <CardHeader>
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
            <CardTitle>Ainda sem cartões</CardTitle>
            <CardDescription>
              Adicione seus cartões de crédito ou débito para acompanhar gastos por fatura.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Novo Cartão
            </Button>
          </CardFooter>
        </UICard>
      ) : (
        <ScrollArea className="h-[520px] pr-4">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {orderedCards.map((card) => {
              const preset = CARD_PRESETS[card.brand as CardPresetKey] ?? CARD_PRESETS.nubank
              const cardMetrics = metrics[card.id]
              const utilization = cardMetrics?.utilization ?? 0
              const days = cardMetrics ? daysUntil(cardMetrics.nextDueDate) : null

              return (
                <UICard
                  key={card.id}
                  className="group relative overflow-hidden border-0 bg-gradient-to-br text-white shadow-lg"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${card.gradient_from || preset.gradientFrom}, ${card.gradient_to || preset.gradientTo})`,
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),transparent)] transition-opacity group-hover:opacity-90" />
                  <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium uppercase tracking-widest opacity-90">{card.network}</span>
                      <Image src={preset.logo} alt={preset.label} width={56} height={24} />
                    </div>
                    <CardTitle className={cn("text-2xl font-semibold", preset.accentClass)}>{card.nickname}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs text-white/80">
                      <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur">
                        Fechamento dia {card.closing_day}
                      </Badge>
                      <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur">
                        Vencimento dia {card.due_day}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/70">Fatura atual</p>
                      <p className="text-3xl font-bold">
                        {cardMetrics ? formatCurrency(cardMetrics.spentInCycle) : formatCurrency(0)}
                      </p>
                      {card.credit_limit ? (
                        <p className="text-sm text-white/80">
                          Limite disponível {cardMetrics?.remainingLimit !== null ? formatCurrency(cardMetrics.remainingLimit!) : formatCurrency(Number(card.credit_limit))}
                        </p>
                      ) : (
                        <p className="text-sm text-white/80">Sem limite cadastrado</p>
                      )}
                    </div>
                    {card.credit_limit ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-white/70">
                          <span>Utilização</span>
                          <span>{Math.round((utilization || 0) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/20">
                          <div
                            className="h-2 rounded-full bg-white/80 transition-all"
                            style={{ width: `${Math.min(100, (utilization || 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="relative z-10 flex items-center justify-between text-xs text-white/80">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {cardMetrics?.transactionsCount || 0} lançamentos no ciclo
                    </span>
                    {cardMetrics ? (
                      <span className="font-medium">
                        {days !== null && days >= 0 ? `${days} dia(s) até o vencimento` : "Fatura vencida"}
                      </span>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                      onClick={() => handleDelete(card.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </UICard>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </section>
  )
}


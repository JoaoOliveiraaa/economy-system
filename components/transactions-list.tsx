"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Filter, PenSquare, Plus, Trash2 } from "lucide-react"

interface Transaction {
  id: string
  type: "income" | "expense"
  category: string
  amount: number
  description: string
  transaction_date: string
  card_id: string | null
  payment_method: string
  installment_group_id: string | null
  installment_index: number | null
  installment_total: number | null
  installment_amount: number | null
  bill_type: string | null
  bill_due_day: number | null
  card?: {
    id: string
    nickname: string
    brand: string
  }
}

const CATEGORIES = {
  income: ["Salário", "Aluguel", "Aposentadoria", "Freelance", "Bônus", "Outro"],
  expense: ["Alimentação", "Transporte", "Utilities", "Saúde", "Educação", "Lazer", "Outro"],
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
]

const BILL_TYPES = [
  { value: "light", label: "Energia elétrica" },
  { value: "water", label: "Água / Saneamento" },
  { value: "internet", label: "Internet / Telefonia" },
  { value: "gas", label: "Gás" },
  { value: "condominium", label: "Condomínio" },
  { value: "other", label: "Outra conta mensal" },
]

interface PaymentCardSelect {
  id: string
  nickname: string
  brand: string
}

export function TransactionsList({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<"income" | "expense">("expense")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [cards, setCards] = useState<PaymentCardSelect[]>([])
  const [cardId, setCardId] = useState("")
  const [cardFilter, setCardFilter] = useState("all")
  const [paymentMethod, setPaymentMethod] = useState("pix")
  const [installments, setInstallments] = useState("1")
  const [billType, setBillType] = useState<string | null>(null)
  const [billDueDay, setBillDueDay] = useState("5")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cardFilter])

  useEffect(() => {
    fetchCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (cardId) {
      setPaymentMethod("cartao_credito")
    }
  }, [cardId])

  useEffect(() => {
    if (type !== "expense") {
      setInstallments("1")
      setBillType(null)
    }
  }, [type])

  const fetchTransactions = async () => {
    setLoading(true)
    const query = supabase
      .from("transactions")
      .select("*, card:cards(id, nickname, brand)")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })

    if (cardFilter !== "all") {
      query.eq("card_id", cardFilter)
    }

    const { data, error } = await query
    if (error) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    setTransactions(data || [])
    setLoading(false)
  }

  const fetchCards = async () => {
    const { data } = await supabase
      .from("cards")
      .select("id, nickname, brand")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    setCards(data || [])
  }

  const handleAddTransaction = async () => {
    if (!category || !amount) return

    const perInstallmentValue = Number.parseFloat(amount)
    const numberOfInstallments = Number.parseInt(installments) || 1
    const groupId = numberOfInstallments > 1 ? crypto.randomUUID() : null

    const payloads = Array.from({ length: numberOfInstallments }, (_, index) => {
      const installmentAmount = perInstallmentValue

      const installmentDate = new Date(date)
      installmentDate.setMonth(installmentDate.getMonth() + index)
      const scheduledDate = installmentDate.toISOString().split("T")[0]

      return {
        user_id: userId,
        type,
        category,
        amount: installmentAmount,
        installment_amount: numberOfInstallments > 1 ? installmentAmount : null,
        description:
          numberOfInstallments > 1
            ? `${description ? `${description} • ` : ""}Parcela ${index + 1}/${numberOfInstallments}`
            : description,
        transaction_date: scheduledDate,
        card_id: cardId || null,
        payment_method: cardId ? "cartao_credito" : paymentMethod,
        installment_group_id: groupId,
        installment_index: numberOfInstallments > 1 ? index + 1 : null,
        installment_total: numberOfInstallments > 1 ? numberOfInstallments : null,
        bill_type: billType,
        bill_due_day: billType ? Number.parseInt(billDueDay) : null,
      }
    })

    const { error } = await supabase.from("transactions").insert(payloads)

    if (error) {
      toast({
        title: "Erro ao salvar transação",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Transação registrada",
      description:
        numberOfInstallments > 1
          ? `${numberOfInstallments} parcelas de ${perInstallmentValue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })} lançadas até ${payloads[payloads.length - 1].transaction_date}`
          : "Lançamento adicionado com sucesso.",
    })

    setAmount("")
    setDescription("")
    setCategory("")
    setDate(new Date().toISOString().split("T")[0])
    setCardId("")
    setPaymentMethod("pix")
    setInstallments("1")
    setBillType(null)
    setBillDueDay("5")
    fetchTransactions()
  }

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id)
    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      })
      return
    }
    toast({
      title: "Transação removida",
      description: "O lançamento foi excluído.",
    })
    fetchTransactions()
  }

  const openEdit = (transaction: Transaction) => {
    setEditTransaction({ ...transaction })
    setEditDialogOpen(true)
  }

  const handleUpdateTransaction = async () => {
    if (!editTransaction) return

    setEditing(true)
    const { error } = await supabase
      .from("transactions")
      .update({
        type: editTransaction.type,
        category: editTransaction.category,
        amount: Number.parseFloat(editTransaction.amount.toString()),
        description: editTransaction.description,
        transaction_date: editTransaction.transaction_date,
        card_id: editTransaction.card_id,
        payment_method: editTransaction.payment_method,
        installment_group_id: editTransaction.installment_group_id,
        installment_index: editTransaction.installment_index,
        installment_total: editTransaction.installment_total,
        installment_amount: editTransaction.installment_amount,
        bill_type: editTransaction.bill_type,
        bill_due_day: editTransaction.bill_due_day,
      })
      .eq("id", editTransaction.id)

    setEditing(false)

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Transação atualizada",
      description: "Alterações salvas com sucesso.",
    })
    setEditDialogOpen(false)
    setEditTransaction(null)
    fetchTransactions()
  }

  const methodLabel = (value: string) => PAYMENT_METHODS.find((method) => method.value === value)?.label ?? "Outro"

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Adicionar transação</CardTitle>
            <CardDescription>Crie lançamentos rápidos e associe-os aos cartões cadastrados.</CardDescription>
          </div>
          <Badge variant="outline" className="mt-2 w-fit rounded-full border-dashed px-4 py-1 text-xs uppercase">
            Registro manual
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

            <Select
              value={cardId || undefined}
              onValueChange={(value) => setCardId(value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Associar cartão (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cartão</SelectItem>
                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor"
            />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {cardId && type === "expense" ? (
            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium text-muted-foreground">Parcelas</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={installments}
                  onChange={(event) => setInstallments(event.target.value)}
                  placeholder="Nº de parcelas"
                />
                <div className="rounded-2xl border border-dashed border-muted bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  O valor será distribuído igualmente entre as parcelas, com vencimento mensal a partir da data escolhida.
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={Boolean(cardId)}>
              <SelectTrigger>
                <SelectValue placeholder="Método de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={type === "expense" ? billType ?? "none" : "none"}
              onValueChange={(value) => setBillType(value === "none" ? null : value)}
              disabled={type !== "expense"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Conta mensal (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conta mensal</SelectItem>
                {BILL_TYPES.map((bill) => (
                  <SelectItem key={bill.value} value={bill.value}>
                    {bill.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "expense" && billType ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr,auto]">
              <Input
                type="number"
                min={1}
                max={31}
                value={billDueDay}
                onChange={(event) => setBillDueDay(event.target.value)}
                placeholder="Dia de vencimento"
              />
              <div className="rounded-2xl border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                Acompanhe o vencimento desta conta mensal. Você poderá ver o status nas análises.
              </div>
            </div>
          ) : null}

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="resize-none"
          />

          <Button onClick={handleAddTransaction} className="w-full gap-2 rounded-full">
            <Plus className="w-4 h-4" />
            Adicionar Transação
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Histórico de transações</CardTitle>
            <CardDescription>{transactions.length} lançamento(s) encontrados</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtrar por cartão
            </div>
            <Select value={cardFilter} onValueChange={(value) => setCardFilter(value)}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Todos os cartões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40" />
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma transação registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead className="hidden sm:table-cell">Cartão</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Método</TableHead>
                    <TableHead className="hidden lg:table-cell">Conta mensal</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Parcelas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-20 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const isFuture = new Date(tx.transaction_date) > new Date()
                    return (
                      <TableRow
                        key={tx.id}
                        className={`hover:bg-muted/50 ${isFuture ? "opacity-60 italic" : ""}`}
                      >
                      <TableCell className="font-medium">
                        {new Date(tx.transaction_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {tx.card ? tx.card.nickname : "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{tx.category}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tx.type === "income" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
                        >
                          {tx.type === "income" ? "Receita" : "Despesa"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {methodLabel(tx.payment_method)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {tx.bill_type
                          ? BILL_TYPES.find((bill) => bill.value === tx.bill_type)?.label ??
                            (tx.bill_type === "other" ? "Outra conta" : tx.bill_type)
                          : "—"}
                        {tx.bill_due_day ? ` · vence dia ${tx.bill_due_day}` : ""}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-muted-foreground">{tx.description || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground">
                        {tx.installment_total ? `${tx.installment_index}/${tx.installment_total}` : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {tx.type === "income" ? "+" : "-"} R$ {Number.parseFloat(tx.amount.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(tx)}>
                            <PenSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(value) => {
          setEditDialogOpen(value)
          if (!value) setEditTransaction(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
          </DialogHeader>
          {editTransaction ? (
            <div className="grid gap-4 py-2">
              {editTransaction.installment_total ? (
                <div className="rounded-2xl border border-dashed border-muted bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  Parcela {editTransaction.installment_index}/{editTransaction.installment_total} do grupo{" "}
                  {editTransaction.installment_group_id?.slice(0, 8)}… Ajustes aqui afetam apenas esta parcela.
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={editTransaction.type}
                  onValueChange={(value: "income" | "expense") =>
                    setEditTransaction((prev) => (prev ? { ...prev, type: value, category: CATEGORIES[value][0] } : prev))
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
                  value={editTransaction.category}
                  onValueChange={(value) => setEditTransaction((prev) => (prev ? { ...prev, category: value } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[editTransaction.type].map((cat) => (
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
                  value={editTransaction.amount.toString()}
                  onChange={(event) =>
                    setEditTransaction((prev) => (prev ? { ...prev, amount: Number(event.target.value) } : prev))
                  }
                  placeholder="Valor"
                />
                <Input
                  type="date"
                  value={editTransaction.transaction_date}
                  onChange={(event) =>
                    setEditTransaction((prev) => (prev ? { ...prev, transaction_date: event.target.value } : prev))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={editTransaction.payment_method}
                  onValueChange={(value) =>
                    setEditTransaction((prev) => (prev ? { ...prev, payment_method: value } : prev))
                  }
                  disabled={Boolean(editTransaction.card_id)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Método de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={editTransaction.card_id ?? "none"}
                  onValueChange={(value) =>
                    setEditTransaction((prev) => (prev ? { ...prev, card_id: value === "none" ? null : value } : prev))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cartão associado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cartão</SelectItem>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={editTransaction.bill_type ?? "none"}
                  onValueChange={(value) =>
                    setEditTransaction((prev) => (prev ? { ...prev, bill_type: value === "none" ? null : value } : prev))
                  }
                  disabled={editTransaction.type !== "expense"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Conta mensal (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta mensal</SelectItem>
                    {BILL_TYPES.map((bill) => (
                      <SelectItem key={bill.value} value={bill.value}>
                        {bill.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={editTransaction.bill_due_day?.toString() ?? ""}
                  onChange={(event) =>
                    setEditTransaction((prev) =>
                      prev ? { ...prev, bill_due_day: Number.parseInt(event.target.value) || null } : prev,
                    )
                  }
                  disabled={editTransaction.type !== "expense" || !editTransaction.bill_type}
                  placeholder="Dia de vencimento"
                />
              </div>

              <Textarea
                value={editTransaction.description ?? ""}
                onChange={(event) =>
                  setEditTransaction((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                placeholder="Descrição"
                className="resize-none"
              />
            </div>
          ) : (
            <Skeleton className="h-40" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTransaction} disabled={editing} className="gap-2">
              {editing ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

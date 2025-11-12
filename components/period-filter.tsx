"use client"

import { Button } from "@/components/ui/button"

interface PeriodFilterProps {
  selectedPeriod: string
  onPeriodChange: (period: string) => void
}

export function PeriodFilter({ selectedPeriod, onPeriodChange }: PeriodFilterProps) {
  const periods = [
    { label: "3 Meses", value: "3m" },
    { label: "6 Meses", value: "6m" },
    { label: "1 Ano", value: "1y" },
    { label: "2 Anos", value: "2y" },
    { label: "Tudo", value: "all" },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={selectedPeriod === period.value ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange(period.value)}
          className="rounded-lg"
        >
          {period.label}
        </Button>
      ))}
    </div>
  )
}

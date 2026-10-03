// Ce que plusieurs pages calculent à partir des données : la période, ses ventes, la liste « à traiter ».

import { useMemo } from 'react'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { monthOf, monthsOf, inMonths, previousMonths, unmapped } from '@/calc.js'

export const LOW_STOCK = 5
export const isPack = (p) => p.components.length > 0

export function periodOptions(sales) {
  const years = new Set(sales.map((s) => monthOf(s.occurred_at).slice(0, 4)))
  years.add(String(new Date().getFullYear()))
  return [['12m', '12 derniers mois'], ...[...years].sort().reverse().map((y) => [y, `Année ${y}`]), ['all', 'Depuis le début']]
}

export function usePeriod() {
  const d = useData()
  const { period } = useUI()
  return useMemo(() => {
    const months = monthsOf(period, d.sales)
    const prev = period === 'all' ? null : previousMonths(months)
    return {
      period,
      months,
      label: periodOptions(d.sales).find(([v]) => v === period)?.[1] || period,
      sales: inMonths(d.sales, months),
      expenses: inMonths(d.expenses, months),
      prevSales: prev ? inMonths(d.sales, prev) : null,
      prevExpenses: prev ? inMonths(d.expenses, prev) : null,
    }
  }, [d, period])
}

// Tout ce qui demande une action : articles inconnus, coûts manquants, stock bas ou négatif.
export function useTodo() {
  const d = useData()
  return useMemo(() => {
    if (!d) return { unmapped: [], noCost: [], stock: [], count: 0 }
    const sold = new Set(d.sales.flatMap((s) => s.lines.map((l) => l.product_id)))
    const physical = d.products.filter((p) => p.active && !isPack(p))
    const out = {
      unmapped: unmapped(d.sales),
      noCost: physical.filter((p) => p.cost_cents == null),
      stock: physical.filter((p) => p.stock < 0 || (p.stock <= LOW_STOCK && sold.has(p.id))).sort((a, b) => a.stock - b.stock),
    }
    out.count = out.unmapped.length + out.noCost.length + out.stock.length
    return out
  }, [d])
}

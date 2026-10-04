// Ce que plusieurs pages calculent à partir des données : la période, ses ventes, la liste « à traiter ».

import { useMemo } from 'react'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { monthOf, rangeOf, inRange, unmapped, PRESETS, nightOf, byNight } from '@/calc.js'

export const LOW_STOCK = 5
export const isPack = (p) => p.components.length > 0

// [valeur, libellé, libellé court] : les raccourcis puis chaque année où il y a eu des ventes
export function periodOptions(sales) {
  const years = new Set(sales.map((s) => monthOf(s.occurred_at).slice(0, 4)))
  years.add(String(new Date().getFullYear()))
  return [...PRESETS, ...[...years].sort().reverse().map((y) => [y, `Année ${y}`, y])]
}

export function usePeriod() {
  const d = useData()
  const { period } = useUI()
  return useMemo(() => {
    const { unit, keys, prev } = rangeOf(period, d.sales)
    return {
      period,
      unit,
      keys,
      label: periodOptions(d.sales).find(([v]) => v === period)?.[1] || period,
      sales: inRange(d.sales, unit, keys),
      expenses: inRange(d.expenses, unit, keys),
      prevSales: prev ? inRange(d.sales, unit, prev) : null,
      prevExpenses: prev ? inRange(d.expenses, unit, prev) : null,
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

// La soirée en cours : celle de la dernière vente en caisse (SumUp ou espèces) de moins de 12 h, sinon null.
export const LIVE = ['sumup', 'cash']
export function useTonight() {
  const d = useData()
  return useMemo(() => {
    const last = d?.sales.find((s) => LIVE.includes(s.channel) && Date.now() - new Date(s.occurred_at).getTime() < 12 * 3600e3)
    if (!last) return null
    const night = nightOf(last.occurred_at)
    const sales = d.sales.filter((s) => LIVE.includes(s.channel) && nightOf(s.occurred_at) === night)
    const n = byNight(sales)[0]
    // le nom le plus récent saisi ce soir-là
    return n && { ...n, event: sales.find((s) => s.event)?.event || '' }
  }, [d])
}

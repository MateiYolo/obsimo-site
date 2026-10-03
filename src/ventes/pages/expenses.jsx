// Dépenses hors coût de revient, groupées par mois, avec le total par catégorie.

import { useMemo } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Page, Empty } from '@/components/page'
import { Confirm } from '@/components/confirm'
import { PeriodSelect } from '@/components/period-select'
import { monthLabel } from '@/components/revenue-chart'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { usePeriod } from '@/lib/derived'
import { PAGES } from '@/lib/nav'
import { fmt, dateShort } from '@/lib/format'

export function Expenses() {
  const { run } = useStore()
  const { open } = useUI()
  const p = usePeriod()
  const total = p.expenses.reduce((a, e) => a + e.amount_cents, 0)
  const byCat = useMemo(() => {
    const m = {}
    for (const e of p.expenses) m[e.category] = (m[e.category] || 0) + e.amount_cents
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [p])
  const months = useMemo(() => {
    const out = []
    for (const e of p.expenses) {
      const k = String(e.occurred_at).slice(0, 7)
      let g = out[out.length - 1]
      if (!g || g.month !== k) out.push((g = { month: k, items: [], total: 0 }))
      g.items.push(e)
      g.total += e.amount_cents
    }
    return out
  }, [p])

  return (
    <Page
      title={PAGES.depenses.label}
      icon={PAGES.depenses.icon}
      count={p.expenses.length || null}
      actions={
        <>
          <PeriodSelect />
          <Button size="sm" onClick={() => open('expense')} aria-label="Nouvelle dépense">
            <Plus /> <span className="hidden sm:inline">Dépense</span>
          </Button>
        </>
      }
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      {p.expenses.length ? (
        <>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total sur la période</p>
            <p className="num mt-1 text-2xl font-semibold tracking-tight">{fmt(total)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {byCat.map(([c, v]) => (
                <Badge key={c} variant="secondary" className="gap-1.5 font-normal">
                  <span className="capitalize">{c}</span>
                  <span className="num text-muted-foreground">{fmt(v)}</span>
                </Badge>
              ))}
            </div>
          </div>
          {months.map((g) => (
            <section key={g.month}>
              <div className="mb-2 flex items-baseline justify-between px-1 text-xs">
                <span className="font-medium first-letter:uppercase">{monthLabel(g.month, true)}</span>
                <span className="num text-muted-foreground">{fmt(g.total)}</span>
              </div>
              <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                {g.items.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 pr-2 pl-4 text-sm">
                    <span className="num w-14 shrink-0 text-xs text-muted-foreground">{dateShort(`${String(e.occurred_at).slice(0, 10)}T12:00:00Z`)}</span>
                    <span className="min-w-0 flex-1 truncate">{e.label}</span>
                    <Badge variant="outline" className="hidden font-normal text-muted-foreground capitalize sm:inline-flex">
                      {e.category}
                    </Badge>
                    <span className="num w-20 text-right">{fmt(e.amount_cents)}</span>
                    <Confirm title="Supprimer cette dépense ?" description={`${e.label} · ${fmt(e.amount_cents)}`} onConfirm={() => run(() => api('expense-delete', { id: e.id }), 'Dépense supprimée')}>
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100" aria-label={`Supprimer ${e.label}`}>
                        <Trash2 />
                      </Button>
                    </Confirm>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <Empty
          icon={Wallet}
          title="Aucune dépense sur la période"
          action={
            <Button size="sm" onClick={() => open('expense')}>
              <Plus /> Ajouter une dépense
            </Button>
          }
        >
          Envois, emballages, stand, pub… tout ce qui n’est pas déjà dans le coût de revient des produits. Elles sont déduites du résultat.
        </Empty>
      )}
    </Page>
  )
}

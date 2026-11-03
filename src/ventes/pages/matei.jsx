// L'ardoise de Matei, sur une page à part (discrète, dans le menu) : ce qu'on lui doit et d'où ça vient (départ,
// vinyles, synchros), ce qu'on lui a donné, et tout l'historique. Les synchros n'entrent pas dans les chiffres du merch.

import { useMemo, useState } from 'react'
import { Banknote, Clapperboard, Disc3, Flag, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Page } from '@/components/page'
import { Confirm } from '@/components/confirm'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { monthOf } from '@/calc.js'
import { api } from '@/lib/api'
import { useData, useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useMatei, synchroDue } from '@/lib/derived'
import { PAGES } from '@/lib/nav'
import { fmt, num, plural, dateMedium } from '@/lib/format'
import { cn } from '@/lib/utils'

const monthLabel = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function Matei() {
  const m = useMatei()
  const { open } = useUI()

  return (
    <Page
      title={m.name}
      icon={PAGES.matei.icon}
      className="mx-auto w-full max-w-2xl space-y-6"
      actions={
        <Button size="sm" variant="ghost" className="text-muted-foreground max-sm:hidden" onClick={() => open('synchro')}>
          <Plus /> Synchro
        </Button>
      }
    >
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">Reste à lui donner</p>
        <p className={cn('num mt-1 text-5xl font-semibold tracking-tight', m.balance < 0 && 'text-destructive')}>{fmt(m.balance)}</p>
        {m.balance < 0 && <p className="mt-1 text-sm text-destructive">Tu lui as donné {fmt(-m.balance)} d’avance.</p>}

        <dl className="mt-5 space-y-2 text-sm">
          {m.opening > 0 && <Row icon={Flag} label="Dû au départ" hint={m.royalties.since ? `au ${dateMedium(m.royalties.since)}` : null} value={m.opening} />}
          <Row icon={Disc3} label="Vinyles" hint={`${fmt(m.royalties.products[0]?.product.royalty_cents ?? 200)} par vinyle, une fois le tirage remboursé`} value={m.vinyls} />
          <Row icon={Clapperboard} label="Synchros" hint={m.synchros.length ? plural(m.synchros.length, 'synchro') : 'aucune pour l’instant'} value={m.fromSynchros} />
          <div className="border-t pt-2">
            <Row icon={Banknote} label="Déjà donné" hint={m.payouts.length ? plural(m.payouts.length, 'versement') : null} value={-m.paid} />
          </div>
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => open('payout')}>
            <Banknote /> Je l’ai payé
          </Button>
          <Button size="lg" variant="outline" onClick={() => open('synchro')}>
            <Clapperboard /> Synchro
          </Button>
        </div>
      </section>

      <History />
      <Vinyls />
    </Page>
  )
}

function Row({ icon: Icon, label, hint, value }) {
  return (
    <div className="flex items-baseline gap-3">
      <Icon className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
      <dt className="min-w-0 flex-1">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </dt>
      <dd className={cn('num font-medium', value < 0 && 'text-muted-foreground')}>
        {value > 0 ? '+' : value < 0 ? '−' : ''}
        {fmt(Math.abs(value))}
      </dd>
    </div>
  )
}

// Tout ce qui a fait bouger l'ardoise, du plus récent au plus ancien. Les vinyles sont regroupés par mois.
function History() {
  const d = useData()
  const m = useMatei()
  const { run } = useStore()
  const { open } = useUI()
  const [filter, setFilter] = useState('all')

  const rows = useMemo(() => {
    const out = []
    const byMonth = new Map()
    for (const s of d.sales) {
      const due = m.royalties.bySale.get(s.id)
      if (!due) continue
      const key = monthOf(s.occurred_at)
      const r = byMonth.get(key) || { key: `v-${key}`, kind: 'vinyl', date: `${key}-01`, sort: s.occurred_at, amount: 0, label: `Vinyles · ${monthLabel(key)}` }
      r.amount += due
      r.count = (r.count || 0) + 1
      if (s.occurred_at > r.sort) r.sort = s.occurred_at
      byMonth.set(key, r)
    }
    out.push(...byMonth.values())
    for (const s of m.synchros) out.push({ key: `s-${s.id}`, kind: 'synchro', sort: s.date, date: s.date, amount: synchroDue(s), label: s.label, item: s })
    for (const e of m.payouts) out.push({ key: `p-${e.id}`, kind: 'payout', sort: String(e.occurred_at), date: String(e.occurred_at).slice(0, 10), amount: -e.amount_cents, label: e.label, item: e })
    if (m.opening && m.royalties.since) out.push({ key: 'opening', kind: 'opening', sort: m.royalties.since, date: m.royalties.since.slice(0, 10), amount: m.opening, label: 'Dû au départ', detail: 'les ventes d’avant, comptées d’un bloc' })
    return out.sort((a, b) => (a.sort < b.sort ? 1 : -1))
  }, [d, m])

  const shown = rows.filter((r) => filter === 'all' || r.kind === filter)
  const ICON = { vinyl: Disc3, synchro: Clapperboard, payout: Banknote, opening: Flag }

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">Historique</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-2 sm:px-3">
        <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v)} className="mx-3 justify-start">
          {[
            ['all', 'Tout'],
            ['payout', 'Versements'],
            ['synchro', 'Synchros'],
            ['vinyl', 'Vinyles'],
          ].map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-foreground">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {!shown.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Rien ici pour l’instant.</p>}
        <ul className="divide-y">
          {shown.map((r) => {
            const Icon = ICON[r.kind]
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', r.amount < 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                  <Icon className="size-4" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  disabled={r.kind !== 'synchro'}
                  onClick={() => r.kind === 'synchro' && open('synchro', { synchro: r.item })}
                >
                  <span className="block truncate text-sm">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.kind === 'vinyl' ? plural(r.count, 'vente') : dateMedium(`${r.date}T12:00:00Z`)}
                    {r.detail && ` · ${r.detail}`}
                  </span>
                </button>
                <span className={cn('num shrink-0 text-sm font-medium', r.amount < 0 && 'text-success')}>
                  {r.amount < 0 ? '−' : '+'}
                  {fmt(Math.abs(r.amount))}
                </span>
                {(r.kind === 'synchro' || r.kind === 'payout') && (
                  <Confirm
                    title={r.kind === 'synchro' ? 'Supprimer cette synchro ?' : 'Supprimer ce versement ?'}
                    description={`${r.label} · ${fmt(Math.abs(r.amount))}`}
                    onConfirm={() =>
                      run(() => (r.kind === 'synchro' ? api('synchro-delete', { id: r.item.id }) : api('expense-delete', { id: r.item.id })), 'Supprimé')
                    }
                  >
                    <Button variant="ghost" size="icon-sm" className="-mr-1 shrink-0 text-muted-foreground" aria-label="Supprimer">
                      <Trash2 />
                    </Button>
                  </Confirm>
                )}
              </li>
            )
          })}
        </ul>
        <p className="px-3 text-xs text-muted-foreground">+ ce que tu lui dois, − ce que tu lui as donné. Touche une synchro pour la modifier.</p>
      </CardContent>
    </Card>
  )
}

// Où en est chaque vinyle : le reversement démarre une fois son tirage rentabilisé.
function Vinyls() {
  const { royalties: r } = useMatei()
  if (!r.products.length) return null
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-medium">Par vinyle</CardTitle>
        <CardDescription className="text-xs">Hors disquaires et dons.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {r.products.map((x) => {
          const left = x.threshold - x.units
          return (
            <div key={x.product.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="min-w-0 truncate">{x.product.name}</span>
              <span className="num text-right">{fmt(x.due)}</span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', left > 0 ? 'bg-foreground/40' : 'bg-success')} style={{ width: `${x.threshold ? Math.min(100, (x.units / x.threshold) * 100) : 100}%` }} />
              </div>
              <span className="col-span-2 text-xs text-muted-foreground">
                {left > 0 ? `${num.format(x.units)} / ${num.format(x.threshold)} vendus · ça commence au ${num.format(x.threshold + 1)}ᵉ` : `${plural(x.units, 'vendu')} · ${plural(x.paidUnits, 'exemplaire')} × ${fmt(x.product.royalty_cents)}`}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

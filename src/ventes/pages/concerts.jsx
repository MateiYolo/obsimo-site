// Concerts : une ligne par soirée (ventes en caisse SumUp et espèces), clic → les ventes de la soirée.

import { useMemo } from 'react'
import { ArrowRight, Ticket } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Page, Empty } from '@/components/page'
import { PeriodSelect } from '@/components/period-select'
import { byNight } from '@/calc.js'
import { usePeriod } from '@/lib/derived'
import { navigate } from '@/lib/router'
import { PAGES } from '@/lib/nav'
import { fmt, dayLabel, num } from '@/lib/format'

export function Concerts() {
  const p = usePeriod()
  const nights = useMemo(() => byNight(p.sales), [p])
  const t = nights.reduce((a, n) => ({ revenue: a.revenue + n.revenue, items: a.items + n.items, count: a.count + n.count }), { revenue: 0, items: 0, count: 0 })
  const best = nights.reduce((m, n) => Math.max(m, n.revenue), 0)

  return (
    <Page title={PAGES.concerts.label} icon={PAGES.concerts.icon} count={nights.length || null} actions={<PeriodSelect />} className="space-y-6">
      {nights.length ? (
        <>
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-card [&>*:not(:last-child)]:border-r">
            {[
              ['CA des concerts', fmt(t.revenue, true)],
              ['Moyenne par soir', fmt(Math.round(t.revenue / nights.length), true)],
              ['Panier moyen', fmt(t.count ? Math.round(t.revenue / t.count) : 0)],
            ].map(([k, v]) => (
              <div key={k} className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="num mt-1 text-lg font-semibold tracking-tight sm:text-xl">{v}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Soirée</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ventes</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Articles</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Espèces</TableHead>
                  <TableHead className="hidden w-40 md:table-cell" />
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {nights.map((n) => (
                  <TableRow key={n.night} className="group cursor-pointer active:bg-accent" onClick={() => navigate('ventes', { nuit: n.night })}>
                    <TableCell className="pl-4 whitespace-normal">
                      <p className="font-medium">{n.events.size ? [...n.events].join(', ') : <span className="text-muted-foreground">Concert sans nom</span>}</p>
                      <p className="text-xs text-muted-foreground first-letter:uppercase">{dayLabel(n.night)}</p>
                    </TableCell>
                    <TableCell className="num hidden text-right sm:table-cell">{num.format(n.count)}</TableCell>
                    <TableCell className="num hidden text-right sm:table-cell">{num.format(n.items)}</TableCell>
                    <TableCell className="num hidden text-right text-muted-foreground md:table-cell">{n.cash ? fmt(n.cash) : '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-2" style={{ width: `${(n.revenue / best) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {fmt(n.revenue)}
                      <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                        {n.count} vente{n.count > 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="pr-3">
                      <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Une vente après minuit compte pour la soirée de la veille. Le nom du concert vient des dates Bandsintown, ou de la saisie.</p>
        </>
      ) : (
        <Empty icon={Ticket} title="Aucun concert sur la période">
          Les ventes en caisse SumUp et en espèces sont regroupées ici par soirée.
        </Empty>
      )}
    </Page>
  )
}

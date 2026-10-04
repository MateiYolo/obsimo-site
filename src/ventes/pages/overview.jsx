// Vue d'ensemble : ce qui demande une action, chiffres clés (comparés à la période précédente), CA par heure/jour/mois,
// meilleurs produits, répartition par canal, derniers concerts et dernières ventes.

import { useMemo } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ChartColumn, Download, Info, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Page } from '@/components/page'
import { PeriodSelect } from '@/components/period-select'
import { RevenueChart, bucketLabel } from '@/components/revenue-chart'
import { ChannelIcon, ChannelDot } from '@/components/channel'
import { SERIES, SERIES_COLOR, summary, byBucket, byProduct, byNight, metrics } from '@/calc.js'
import { useData } from '@/lib/store'
import { usePeriod, useTodo, isPack } from '@/lib/derived'
import { usePref } from '@/lib/prefs'
import { href } from '@/lib/router'
import { downloadCsv } from '@/lib/actions'
import { PAGES } from '@/lib/nav'
import { fmt, num, dayLabel, dateShort, time } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Overview() {
  const d = useData()
  const p = usePeriod()
  const todo = useTodo()
  const [view, setView] = usePref('chart', 'chart')

  const t = useMemo(() => summary(p.sales, p.expenses), [p])
  const prev = useMemo(() => (p.prevSales ? summary(p.prevSales, p.prevExpenses) : null), [p])
  const rows = useMemo(() => byBucket(p.sales, p.unit, p.keys), [p])
  const products = useMemo(() => byProduct(p.sales, d.products), [p, d])
  const nights = useMemo(() => byNight(p.sales), [p])
  const stockValue = d.products.reduce((a, x) => a + (isPack(x) ? 0 : Math.max(0, x.stock) * (x.cost_cents || 0)), 0)
  const stockItems = d.products.reduce((a, x) => a + (isPack(x) ? 0 : Math.max(0, x.stock)), 0)
  const marginPct = t.revenue ? Math.round((t.margin / t.revenue) * 100) : 0
  const channels = SERIES.map((s) => ({ ...s, value: rows.reduce((a, r) => a + r.values[s.key], 0) })).filter((s) => s.value > 0)

  return (
    <Page
      title={PAGES.apercu.label}
      icon={PAGES.apercu.icon}
      actions={
        <>
          <PeriodSelect />
          <Button variant="ghost" size="sm" onClick={() => downloadCsv(`obsimo-ventes-${p.period}.csv`, p.sales, d.products)} className="text-muted-foreground" aria-label="Exporter en CSV">
            <Download /> <span className="hidden sm:inline">Export</span>
          </Button>
        </>
      }
      className="space-y-6"
    >
      {todo.count > 0 && (
        <a href={href('a-traiter')} className="group flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-2.5 text-sm transition-colors hover:bg-warning/10">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">
              {todo.count} point{todo.count > 1 ? 's' : ''} à traiter
            </span>
            <span className="text-muted-foreground">
              {' · '}
              {[
                todo.unmapped.length && `${todo.unmapped.length} article${todo.unmapped.length > 1 ? 's' : ''} à associer`,
                todo.noCost.length && `${todo.noCost.length} coût${todo.noCost.length > 1 ? 's' : ''} manquant${todo.noCost.length > 1 ? 's' : ''}`,
                todo.stock.length && `${todo.stock.length} stock${todo.stock.length > 1 ? 's' : ''} bas`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </a>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4 [&>*]:border-border max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r">
        <Stat label="Chiffre d’affaires" value={fmt(t.revenue, true)} delta={delta(t.revenue, prev?.revenue)} foot={`${num.format(t.count)} vente${t.count > 1 ? 's' : ''} · ${num.format(t.items)} article${t.items > 1 ? 's' : ''}`} help="Total encaissé, frais de port compris, remboursements déduits." />
        <Stat
          label="Marge"
          value={fmt(t.margin, true)}
          delta={delta(t.margin, prev?.margin)}
          foot={`${marginPct} % du CA`}
          help={`CA moins commissions (${fmt(t.fees, true)}) et coût de revient des articles vendus (${fmt(t.cogs, true)}).`}
          warn={t.unknownCost ? `${t.unknownCost} article${t.unknownCost > 1 ? 's' : ''} sans coût de revient : marge surestimée` : null}
        />
        <Stat label="Résultat" value={fmt(t.result, true)} negative={t.result < 0} delta={delta(t.result, prev?.result)} foot={`après ${fmt(t.expenses, true)} de dépenses`} help="Marge moins les dépenses saisies (envois, stand, pub…)." />
        <Stat label="Stock" value={fmt(stockValue, true)} foot={`${num.format(stockItems)} articles au prix de revient`} help="Valeur actuelle du stock, au coût de revient. Ne dépend pas de la période." />
      </div>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-sm font-medium">Chiffre d’affaires par {UNIT[p.unit]}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <ChannelDot series={s.key} className="rounded-[2px]" />
                {s.label}
              </span>
            ))}
          </CardDescription>
          <CardAction>
            <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && setView(v)}>
              <ToggleGroupItem value="chart" aria-label="Graphique" className="px-2">
                <ChartColumn />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tableau" className="px-2">
                <Table2 />
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="px-3 sm:px-5">{view === 'table' ? <BucketTable rows={rows} unit={p.unit} /> : <RevenueChart rows={rows} unit={p.unit} />}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="gap-3 py-5 lg:col-span-3">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium">Meilleurs produits</CardTitle>
            <CardDescription className="text-xs">Par CA des articles, hors frais de port</CardDescription>
            <CardAction>
              <LinkButton to="produits">Tous</LinkButton>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
            {products.length ? (
              <ul className="space-y-3">
                {products.slice(0, 6).map((r) => (
                  <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      {r.name}
                      {!r.product && <span className="ml-2 text-xs text-warning">à associer</span>}
                    </span>
                    <span className="num text-right">
                      {fmt(r.revenue, true)} <span className="ml-1 text-xs text-muted-foreground">× {r.qty}</span>
                    </span>
                    <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(r.revenue / products[0].revenue) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 py-5 lg:col-span-2">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium">Par canal</CardTitle>
            <CardDescription className="text-xs">Part du chiffre d’affaires</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            {channels.length ? (
              <>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                  {channels.map((c) => (
                    <div key={c.key} style={{ width: `${(c.value / t.revenue) * 100}%`, background: SERIES_COLOR[c.key] }} />
                  ))}
                </div>
                <ul className="space-y-2.5 text-sm">
                  {channels.map((c) => (
                    <li key={c.key} className="flex items-center gap-2">
                      <ChannelDot series={c.key} />
                      <span>{c.label}</span>
                      <span className="num ml-auto">{fmt(c.value, true)}</span>
                      <span className="num w-10 text-right text-xs text-muted-foreground">{Math.round((c.value / t.revenue) * 100)} %</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Rien sur la période.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium">Derniers concerts</CardTitle>
            <CardAction>
              <LinkButton to="concerts">Tous</LinkButton>
            </CardAction>
          </CardHeader>
          <CardContent className="px-2">
            {nights.length ? (
              <ul>
                {nights.slice(0, 5).map((n) => (
                  <li key={n.night}>
                    <a href={href('ventes', { nuit: n.night })} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{n.events.size ? [...n.events].join(', ') : <span className="text-muted-foreground">Concert sans nom</span>}</span>
                        <span className="block text-xs text-muted-foreground first-letter:uppercase">{dayLabel(n.night)}</span>
                      </span>
                      <span className="text-right">
                        <span className="num block">{fmt(n.revenue, true)}</span>
                        <span className="text-xs text-muted-foreground">{n.items} art.</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune vente en concert sur la période.</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium">Dernières ventes</CardTitle>
            <CardAction>
              <LinkButton to="ventes">Toutes</LinkButton>
            </CardAction>
          </CardHeader>
          <CardContent className="px-2">
            <RecentSales sales={d.sales.slice(0, 5)} products={d.products} />
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}

const UNIT = { hour: 'heure', day: 'jour', month: 'mois' }

const delta = (cur, prev) => (prev == null || prev <= 0 ? null : ((cur - prev) / prev) * 100)

function Stat({ label, value, delta, foot, help, warn, negative }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {help && (
          <Popover>
            <PopoverTrigger className="-m-3 p-3 opacity-60 hover:opacity-100" aria-label={`À propos : ${label}`}>
              <Info className="size-3" />
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 text-xs">
              {help}
              {delta != null && <p className="mt-2 text-muted-foreground">La flèche compare à la période précédente de même durée.</p>}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn('num text-xl font-semibold tracking-tight sm:text-2xl', negative && 'text-destructive')}>{value}</span>
        {delta != null && Number.isFinite(delta) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('num inline-flex items-center text-xs font-medium', delta >= 0 ? 'text-success' : 'text-destructive')}>
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(Math.round(delta))} %
              </span>
            </TooltipTrigger>
            <TooltipContent>Par rapport à la période précédente de même durée</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="text-xs text-muted-foreground sm:truncate">{foot}</div>
      {warn && (
        <div className="mt-1 flex items-start gap-1 text-xs text-warning">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          <a href={href('a-traiter')} className="hover:underline">
            {warn}
          </a>
        </div>
      )}
    </div>
  )
}

function LinkButton({ to, children }) {
  return (
    <Button variant="ghost" size="xs" asChild className="text-muted-foreground pointer-coarse:h-9 pointer-coarse:px-3">
      <a href={href(to)}>
        {children} <ArrowRight />
      </a>
    </Button>
  )
}

export function RecentSales({ sales, products }) {
  const name = (l) => products.find((x) => x.id === l.product_id)?.name || l.label
  if (!sales.length) return <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune vente.</p>
  return (
    <ul>
      {sales.map((s) => (
        <li key={s.id}>
          <a href={href('ventes', { vente: s.id })} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent">
            <ChannelIcon channel={s.channel} />
            <span className="min-w-0 flex-1 truncate">{s.lines.map((l) => `${l.qty > 1 ? `${l.qty} × ` : ''}${name(l)}`).join(', ')}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {dateShort(s.occurred_at)} · {time(s.occurred_at)}
            </span>
            <span className={cn('num w-16 text-right', s.status !== 'paid' && 'text-muted-foreground line-through')}>{fmt(metrics(s).revenue || s.total_cents)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function BucketTable({ rows, unit }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="first-letter:uppercase">{UNIT[unit]}</TableHead>
          {SERIES.map((s) => (
            <TableHead key={s.key} className="text-right">
              {s.label}
            </TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Articles</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...rows].reverse().map((r) => (
          <TableRow key={r.key}>
            <TableCell className="first-letter:uppercase">{bucketLabel(unit, r.key, true)}</TableCell>
            {SERIES.map((s) => (
              <TableCell key={s.key} className={cn('num text-right', !r.values[s.key] && 'text-muted-foreground/50')}>
                {r.values[s.key] ? fmt(r.values[s.key]) : '—'}
              </TableCell>
            ))}
            <TableCell className="num text-right font-medium">{fmt(r.total)}</TableCell>
            <TableCell className="num text-right text-muted-foreground">{r.items}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

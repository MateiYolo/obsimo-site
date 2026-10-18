// Accueil : l'essentiel, sans réglage de période. La soirée en cours (au stand), où en est chaque produit (frais
// remboursés ou pas, et combien il en reste à vendre), les ventes du mois et les dernières ventes.
// Le détail des comptes est dans « Chiffres ».

import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Page } from '@/components/page'
import { RevenueChart } from '@/components/revenue-chart'
import { ChannelIcon } from '@/components/channel'
import { byBucket, metrics, payback, rangeOf } from '@/calc.js'
import { useData } from '@/lib/store'
import { useRoyalties, useTodo, useTonight } from '@/lib/derived'
import { href } from '@/lib/router'
import { PAGES } from '@/lib/nav'
import { fmt, num, plural, dateShort, time } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Overview() {
  const d = useData()
  const todo = useTodo()
  const tonight = useTonight()
  // seulement ce qui fausse les chiffres ; le stock bas est dans « À traiter » et « Stock »
  const missing = todo.unmapped.length + todo.noCost.length

  return (
    <Page title={PAGES.apercu.label} icon={PAGES.apercu.icon} className="mx-auto w-full max-w-4xl space-y-8">
      {tonight && <Tonight n={tonight} />}

      {missing > 0 && (
        <a href={href('a-traiter')} className="group flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-2.5 text-sm transition-colors hover:bg-warning/10">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            {plural(missing, 'chose')} à compléter <span className="text-muted-foreground">pour que les chiffres soient justes</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </a>
      )}

      <Payback />
      <SalesNow />

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
    </Page>
  )
}

// Où en est chaque produit : tant que les frais ne sont pas remboursés, combien il en reste à vendre ; ensuite, le bonus.
function Payback() {
  const d = useData()
  const r = useRoyalties()
  const items = useMemo(() => payback(d.sales, d.products, Object.fromEntries(r.products.map((x) => [x.product.id, x.due]))), [d, r])
  if (!items.length) return null
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Tes produits</h2>
        <p className="text-sm text-muted-foreground">Les premières ventes remboursent les frais. Après, c’est du bonus.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((g) => (
          <div key={g.id} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-snug">{g.name}</p>
              {g.repaid && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                  <Check className="size-3.5" /> Remboursé
                </span>
              )}
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              {g.repaid ? (
                <>
                  <span className="num text-3xl font-semibold tracking-tight text-success">+{fmt(Math.max(0, g.bonus), true)}</span>
                  <span className="text-sm text-muted-foreground">de bonus</span>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">Encore</span>
                  <span className="num text-3xl font-semibold tracking-tight">{num.format(g.toSell)}</span>
                  <span className="text-sm text-muted-foreground">à vendre</span>
                </>
              )}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', g.repaid ? 'bg-success' : 'bg-foreground/70')} style={{ width: `${g.cost ? Math.min(100, (g.revenue / g.cost) * 100) : 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {g.repaid ? `${fmt(g.cost, true)} de frais remboursés` : `${fmt(g.revenue, true)} rentrés sur ${fmt(g.cost, true)} de frais`}
              {' · '}
              {g.stock > 0 ? `${num.format(g.stock)} en stock` : g.stock < 0 ? `${num.format(-g.stock)} à envoyer (précommandes)` : 'épuisé'}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Comptés : le prix des articles vendus. Le bonus est après le reversement au frère.</p>
    </section>
  )
}

// Les ventes du mois, comparées au mois dernier, et les 12 derniers mois en un coup d'œil.
function SalesNow() {
  const d = useData()
  const rows = useMemo(() => byBucket(d.sales, 'month', rangeOf('12m', d.sales).keys), [d])
  const total = useMemo(() => d.sales.reduce((a, s) => a + metrics(s).revenue, 0), [d])
  const [last, cur] = rows.slice(-2)
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">Ventes</CardTitle>
        <CardAction>
          <LinkButton to="chiffres">Tous les chiffres</LinkButton>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <dl className="grid grid-cols-3 gap-4">
          {[
            ['Ce mois-ci', cur.total, plural(cur.items, 'article')],
            ['Le mois dernier', last.total, plural(last.items, 'article')],
            ['Depuis le début', total, null],
          ].map(([k, v, foot]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="num text-xl font-semibold tracking-tight sm:text-2xl">{fmt(v, true)}</dd>
              {foot && <dd className="text-xs text-muted-foreground">{foot}</dd>}
            </div>
          ))}
        </dl>
        <RevenueChart rows={rows} simple className="h-40" />
      </CardContent>
    </Card>
  )
}

// La soirée en cours : le total qui monte, et ce qu'il doit y avoir dans la caisse
function Tonight({ n }) {
  return (
    <a href={href('ventes', { nuit: n.night })} className="group block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 active:bg-accent/60 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-chart-2 opacity-60" />
          <span className="relative size-2 rounded-full bg-chart-2" />
        </span>
        <span className="min-w-0 truncate">
          <span className="font-medium text-foreground">Ce soir</span>
          {n.event && ` · ${n.event}`}
        </span>
        <ArrowRight className="ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="num text-3xl font-semibold tracking-tight">{fmt(n.revenue)}</div>
          <div className="text-xs text-muted-foreground">
            {plural(n.count, 'vente')} · {plural(n.items, 'article')}
          </div>
        </div>
        <dl className="flex gap-6 text-xs">
          <div>
            <dt className="text-muted-foreground">Espèces</dt>
            <dd className="num text-base font-medium">{fmt(n.cash)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Carte</dt>
            <dd className="num text-base font-medium">{fmt(n.revenue - n.cash)}</dd>
          </div>
        </dl>
      </div>
    </a>
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

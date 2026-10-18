// Accueil : ce qui a été remboursé. Une carte par produit : combien il en reste à vendre pour rembourser le tirage,
// ou le bonus une fois qu'il est remboursé. La soirée en cours au-dessus, le reversement au frère en dessous.
// Depuis le début, sans période à choisir : les chiffres détaillés sont dans « Chiffres ».

import { useMemo } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Page } from '@/components/page'
import { payback, ROYALTY_CATEGORY } from '@/calc.js'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useTodo, useTonight } from '@/lib/derived'
import { href } from '@/lib/router'
import { PAGES } from '@/lib/nav'
import { fmt, num, plural } from '@/lib/format'
import { Tonight } from '@/pages/overview'
import { cn } from '@/lib/utils'

export function Home() {
  const d = useData()
  const tonight = useTonight()
  const todo = useTodo()
  const rows = useMemo(() => payback(d.sales, d.products), [d])

  const cost = rows.reduce((a, r) => a + r.cost, 0)
  const back = rows.reduce((a, r) => a + Math.min(r.revenue, r.cost), 0)
  const bonus = rows.reduce((a, r) => a + (r.paid ? r.bonus : 0), 0)
  const due = rows.reduce((a, r) => a + r.royalty, 0)
  const given = d.expenses.filter((e) => e.category === ROYALTY_CATEGORY).reduce((a, e) => a + e.amount_cents, 0)

  return (
    <Page title={PAGES.accueil.label} icon={PAGES.accueil.icon} className="mx-auto w-full max-w-2xl space-y-6">
      {tonight && <Tonight n={tonight} />}

      {rows.length ? (
        <>
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                <span className="num">{cost ? Math.floor((back / cost) * 100) : 100} %</span> remboursé
              </h2>
              {bonus > 0 && (
                <span className="text-sm text-muted-foreground">
                  Bonus déjà gagné <span className="num font-medium text-success">+{fmt(bonus, true)}</span>
                </span>
              )}
            </div>
            <Bar value={cost ? back / cost : 1} />
            <p className="text-sm text-muted-foreground">
              {cost > back ? (
                <>
                  Encore <span className="num text-foreground">{fmt(cost - back, true)}</span> à rentrer pour rembourser toute la fabrication.
                </>
              ) : (
                'Toute la fabrication est remboursée.'
              )}
            </p>
          </section>

          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <ProductCard key={r.product.id} r={r} />
            ))}
          </ul>

          {due > 0 && (
            <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm">
              <span className="text-muted-foreground">
                À reverser au frère
                {given > 0 && <span className="block text-xs">{fmt(due, true)} dus, {fmt(given, true)} déjà versés</span>}
              </span>
              <span className="num text-base font-medium">{fmt(Math.max(0, due - given), true)}</span>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Indique le coût du tirage dans la fiche d’un produit pour suivre son remboursement ici.
        </p>
      )}

      {todo.count > 0 && (
        <a href={href('a-traiter')} className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          {plural(todo.count, 'point')} à vérifier dans les données
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </Page>
  )
}

function ProductCard({ r }) {
  const { open } = useUI()
  const p = r.product
  const unit = p.category === 'vinyle' ? 'vinyle' : 'exemplaire'
  const name = p.name.replace(/^Vinyle\s+/i, '')
  return (
    <li className={cn('rounded-xl border bg-card p-4', r.paid && 'border-success/30')}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => open('product', { id: p.id })} className="min-w-0 text-left font-medium leading-snug hover:underline">
          {name}
        </button>
        {r.paid && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-xs text-success">
            <Check className="size-3" /> {r.cost ? 'remboursé' : 'déjà financé'}
          </span>
        )}
      </div>

      {r.paid ? (
        <p className="mt-3 text-base">
          Bonus <span className="num font-semibold text-success">+{fmt(Math.max(0, r.bonus), true)}</span>
        </p>
      ) : (
        <>
          <Bar value={r.progress} className="mt-3" warn />
          <p className="mt-2 text-base">
            Encore <span className="num font-semibold">{num.format(r.left)}</span> {r.left > 1 ? `${unit}s` : unit} à vendre
          </p>
        </>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">
        {plural(r.units, 'vendu')}
        {p.stock > 0 && ` · ${num.format(p.stock)} en stock`}
        {p.stock < 0 && ` · ${num.format(-p.stock)} à expédier`}
      </p>
    </li>
  )
}

function Bar({ value, warn, className }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', warn ? 'bg-warning' : 'bg-foreground/80')} style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  )
}

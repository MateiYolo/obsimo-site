// Produits : catalogue avec prix, coût, marge unitaire, ventes sur la période et noms en caisse. Clic → fiche.

import { useMemo, useState } from 'react'
import { Package, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Page, Empty } from '@/components/page'
import { PeriodSelect } from '@/components/period-select'
import { byProduct } from '@/calc.js'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { usePeriod, isPack } from '@/lib/derived'
import { usePref } from '@/lib/prefs'
import { PAGES } from '@/lib/nav'
import { fmt, num } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Products() {
  const d = useData()
  const { open } = useUI()
  const p = usePeriod()
  const [show, setShow] = usePref('products-show', 'active')
  const [q, setQ] = useState('')
  const sold = useMemo(() => Object.fromEntries(byProduct(p.sales, d.products).map((r) => [r.key, r])), [p, d])
  const needle = q.trim().toLowerCase()
  const list = d.products
    .filter((x) => (show === 'all' || x.active) && (!needle || [x.name, ...x.sumup_names, ...x.shopify_handles].some((v) => v.toLowerCase().includes(needle))))
    .sort((a, b) => (sold[b.id]?.revenue || 0) - (sold[a.id]?.revenue || 0))
  const archived = d.products.filter((x) => !x.active).length

  return (
    <Page
      title={PAGES.produits.label}
      icon={PAGES.produits.icon}
      count={list.length}
      actions={
        <>
          <PeriodSelect />
          <Button size="sm" onClick={() => open('product')} aria-label="Nouveau produit">
            <Plus /> <span className="hidden sm:inline">Produit</span>
          </Button>
        </>
      }
      toolbar={
        <>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, nom en caisse, handle…" className="h-8 pl-8 text-[13px]" />
          </div>
          {archived > 0 && (
            <ToggleGroup type="single" size="sm" variant="outline" value={show} onValueChange={(v) => v && setShow(v)} className="ml-auto">
              <ToggleGroupItem value="active" className="px-3 text-xs">
                Actifs
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="px-3 text-xs">
                Tous <span className="num text-muted-foreground">{d.products.length}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </>
      }
    >
      {list.length ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Produit</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Coût</TableHead>
                <TableHead className="hidden text-right md:table-cell">Marge unit.</TableHead>
                <TableHead className="text-right">Vendus</TableHead>
                <TableHead className="hidden text-right sm:table-cell">CA</TableHead>
                <TableHead className="hidden lg:table-cell">Noms en caisse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((x) => {
                const r = sold[x.id]
                const m = x.price_cents != null && x.cost_cents != null ? x.price_cents - x.cost_cents : null
                return (
                  <TableRow key={x.id} className={cn('cursor-pointer', !x.active && 'opacity-50')} onClick={() => open('product', { id: x.id })}>
                    <TableCell className="max-w-0 pl-4 sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{x.name}</span>
                        {isPack(x) && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            pack
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {x.category}
                        {!x.shopify_handles.length && <span className="normal-case"> · pas sur le site</span>}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">{fmt(x.price_cents)}</TableCell>
                    <TableCell className="num hidden text-right sm:table-cell">
                      {x.cost_cents != null ? fmt(x.cost_cents) : isPack(x) ? <span className="text-muted-foreground">compos.</span> : <span className="text-warning">?</span>}
                    </TableCell>
                    <TableCell className="num hidden text-right md:table-cell">
                      {m != null ? (
                        <>
                          {fmt(m)} <span className="text-xs text-muted-foreground">{x.price_cents ? Math.round((m / x.price_cents) * 100) : 0} %</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-right">{r ? num.format(r.qty) : <span className="text-muted-foreground">0</span>}</TableCell>
                    <TableCell className="num hidden text-right sm:table-cell">{r ? fmt(r.revenue, true) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden max-w-56 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {x.sumup_names.length ? (
                          x.sumup_names.map((n) => (
                            <Badge key={n} variant="secondary" className="font-normal">
                              {n}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty icon={Package} title={q ? 'Aucun produit ne correspond' : 'Aucun produit'} action={!q && <Button size="sm" onClick={() => open('product')}><Plus /> Créer un produit</Button>}>
          {q ? 'Essaie un autre nom.' : 'Ajoute les vinyles, t-shirts et le reste pour suivre leur stock et leur marge.'}
        </Empty>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Ventes et CA sur la période choisie ({p.label.toLowerCase()}), hors frais de port.</p>
    </Page>
  )
}

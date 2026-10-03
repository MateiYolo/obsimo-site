// Stock : niveau de chaque produit physique (rupture / bas / ok), valeur, gestes rapides, historique des mouvements.

import { useMemo } from 'react'
import { ArrowUpFromLine, Boxes, Gift, MoreHorizontal, Plus, ClipboardCheck, Undo2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Page, Empty } from '@/components/page'
import { Confirm } from '@/components/confirm'
import { Hint } from '@/components/shortcut'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { isPack, LOW_STOCK } from '@/lib/derived'
import { usePref } from '@/lib/prefs'
import { pushStock, pushMessage } from '@/lib/actions'
import { PAGES } from '@/lib/nav'
import { fmt, num, dateMedium } from '@/lib/format'
import { cn } from '@/lib/utils'

const MOVES = { initial: 'Stock de départ', restock: 'Réassort', adjust: 'Inventaire', gift: 'Cadeau', loss: 'Perte / casse' }

export function Stock() {
  const { data: d, run } = useStore()
  const { open } = useUI()
  const [tab, setTab] = usePref('stock-tab', 'levels')
  const physical = useMemo(() => d.products.filter((p) => !isPack(p)).sort((a, b) => b.active - a.active || a.stock - b.stock), [d])
  const active = physical.filter((p) => p.active)
  const value = active.reduce((a, p) => a + Math.max(0, p.stock) * (p.cost_cents || 0), 0)
  const items = active.reduce((a, p) => a + Math.max(0, p.stock), 0)
  const out = active.filter((p) => p.stock <= 0).length
  const low = active.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length
  const max = Math.max(1, ...active.map((p) => p.stock))
  const productName = (id) => d.products.find((p) => p.id === id)?.name || id

  return (
    <Page
      title={PAGES.stock.label}
      icon={PAGES.stock.icon}
      actions={
        <>
          {d.integrations.shopifyAdmin && (
            <Confirm
              title="Envoyer ce stock à Shopify ?"
              description="Le stock « disponible » des produits du site sera remplacé par celui du dashboard."
              confirm="Envoyer"
              destructive={false}
              onConfirm={() => run(pushStock, pushMessage)}
            >
              <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Envoyer le stock à Shopify">
                <ArrowUpFromLine /> <span className="hidden sm:inline">Envoyer à Shopify</span>
              </Button>
            </Confirm>
          )}
          <Button size="sm" onClick={() => open('move', { reason: 'restock' })} aria-label="Réassort">
            <Plus /> <span className="hidden sm:inline">Réassort</span>
          </Button>
        </>
      }
      className="space-y-6"
    >
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4 max-sm:[&>*:nth-child(-n+2)]:border-b max-sm:[&>*:nth-child(odd)]:border-r sm:[&>*:not(:last-child)]:border-r">
        <Metric label="Valeur (prix de revient)" value={fmt(value, true)} />
        <Metric label="Articles en stock" value={num.format(items)} />
        <Metric label="En rupture" value={out} tone={out ? 'text-destructive' : ''} />
        <Metric label={`Stock bas (≤ ${LOW_STOCK})`} value={low} tone={low ? 'text-warning' : ''} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="levels">
            <Boxes /> Niveaux
          </TabsTrigger>
          <TabsTrigger value="history">
            <History /> Mouvements <span className="num text-muted-foreground">{d.movements.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="mt-4">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Produit</TableHead>
                  <TableHead className="w-48 max-sm:hidden" />
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Valeur</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {physical.map((p) => {
                  const tone = p.stock <= 0 ? 'destructive' : p.stock <= LOW_STOCK ? 'warning' : null
                  return (
                    <TableRow key={p.id} className={cn(!p.active && 'opacity-50')}>
                      <TableCell className="max-w-0 pl-4 sm:max-w-none">
                        <button className="block max-w-full text-left font-medium hover:underline sm:truncate" onClick={() => open('product', { id: p.id })}>
                          {p.name}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {p.cost_cents != null ? `coût ${fmt(p.cost_cents)}` : <span className="text-warning">coût inconnu</span>}
                          {p.price_cents != null && ` · vendu ${fmt(p.price_cents)}`}
                          {!p.active && ' · archivé'}
                        </span>
                      </TableCell>
                      <TableCell className="max-sm:hidden">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', tone === 'destructive' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : 'bg-foreground/60')}
                            style={{ width: `${Math.max(0, (p.stock / max) * 100)}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn('num text-base font-semibold', tone === 'destructive' && 'text-destructive', tone === 'warning' && 'text-warning')}>{p.stock}</span>
                        {tone && p.active && (
                          <Badge variant="outline" className={cn('ml-2 hidden font-normal sm:inline-flex', tone === 'destructive' ? 'border-destructive/40 text-destructive' : 'border-warning/40 text-warning')}>
                            {p.stock < 0 ? 'négatif' : p.stock === 0 ? 'rupture' : 'bas'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="num hidden text-right text-muted-foreground md:table-cell">{p.cost_cents != null ? fmt(Math.max(0, p.stock) * p.cost_cents, true) : '—'}</TableCell>
                      <TableCell className="pr-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Hint label="Réassort">
                            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => open('move', { id: p.id, reason: 'restock' })} aria-label={`Réassort ${p.name}`}>
                              <Plus />
                            </Button>
                          </Hint>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions ${p.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => open('move', { id: p.id, reason: 'restock' })}>
                                <Plus /> Réassort
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => open('move', { id: p.id, reason: 'adjust' })}>
                                <ClipboardCheck /> Inventaire
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => open('move', { id: p.id, reason: 'gift' })}>
                                <Gift /> Cadeau / perte
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => open('product', { id: p.id })}>Fiche produit</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {d.products.some(isPack) && <p className="mt-3 text-xs text-muted-foreground">Les packs n’ont pas de stock à eux : chaque pack vendu sort ses composants.</p>}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {d.movements.length ? (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {d.movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2 pr-2 pl-4 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{dateMedium(m.occurred_at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{productName(m.product_id)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {MOVES[m.reason] || m.reason}
                      {m.note && ` · ${m.note}`}
                    </span>
                  </span>
                  <span className={cn('num w-12 text-right font-medium', m.qty < 0 ? 'text-destructive' : 'text-success')}>
                    {m.qty > 0 ? '+' : ''}
                    {m.qty}
                  </span>
                  <Confirm title="Annuler ce mouvement ?" description="Le stock revient à ce qu’il était sans lui." confirm="Annuler le mouvement" onConfirm={() => run(() => api('movement-delete', { id: m.id }), 'Mouvement annulé')}>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Annuler ce mouvement">
                      <Undo2 />
                    </Button>
                  </Confirm>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon={ClipboardCheck}
              title="Aucun mouvement"
              action={
                <Button size="sm" onClick={() => open('move', { reason: 'adjust' })}>
                  Faire un inventaire
                </Button>
              }
            >
              Commence par un inventaire de chaque produit : ce qu’il vous reste aujourd’hui. Les ventes décomptent ensuite toutes seules.
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div className="p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('num mt-1 text-lg font-semibold tracking-tight sm:text-xl', tone)}>{value}</p>
    </div>
  )
}

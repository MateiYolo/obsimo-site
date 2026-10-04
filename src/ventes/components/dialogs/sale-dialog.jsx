// Saisie d'une vente (stand en espèces, Bandcamp, autre) : quantités au doigt, total en direct, ⌘↵ pour enregistrer.
// Au stand : produits les plus vendus en concert en premier, stock restant, monnaie à rendre, « Annuler » dans la
// notification si on s'est trompé. Les ventes SumUp et Shopify arrivent toutes seules.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, ChevronDown, Banknote, Disc3, Shapes } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, MoneyInput } from '@/components/field'
import { Keys } from '@/components/shortcut'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useTonight, isPack, LIVE, LOW_STOCK } from '@/lib/derived'
import { fmt, fromCents, localInput, toCents } from '@/lib/format'
import { cn } from '@/lib/utils'

const CHANNELS = [
  ['cash', 'Espèces', Banknote],
  ['bandcamp', 'Bandcamp', Disc3],
  ['other', 'Autre', Shapes],
]

export function SaleDialog({ onClose }) {
  const { data: d, run } = useStore()
  // les plus vendus en concert d'abord : au stand, l'essentiel tient sans faire défiler
  const products = useMemo(() => {
    const sold = {}
    for (const s of d.sales) if (LIVE.includes(s.channel)) for (const l of s.lines) sold[l.product_id] = (sold[l.product_id] || 0) + l.qty
    return d.products.filter((p) => p.active).sort((a, b) => (sold[b.id] || 0) - (sold[a.id] || 0))
  }, [d])
  const events = useMemo(() => [...new Set(d.sales.map((s) => s.event).filter(Boolean))].slice(0, 30), [d])
  // au stand : le concert de la soirée en cours est déjà rempli
  const current = useTonight()?.event || ''
  const [channel, setChannel] = useState('cash')
  const [qty, setQty] = useState({})
  const [price, setPrice] = useState(() => Object.fromEntries(products.map((p) => [p.id, fromCents(p.price_cents)])))
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)

  const lines = products.map((p) => ({ product_id: p.id, qty: qty[p.id] || 0, unit_price_cents: toCents(price[p.id]) ?? 0 })).filter((l) => l.qty > 0)
  const items = lines.reduce((t, l) => t + l.qty, 0)
  const [shipping, setShipping] = useState('')
  const total = lines.reduce((t, l) => t + l.qty * l.unit_price_cents, 0) + (toCents(shipping) || 0)
  const step = (id, delta) => {
    navigator.vibrate?.(8) // petit retour au toucher (Android)
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }))
  }
  // espèces : billet reçu → monnaie à rendre
  const [given, setGiven] = useState(null)
  useEffect(() => setGiven(null), [total])
  const bills = [500, 1000, 2000, 5000, 10000].filter((b) => b > total).slice(0, 3)

  async function submit(e) {
    e.preventDefault()
    if (!lines.length || busy) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const out = await run(() =>
        api('sale', {
          channel,
          payment_method: channel === 'cash' ? 'cash' : null,
          occurred_at: new Date(f.get('occurred_at')).toISOString(),
          shipping_cents: toCents(shipping) || 0,
          fees_cents: toCents(f.get('fees')),
          event: f.get('event'),
          note: f.get('note'),
          lines,
        }),
      )
      toast.success(`Vente de ${fmt(total)} enregistrée`, {
        action: { label: 'Annuler', onClick: () => run(() => api('sale-delete', { id: out.id }), 'Vente annulée').catch(() => {}) },
      })
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg"
        // téléphone : pas de focus (ni de clavier) à l'ouverture, on commence par toucher les articles
        onOpenAutoFocus={(e) => matchMedia('(pointer: coarse)').matches && e.preventDefault()}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.querySelector('form')?.requestSubmit()}
      >
        <DialogHeader className="border-b px-5 pt-5 pb-4 text-left">
          <DialogTitle>Nouvelle vente</DialogTitle>
          <DialogDescription className="max-sm:sr-only">Les ventes SumUp et du site arrivent automatiquement : saisis ici le reste.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <ToggleGroup type="single" variant="outline" value={channel} onValueChange={(v) => v && setChannel(v)} className="w-full">
              {CHANNELS.map(([v, l, Icon]) => (
                <ToggleGroupItem key={v} value={v} className="flex-1 gap-1.5 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
                  <Icon className="size-3.5" /> {l}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
                <span className="font-medium">Articles</span>
                <span>Prix unitaire</span>
              </div>
              <ul className="divide-y rounded-lg border">
                {products.map((p) => {
                  const n = qty[p.id] || 0
                  return (
                    <li key={p.id} className={cn('flex items-center gap-2 px-2 py-1.5 transition-colors', n > 0 && 'bg-accent/50')}>
                      <div className="flex shrink-0 items-center rounded-md border bg-background">
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-r-none" onClick={() => step(p.id, -1)} disabled={!n} aria-label={`Retirer un ${p.name}`}>
                          <Minus />
                        </Button>
                        <span className={cn('num w-6 text-center text-sm', !n && 'text-muted-foreground')}>{n}</span>
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-l-none" onClick={() => step(p.id, 1)} aria-label={`Ajouter un ${p.name}`}>
                          <Plus />
                        </Button>
                      </div>
                      <button type="button" className="min-w-0 flex-1 self-stretch py-1 text-left text-sm leading-snug" onClick={() => step(p.id, 1)}>
                        <span className="line-clamp-2">{p.name}</span>
                        {!isPack(p) && <Left stock={p.stock} n={n} />}
                      </button>
                      <MoneyInput className="w-20 shrink-0 sm:w-24" value={price[p.id]} onChange={(e) => setPrice((x) => ({ ...x, [p.id]: e.target.value }))} aria-label={`Prix ${p.name}`} />
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Concert">
                {(id) => (
                  <>
                    <Input id={id} name="event" list="sale-events" defaultValue={current} placeholder="ex. Lyon · La Marquise" autoComplete="off" />
                    <datalist id="sale-events">
                      {events.map((e) => (
                        <option key={e} value={e} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field label="Date">{(id) => <Input id={id} type="datetime-local" name="occurred_at" defaultValue={localInput()} required />}</Field>
            </div>

            <div>
              <button type="button" onClick={() => setMore((m) => !m)} className="-my-2 flex items-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn('size-3.5 transition-transform', !more && '-rotate-90')} /> Frais de port, commission, note
              </button>
              <div className={cn('mt-3 grid gap-3 sm:grid-cols-2', !more && 'hidden')}>
                <Field label="Frais de port payés">{(id) => <MoneyInput id={id} value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="0" />}</Field>
                <Field label="Commission" hint="Vide : calculée selon le canal">
                  {(id) => <MoneyInput id={id} name="fees" placeholder="auto" />}
                </Field>
                <Field label="Note" className="sm:col-span-2">
                  {(id) => <Input id={id} name="note" placeholder="facultatif" />}
                </Field>
              </div>
            </div>
          </div>

          {channel === 'cash' && total > 0 && bills.length > 0 && (
            <div className="flex items-center gap-1.5 border-t px-5 py-2 text-xs">
              <span className="mr-1 text-muted-foreground">Reçu</span>
              {bills.map((b) => (
                <Button key={b} type="button" variant={given === b ? 'secondary' : 'outline'} size="xs" className="num pointer-coarse:h-9 pointer-coarse:px-3" onClick={() => setGiven(given === b ? null : b)}>
                  {fmt(b)}
                </Button>
              ))}
              {given != null && (
                <span className="ml-auto text-right">
                  <span className="text-muted-foreground">à rendre </span>
                  <span className="num text-sm font-semibold">{fmt(given - total)}</span>
                </span>
              )}
            </div>
          )}
          <DialogFooter className="flex-row items-center border-t bg-muted/30 px-5 py-3 sm:justify-between max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mr-auto">
              <div className="num text-lg font-semibold leading-tight">{fmt(total)}</div>
              <div className="text-xs text-muted-foreground">{items ? `${items} article${items > 1 ? 's' : ''}` : 'Aucun article'}</div>
            </div>
            <Button type="submit" disabled={!items || busy}>
              Enregistrer <Keys keys="mod ↵" className="hidden opacity-70 sm:inline-flex [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// stock restant, compte tenu des articles déjà ajoutés à cette vente
function Left({ stock, n }) {
  const left = stock - n
  if (stock <= 0) return <span className="block text-xs text-destructive">rupture</span>
  if (left < 0) return <span className="num block text-xs text-destructive">plus que {stock} en stock</span>
  if (left === 0) return <span className="block text-xs text-warning">épuisé après cette vente</span>
  return <span className={cn('num block text-xs', left <= LOW_STOCK ? 'text-warning' : 'text-muted-foreground')}>reste {left}</span>
}

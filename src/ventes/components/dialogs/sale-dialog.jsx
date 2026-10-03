// Saisie d'une vente (stand en espèces, Bandcamp, autre) : quantités au doigt, total en direct, ⌘↵ pour enregistrer.
// Les ventes SumUp et Shopify arrivent toutes seules.

import { useMemo, useState } from 'react'
import { Minus, Plus, ChevronDown, Banknote, Disc3, Shapes } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, MoneyInput } from '@/components/field'
import { Keys } from '@/components/shortcut'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { fmt, fromCents, localInput, toCents } from '@/lib/format'
import { cn } from '@/lib/utils'

const CHANNELS = [
  ['cash', 'Concert · espèces', Banknote],
  ['bandcamp', 'Bandcamp', Disc3],
  ['other', 'Autre', Shapes],
]

export function SaleDialog({ onClose }) {
  const { data: d, run } = useStore()
  const products = useMemo(() => d.products.filter((p) => p.active), [d])
  const events = useMemo(() => [...new Set(d.sales.map((s) => s.event).filter(Boolean))].slice(0, 30), [d])
  const [channel, setChannel] = useState('cash')
  const [qty, setQty] = useState({})
  const [price, setPrice] = useState(() => Object.fromEntries(products.map((p) => [p.id, fromCents(p.price_cents)])))
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)

  const lines = products.map((p) => ({ product_id: p.id, qty: qty[p.id] || 0, unit_price_cents: toCents(price[p.id]) ?? 0 })).filter((l) => l.qty > 0)
  const items = lines.reduce((t, l) => t + l.qty, 0)
  const [shipping, setShipping] = useState('')
  const total = lines.reduce((t, l) => t + l.qty * l.unit_price_cents, 0) + (toCents(shipping) || 0)
  const step = (id, delta) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }))

  async function submit(e) {
    e.preventDefault()
    if (!lines.length || busy) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    try {
      await run(
        () =>
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
        `Vente de ${fmt(total)} enregistrée`,
      )
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.querySelector('form')?.requestSubmit()}>
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle>Nouvelle vente</DialogTitle>
          <DialogDescription>Les ventes SumUp et du site arrivent automatiquement : saisis ici le reste.</DialogDescription>
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
                      <div className="flex items-center rounded-md border bg-background">
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-r-none" onClick={() => step(p.id, -1)} disabled={!n} aria-label={`Retirer un ${p.name}`}>
                          <Minus />
                        </Button>
                        <span className={cn('num w-7 text-center text-sm', !n && 'text-muted-foreground')}>{n}</span>
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-l-none" onClick={() => step(p.id, 1)} aria-label={`Ajouter un ${p.name}`}>
                          <Plus />
                        </Button>
                      </div>
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => step(p.id, 1)}>
                        {p.name}
                        {!p.components.length && p.stock <= 0 && <span className="ml-1.5 text-xs text-destructive">rupture</span>}
                      </button>
                      <MoneyInput className="w-24" value={price[p.id]} onChange={(e) => setPrice((x) => ({ ...x, [p.id]: e.target.value }))} aria-label={`Prix ${p.name}`} />
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Concert">
                {(id) => (
                  <>
                    <Input id={id} name="event" list="sale-events" placeholder="ex. Lyon · La Marquise" autoComplete="off" />
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
              <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
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

          <DialogFooter className="flex-row items-center border-t bg-muted/30 px-5 py-3 sm:justify-between">
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

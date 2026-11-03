// Fiche rapide d'un produit, ouverte depuis l'accueil : vendre (espèces, Lydia…), donner, et ce qu'il a coûté.
// Les coûts se détaillent poste par poste (pressage, SDRM, stickers…) ; avec le prix et le nombre d'exemplaires
// fabriqués, la fiche calcule le coût par exemplaire, ce que rapporte une vente et le nombre de ventes pour être rentable.
// Les réglages complets (noms en caisse, Shopify, reversement) restent dans la fiche produit classique.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Banknote, Gift, Minus, Plus, Receipt, Settings2, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, MoneyInput } from '@/components/field'
import { payback } from '@/calc.js'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useRoyalties } from '@/lib/derived'
import { fmt, fromCents, localInput, num, plural, toCents } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  ['sell', 'Vendre', Banknote],
  ['give', 'Donner', Gift],
  ['costs', 'Coûts', Receipt],
]

export function ProductPanel({ id, tab: initial = 'sell', onClose }) {
  const { data: d } = useStore()
  const { open } = useUI()
  const p = d.products.find((x) => x.id === id)
  const [tab, setTab] = useState(initial)
  if (!p) return null

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="border-b p-5 pb-4">
          <SheetTitle className="pr-8 text-lg leading-snug">{p.name}</SheetTitle>
          <SheetDescription className="num">
            {p.stock > 0 ? `${num.format(p.stock)} en stock` : p.stock < 0 ? `${num.format(-p.stock)} précommandes à envoyer` : 'plus de stock'}
            {p.price_cents != null && ` · ${fmt(p.price_cents)} pièce`}
          </SheetDescription>
          <ToggleGroup type="single" variant="outline" value={tab} onValueChange={(v) => v && setTab(v)} className="mt-3 w-full">
            {TABS.map(([v, l, Icon]) => (
              <ToggleGroupItem key={v} value={v} className="h-10 flex-1 gap-1.5 text-sm data-[state=on]:bg-accent data-[state=on]:text-foreground">
                <Icon className="size-4" /> {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'sell' && <Sell p={p} onDone={onClose} />}
          {tab === 'give' && <Give p={p} onDone={onClose} />}
          {tab === 'costs' && <Costs p={p} onDone={onClose} />}
        </div>

        <div className="border-t px-5 py-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => open('product', { id })}>
            <Settings2 /> Tous les réglages du produit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Stepper({ value, onChange, max }) {
  const step = (n) => {
    navigator.vibrate?.(8)
    onChange(Math.max(1, value + n))
  }
  return (
    <div className="flex items-center justify-center gap-4">
      <Button type="button" variant="outline" size="icon" className="size-12 rounded-full" onClick={() => step(-1)} disabled={value <= 1} aria-label="Un de moins">
        <Minus className="size-5" />
      </Button>
      <div className="w-20 text-center">
        <div className="num text-4xl font-semibold tabular-nums">{value}</div>
        {max != null && <div className={cn('text-xs', value > max ? 'text-destructive' : 'text-muted-foreground')}>{max > 0 ? `sur ${num.format(max)} en stock` : 'plus de stock'}</div>}
      </div>
      <Button type="button" variant="outline" size="icon" className="size-12 rounded-full" onClick={() => step(1)} aria-label="Un de plus">
        <Plus className="size-5" />
      </Button>
    </div>
  )
}

function Footer({ children }) {
  return <div className="sticky bottom-0 border-t bg-background/95 px-5 py-3 backdrop-blur">{children}</div>
}

// Vente à la main : un pote en espèces, un Lydia, un virement…
function Sell({ p, onDone }) {
  const { run } = useStore()
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(fromCents(p.price_cents))
  const [how, setHow] = useState('cash')
  const [busy, setBusy] = useState(false)
  const unit = toCents(price) ?? 0
  const total = qty * unit

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const out = await run(() =>
        api('sale', {
          channel: how === 'cash' ? 'cash' : 'other',
          payment_method: how === 'cash' ? 'cash' : f.get('method') || null,
          occurred_at: new Date(f.get('occurred_at')).toISOString(),
          note: f.get('note'),
          lines: [{ product_id: p.id, qty, unit_price_cents: unit }],
        }),
      )
      toast.success(`Vente de ${fmt(total)} enregistrée`, {
        action: { label: 'Annuler', onClick: () => run(() => api('sale-delete', { id: out.id }), 'Vente annulée').catch(() => {}) },
      })
      onDone()
    } catch {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 p-5">
        <Stepper value={qty} onChange={setQty} max={p.components.length ? null : p.stock} />
        <ToggleGroup type="single" variant="outline" value={how} onValueChange={(v) => v && setHow(v)} className="w-full">
          <ToggleGroupItem value="cash" className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
            Espèces
          </ToggleGroupItem>
          <ToggleGroupItem value="other" className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
            Lydia, virement…
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix pièce">{(fid) => <MoneyInput id={fid} value={price} onChange={(e) => setPrice(e.target.value)} required />}</Field>
          <Field label="Date">{(fid) => <Input id={fid} type="datetime-local" name="occurred_at" defaultValue={localInput()} required />}</Field>
        </div>
        {how === 'other' && <Field label="Comment ?">{(fid) => <Input id={fid} name="method" placeholder="ex. Lydia" />}</Field>}
        <Field label="Pour qui ?" hint="Facultatif, pour t’en souvenir dans la liste des ventes.">
          {(fid) => <Input id={fid} name="note" placeholder="ex. Julien, un pote" autoComplete="off" />}
        </Field>
      </div>
      <Footer>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !unit}>
          Vendu · {fmt(total)}
        </Button>
      </Footer>
    </form>
  )
}

// Don (promo, invité, pote) ou perte : sort du stock, sans argent ; ne compte pas pour Matei.
function Give({ p, onDone }) {
  const { run } = useStore()
  const [qty, setQty] = useState(1)
  const [kind, setKind] = useState('gift')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    try {
      await run(
        () => api('movement', { product_id: p.id, reason: kind, qty, note: f.get('note'), occurred_at: new Date(f.get('occurred_at')).toISOString() }),
        kind === 'gift' ? `${plural(qty, 'don')} noté${qty > 1 ? 's' : ''}` : 'Perte notée',
      )
      onDone()
    } catch {
      setBusy(false)
    }
  }

  if (p.components.length) return <p className="p-5 text-sm text-muted-foreground">Un pack ne se donne pas tel quel : donne plutôt chacun des produits qu’il contient.</p>

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 p-5">
        <Stepper value={qty} onChange={setQty} max={p.stock} />
        <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v)} className="w-full">
          <ToggleGroupItem value="gift" className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
            Don
          </ToggleGroupItem>
          <ToggleGroupItem value="loss" className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
            Perdu / cassé
          </ToggleGroupItem>
        </ToggleGroup>
        <Field label={kind === 'gift' ? 'À qui ?' : 'Ce qui s’est passé'} hint={kind === 'gift' ? 'Facultatif. Un don ne rapporte rien à Matei.' : 'Facultatif.'}>
          {(fid) => <Input id={fid} name="note" placeholder={kind === 'gift' ? 'ex. radio FIP, programmateur' : 'ex. abîmé pendant le transport'} autoComplete="off" />}
        </Field>
        <Field label="Date">{(fid) => <Input id={fid} type="datetime-local" name="occurred_at" defaultValue={localInput()} required />}</Field>
      </div>
      <Footer>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {kind === 'gift' ? `Donner ${plural(qty, 'exemplaire')}` : `Sortir ${plural(qty, 'exemplaire')} du stock`}
        </Button>
      </Footer>
    </form>
  )
}

// Ce que le produit a coûté, poste par poste, et ce que ça donne.
function Costs({ p, onDone }) {
  const { data: d, run } = useStore()
  const r = useRoyalties()
  const saved = d.costs?.[p.id]
  const [items, setItems] = useState(() =>
    saved?.items?.length
      ? saved.items.map((x) => ({ label: x.label, amount: fromCents(x.amount_cents) }))
      : p.investment_cents
        ? [{ label: 'Frais engagés (à détailler)', amount: fromCents(p.investment_cents) }]
        : [{ label: '', amount: '' }],
  )
  const [made, setMade] = useState(saved?.made ? String(saved.made) : '')
  const [price, setPrice] = useState(fromCents(p.price_cents))
  const [busy, setBusy] = useState(false)

  const total = items.reduce((a, x) => a + (toCents(x.amount) || 0), 0)
  const unitPrice = toCents(price)
  const n = Number(made) || 0
  const perUnit = n ? Math.round(total / n) : p.cost_cents
  const perSale = unitPrice != null && perUnit != null ? unitPrice - perUnit : null
  const breakEven = unitPrice ? Math.ceil(total / unitPrice) : null

  // où on en est (même calcul que l'accueil)
  const g = useMemo(() => payback(d.sales, d.products, Object.fromEntries(r.products.map((x) => [x.product.id, x.due]))).find((x) => x.id === p.id), [d, r, p.id])

  // si tout le stock part : ce qui reviendrait encore à Matei (seulement au-delà du seuil du tirage)
  const rr = r.products.find((x) => x.product.id === p.id)
  const moreForMatei = rr && p.stock > 0 ? Math.max(0, rr.units + p.stock - Math.max(rr.units, rr.threshold)) * (p.royalty_cents || 0) : 0
  const sellOut = g && unitPrice > 0 && p.stock > 0 ? g.revenue + p.stock * unitPrice - total - g.royalty - moreForMatei : null

  const set = (i, k) => (e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))

  async function save() {
    setBusy(true)
    try {
      await run(
        () =>
          api('costs', {
            product_id: p.id,
            items: items.map((x) => ({ label: x.label, amount_cents: toCents(x.amount) })),
            made: n || null,
            price_cents: unitPrice,
          }),
        'Coûts enregistrés',
      )
      onDone()
    } catch {
      setBusy(false)
    }
  }

  if (p.components.length) return <p className="p-5 text-sm text-muted-foreground">Un pack coûte ce que coûtent ses produits : détaille plutôt les coûts de chacun d’eux.</p>

  return (
    <div>
      <div className="space-y-5 p-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted-foreground">
            <span>Ce que ça a coûté</span>
            <span>Montant TTC</span>
          </div>
          <ul className="space-y-2">
            {items.map((x, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input value={x.label} onChange={set(i, 'label')} placeholder="ex. Pressage, SDRM, stickers" aria-label="Poste" className="min-w-0 flex-1" />
                <MoneyInput value={x.amount} onChange={set(i, 'amount')} className="w-28 shrink-0" aria-label="Montant" />
                <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [{ label: '', amount: '' }]))} aria-label="Retirer">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 text-muted-foreground" onClick={() => setItems((xs) => [...xs, { label: '', amount: '' }])}>
            <Plus /> Ajouter une ligne
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Exemplaires fabriqués">
            {(fid) => <Input id={fid} type="number" min="1" step="1" inputMode="numeric" value={made} onChange={(e) => setMade(e.target.value)} placeholder="ex. 300" className="num" />}
          </Field>
          <Field label="Prix de vente">{(fid) => <MoneyInput id={fid} value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm">
          {[
            ['Coût total', fmt(total), null],
            ['Coût par exemplaire', perUnit != null ? fmt(perUnit) : '—', n ? null : 'indique combien ont été fabriqués'],
            ['Une vente rapporte', perSale != null ? fmt(perSale) : '—', 'prix − coût par exemplaire'],
            ['Rentable à partir de', breakEven != null ? plural(breakEven, 'vente') : '—', null],
          ].map(([k, v, hint]) => (
            <div key={k} className="bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="num text-base font-semibold">{v}</dd>
              {hint && <dd className="text-[11px] leading-tight text-muted-foreground">{hint}</dd>}
            </div>
          ))}
        </dl>

        {g && total > 0 && (
          <p className="text-sm">
            {g.revenue >= total ? (
              <>
                Déjà remboursé : <span className="num font-semibold text-success">+{fmt(Math.max(0, g.revenue - total - g.royalty), true)}</span> de bonus avec {plural(g.units, 'vente')}{g.royalty > 0 ? `, après les ${fmt(g.royalty, true)} pour Matei` : ''}.
              </>
            ) : (
              <>
                {plural(g.units, 'vendu')}, {fmt(g.revenue, true)} rentrés : encore <span className="num font-semibold">{fmt(total - g.revenue, true)}</span> à rembourser
                {unitPrice ? ` (≈ ${plural(Math.ceil((total - g.revenue) / unitPrice), 'vente')})` : ''}.
              </>
            )}
          </p>
        )}
        {sellOut != null && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Si les {num.format(p.stock)} restants partent à {fmt(unitPrice)} :{' '}
            <span className={cn('num font-semibold', sellOut >= 0 ? 'text-success' : 'text-destructive')}>
              {sellOut >= 0 ? '+' : ''}
              {fmt(sellOut, true)}
            </span>{' '}
            de bonus au total{p.royalty_cents != null ? ', part de Matei déduite' : ''}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Enregistrer remplace les frais engagés du produit par ce total{n ? ' et son coût de revient par le coût par exemplaire' : ''}. Les ventes déjà faites gardent leur ancien coût.
        </p>
      </div>
      <Footer>
        <Button size="lg" className="w-full" onClick={save} disabled={busy || items.some((x) => x.label && toCents(x.amount) == null)}>
          Enregistrer les coûts
        </Button>
      </Footer>
    </div>
  )
}

// Fiche produit, en panneau latéral : prix, coût (et marge unitaire), noms en caisse, handles Shopify, chiffres de vente.

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, MoneyInput } from '@/components/field'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { fmt, fromCents, toCents, num } from '@/lib/format'
import { metrics } from '@/calc.js'

const CATEGORIES = ['vinyle', 'merch', 'sauce', 'textile', 'autre']
const EMPTY = { name: '', category: 'merch', price_cents: null, cost_cents: null, sumup_names: [], shopify_handles: [], components: [], active: true }

// Saisie de plusieurs valeurs : Entrée ou virgule ajoute une étiquette, retour arrière retire la dernière.
function TagInput({ id, value, onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim().replace(/,$/, '')
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input px-1.5 py-1 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
      {value.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-sm opacity-60 hover:opacity-100" aria-label={`Retirer ${v}`}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(',') ? (setDraft(e.target.value), queueMicrotask(add)) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault(), add()
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export function ProductSheet({ id, onClose }) {
  const { data: d, run } = useStore()
  const p = d.products.find((x) => x.id === id) || EMPTY
  const isNew = !id
  const [form, setForm] = useState({ ...p, price: fromCents(p.price_cents), cost: fromCents(p.cost_cents) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))
  const price = toCents(form.price)
  const cost = toCents(form.cost)
  const unitMargin = price != null && cost != null ? price - cost : null

  const stats = useMemo(() => {
    if (isNew) return null
    let qty = 0
    let revenue = 0
    for (const s of d.sales) {
      if (!metrics(s).items) continue
      for (const l of s.lines) if (l.product_id === id) (qty += l.qty), (revenue += l.qty * l.unit_price_cents)
    }
    return { qty, revenue }
  }, [d, id, isNew])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await run(
        () =>
          api('product', {
            id,
            isNew,
            name: form.name,
            category: form.category,
            price_cents: price,
            cost_cents: cost,
            sumup_names: form.sumup_names,
            shopify_handles: form.shopify_handles,
            components: p.components,
            active: form.active,
          }),
        isNew ? 'Produit créé' : 'Produit enregistré',
      )
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form onSubmit={save} className="flex h-full flex-col" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.requestSubmit()}>
          <SheetHeader className="border-b p-5">
            <div className="flex items-center gap-2">
              {!isNew && <Badge variant="outline" className="font-normal capitalize text-muted-foreground">{p.components.length ? 'pack' : p.category}</Badge>}
              {!isNew && !p.active && <Badge variant="outline" className="font-normal text-muted-foreground">archivé</Badge>}
            </div>
            <SheetTitle className="text-base">{isNew ? 'Nouveau produit' : p.name}</SheetTitle>
            <SheetDescription className="sr-only">Fiche produit</SheetDescription>
            {stats && (
              <dl className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-sm">
                {[
                  ['Vendus', num.format(stats.qty)],
                  ['CA', fmt(stats.revenue, true)],
                  [p.components.length ? 'Stock' : 'En stock', p.components.length ? '—' : num.format(p.stock)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-background px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="num font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <Field label="Nom">{(fid) => <Input id={fid} value={form.name} onChange={set('name')} required autoFocus={isNew} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix de vente">{(fid) => <MoneyInput id={fid} value={form.price} onChange={set('price')} />}</Field>
              <Field label="Coût de revient">
                {(fid) => <MoneyInput id={fid} value={form.cost} onChange={set('cost')} placeholder={p.components.length ? 'composants' : 'inconnu'} aria-invalid={!p.components.length && cost == null ? true : undefined} />}
              </Field>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              {unitMargin != null ? (
                <>
                  Marge unitaire <span className="num font-medium text-foreground">{fmt(unitMargin)}</span> · {price ? Math.round((unitMargin / price) * 100) : 0} % du prix, avant commission
                </>
              ) : p.components.length ? (
                'Pack : son coût est la somme de ses composants.'
              ) : (
                'Sans coût de revient, la marge de ce produit est surestimée.'
              )}
            </p>
            <Field label="Catégorie">
              <Select value={form.category} onValueChange={set('category')}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Noms en caisse SumUp" hint="Exactement comme dans la caisse. Entrée pour ajouter.">
              {(fid) => <TagInput id={fid} value={form.sumup_names} onChange={set('sumup_names')} placeholder="ex. Vinyle, T-shirt M" />}
            </Field>
            <Field label="Handles Shopify" hint="La fin de l’URL du produit sur le site.">
              {(fid) => <TagInput id={fid} value={form.shopify_handles} onChange={set('shopify_handles')} placeholder="ex. vinyle-8-days-in-sweden" />}
            </Field>
            {p.components.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Contenu du pack</p>
                <ul className="space-y-1">
                  {p.components.map((c) => (
                    <li key={c.product_id} className="flex justify-between">
                      <span>{d.products.find((x) => x.id === c.product_id)?.name || c.product_id}</span>
                      <span className="num text-muted-foreground">× {c.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Label className="flex items-start gap-3 rounded-lg border p-3 font-normal">
              <Checkbox checked={form.active} onCheckedChange={(v) => set('active')(!!v)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Produit actif</span>
                <span className="text-xs text-muted-foreground">Proposé dans la saisie des ventes et le stock.</span>
              </span>
            </Label>
          </div>

          <SheetFooter className="flex-row justify-end border-t bg-muted/30 px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {isNew ? 'Créer le produit' : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

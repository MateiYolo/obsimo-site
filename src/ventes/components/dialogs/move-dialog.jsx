// Mouvement de stock hors vente : réassort, inventaire (« il en reste N »), cadeau ou perte.

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { localInput } from '@/lib/format'
import { isPack } from '@/lib/derived'
import { toast } from 'sonner'

const KINDS = {
  restock: { label: 'Réassort', title: 'Réassort', hint: 'Combien d’exemplaires arrivent ?' },
  adjust: { label: 'Inventaire', title: 'Inventaire', hint: 'Combien il en reste vraiment ?' },
  gift: { label: 'Sortie', title: 'Cadeau ou perte', hint: 'Combien sortent du stock ?' },
}

export function MoveDialog({ id, reason: initial = 'restock', onClose }) {
  const { data: d, run } = useStore()
  const physical = d.products.filter((p) => !isPack(p) && p.active)
  const [productId, setProductId] = useState(id || physical[0]?.id)
  const [kind, setKind] = useState(initial === 'loss' ? 'gift' : initial)
  const [out, setOut] = useState(initial === 'loss' ? 'loss' : 'gift')
  const p = d.products.find((x) => x.id === productId)
  const k = KINDS[kind]

  return (
    <FormDialog
      title={id ? `${k.title} · ${p.name}` : 'Mouvement de stock'}
      description={p ? `Stock actuel : ${p.stock}` : null}
      onClose={onClose}
      onSubmit={async (f) => {
        const qty = Number(f.get('qty'))
        if (kind === 'adjust' && qty === p.stock) {
          toast('Le stock est déjà juste')
          return
        }
        await run(
          () =>
            api('movement', {
              product_id: productId,
              // le tout premier inventaire d'un produit est son stock de départ
              reason: kind === 'gift' ? out : kind === 'adjust' && !d.movements.some((m) => m.product_id === productId) ? 'initial' : kind,
              qty,
              absolute: kind === 'adjust',
              occurred_at: new Date(f.get('occurred_at')).toISOString(),
              note: f.get('note'),
            }),
          'Stock mis à jour',
        )
      }}
    >
      <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v)} className="w-full">
        {Object.entries(KINDS).map(([v, x]) => (
          <ToggleGroupItem key={v} value={v} className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:text-foreground">
            {x.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {!id && (
        <Field label="Produit">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {physical.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name} <span className="num text-muted-foreground">· {x.stock}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {kind === 'gift' && (
        <ToggleGroup type="single" size="sm" value={out} onValueChange={(v) => v && setOut(v)} className="justify-start">
          <ToggleGroupItem value="gift" className="px-3 text-xs">Cadeau (promo, invités…)</ToggleGroupItem>
          <ToggleGroupItem value="loss" className="px-3 text-xs">Perte / casse</ToggleGroupItem>
        </ToggleGroup>
      )}
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <Field label={kind === 'adjust' ? 'Il en reste' : 'Quantité'}>
          {(fid) => <Input id={fid} key={kind} type="number" name="qty" min={kind === 'adjust' ? 0 : 1} step="1" required inputMode="numeric" className="num" />}
        </Field>
        <Field label="Date">{(fid) => <Input id={fid} type="datetime-local" name="occurred_at" defaultValue={localInput()} required />}</Field>
      </div>
      <Field label="Note">{(fid) => <Input id={fid} name="note" placeholder={kind === 'restock' ? 'ex. repressage, livraison' : 'facultatif'} />}</Field>
      <p className="-mt-1 text-xs text-muted-foreground">{k.hint}</p>
    </FormDialog>
  )
}

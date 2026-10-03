// Corrections sur une vente : concert / note / commission, et remboursement.

import { Input } from '@/components/ui/input'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { fmt, fromCents, toCents } from '@/lib/format'

export function EditSaleDialog({ id, onClose }) {
  const { data: d, run } = useStore()
  const s = d.sales.find((x) => x.id === id)
  return (
    <FormDialog
      title="Modifier la vente"
      onClose={onClose}
      onSubmit={(f) => run(() => api('sale-update', { id, event: f.get('event'), note: f.get('note'), fees_cents: toCents(f.get('fees')) || 0 }), 'Vente modifiée')}
    >
      <Field label="Concert">{(fid) => <Input id={fid} name="event" defaultValue={s.event || ''} placeholder="ex. Lyon · La Marquise" autoFocus />}</Field>
      <Field label="Note">{(fid) => <Input id={fid} name="note" defaultValue={s.note || ''} />}</Field>
      <Field label="Commission">{(fid) => <MoneyInput id={fid} name="fees" defaultValue={fromCents(s.fees_cents)} />}</Field>
    </FormDialog>
  )
}

export function RefundDialog({ id, onClose }) {
  const { data: d, run } = useStore()
  const s = d.sales.find((x) => x.id === id)
  return (
    <FormDialog
      title="Rembourser"
      description={`Vente de ${fmt(s.total_cents)}. Total : la vente sort du CA et les articles reviennent en stock. Partiel : seul le montant est déduit.`}
      submitLabel="Rembourser"
      onClose={onClose}
      onSubmit={(f) => {
        const amount = toCents(f.get('amount'))
        const status = amount >= s.total_cents ? 'refunded' : 'partially_refunded'
        return run(() => api('sale-status', { id, status, refunded_cents: amount }), 'Remboursement enregistré')
      }}
    >
      <Field label="Montant remboursé">{(fid) => <MoneyInput id={fid} name="amount" defaultValue={fromCents(s.total_cents)} required autoFocus />}</Field>
    </FormDialog>
  )
}

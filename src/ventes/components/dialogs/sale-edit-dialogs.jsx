// Corrections sur une vente : concert / note / commission, remboursement, et nom du concert d'une soirée entière.

import { Input } from '@/components/ui/input'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { fmt, fromCents, toCents, dayLabel } from '@/lib/format'

export function EditSaleDialog({ id, onClose }) {
  const { data: d, run } = useStore()
  const s = d.sales.find((x) => x.id === id)
  return (
    <FormDialog
      title="Modifier la vente"
      onClose={onClose}
      onSubmit={(f) => run(() => api('sale-update', { id, event: f.get('event'), note: f.get('note'), fees_cents: toCents(f.get('fees')) || 0 }), 'Vente modifiée')}
    >
      <Field label="Concert">{(fid) => <Input id={fid} name="event" defaultValue={s.event || ''} placeholder="ex. Lyon · La Marquise" />}</Field>
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
      <Field label="Montant remboursé">{(fid) => <MoneyInput id={fid} name="amount" defaultValue={fromCents(s.total_cents)} required />}</Field>
    </FormDialog>
  )
}

// Renomme le concert d'une soirée : toutes ses ventes en caisse, et celles qui arriveront encore de SumUp ce soir-là.
export function RenameNightDialog({ night, ids, name, onClose }) {
  const { data: d, run } = useStore()
  const known = [...new Set(d.sales.map((s) => s.event).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  return (
    <FormDialog
      title="Nom du concert"
      description={`Soirée du ${dayLabel(night)}, ${ids.length} vente${ids.length > 1 ? 's' : ''}.`}
      onClose={onClose}
      onSubmit={(f) => run(() => api('night-rename', { ids, event: f.get('event') }), 'Concert renommé')}
    >
      <Field label="Concert">
        {(fid) => (
          <>
            <Input id={fid} name="event" defaultValue={name || ''} placeholder="ex. Lyon · La Marquise" list={`${fid}-list`} autoComplete="off" />
            <datalist id={`${fid}-list`}>
              {known.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </>
        )}
      </Field>
    </FormDialog>
  )
}

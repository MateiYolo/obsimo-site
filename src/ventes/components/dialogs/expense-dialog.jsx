// Dépense hors coût de revient : envois, emballages, stand, pub…

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { today, toCents } from '@/lib/format'

export const EXPENSE_CATEGORIES = ['envois', 'emballage', 'stand', 'pub', 'fabrication', 'autre']

export function ExpenseDialog({ onClose }) {
  const { run } = useStore()
  return (
    <FormDialog
      title="Nouvelle dépense"
      description="La fabrication des produits vendus est déjà comptée par leur coût de revient."
      onClose={onClose}
      onSubmit={(f) =>
        run(() => api('expense', { label: f.get('label'), amount_cents: toCents(f.get('amount')), occurred_at: f.get('occurred_at'), category: f.get('category') }), 'Dépense enregistrée')
      }
    >
      <Field label="Libellé">{(id) => <Input id={id} name="label" required autoFocus placeholder="ex. Enveloppes vinyles, Colissimo" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant">{(id) => <MoneyInput id={id} name="amount" required />}</Field>
        <Field label="Date">{(id) => <Input id={id} type="date" name="occurred_at" defaultValue={today()} required />}</Field>
      </div>
      <Field label="Catégorie">
        <Select name="category" defaultValue="envois">
          <SelectTrigger className="w-full capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  )
}

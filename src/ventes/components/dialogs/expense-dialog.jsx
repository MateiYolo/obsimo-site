// Dépense hors coût de revient : envois, emballages, stand, pub… et les versements au frère (qui soldent le reversement).

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { today, toCents } from '@/lib/format'
import { PAYOUT_CATEGORY } from '@/calc.js'

export const EXPENSE_CATEGORIES = ['envois', 'emballage', 'stand', 'pub', 'fabrication', PAYOUT_CATEGORY, 'autre']
export const categoryLabel = (c) => (c === PAYOUT_CATEGORY ? 'versement au frère' : c)

export function ExpenseDialog({ category = 'envois', label, onClose }) {
  const { run } = useStore()
  const payout = category === PAYOUT_CATEGORY
  return (
    <FormDialog
      title={payout ? 'Versement au frère' : 'Nouvelle dépense'}
      description={payout ? 'Ce qui lui a été versé : déduit du reste à verser, pas une deuxième fois du résultat.' : 'La fabrication des produits vendus est déjà comptée par leur coût de revient.'}
      onClose={onClose}
      onSubmit={(f) =>
        run(() => api('expense', { label: f.get('label'), amount_cents: toCents(f.get('amount')), occurred_at: f.get('occurred_at'), category: f.get('category') }), 'Dépense enregistrée')
      }
    >
      <Field label="Libellé">{(id) => <Input id={id} name="label" required defaultValue={label} placeholder="ex. Enveloppes vinyles, Colissimo" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant">{(id) => <MoneyInput id={id} name="amount" required />}</Field>
        <Field label="Date">{(id) => <Input id={id} type="date" name="occurred_at" defaultValue={today()} required />}</Field>
      </div>
      <Field label="Catégorie">
        <Select name="category" defaultValue={category}>
          <SelectTrigger className="w-full capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {categoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  )
}

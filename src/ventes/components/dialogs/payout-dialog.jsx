// Versement au frère : une sortie d'argent (catégorie reversement-frere) qui se déduit de ce qui lui est dû.

import { Input } from '@/components/ui/input'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { PAYOUT_CATEGORY } from '@/calc.js'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { fmt, today, toCents } from '@/lib/format'

export function PayoutDialog({ name, balance, onClose }) {
  const { run } = useStore()
  return (
    <FormDialog
      title={`Argent donné à ${name}`}
      description={balance > 0 ? `Il lui reste ${fmt(balance)} à toucher.` : undefined}
      onClose={onClose}
      onSubmit={(f) =>
        run(
          () =>
            api('expense', {
              label: f.get('label').trim() || `Versement à ${name}`,
              amount_cents: toCents(f.get('amount')),
              occurred_at: f.get('occurred_at'),
              category: PAYOUT_CATEGORY,
            }),
          'Versement noté',
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant">{(id) => <MoneyInput id={id} name="amount" required />}</Field>
        <Field label="Date">{(id) => <Input id={id} type="date" name="occurred_at" defaultValue={today()} required />}</Field>
      </div>
      <Field label="Note" hint="Pour te souvenir : en liquide après le concert, virement…">
        {(id) => <Input id={id} name="label" placeholder={`Versement à ${name}`} />}
      </Field>
    </FormDialog>
  )
}

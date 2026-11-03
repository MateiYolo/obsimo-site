// Synchro (pub, série, film…) : ce qui en revient à Matei, saisi directement, avec une description libre
// (ex. « 5 % de la synchro Valorant »). N'entre pas dans les chiffres du merch : ça s'ajoute seulement à son ardoise.

import { Input } from '@/components/ui/input'
import { Field, MoneyInput } from '@/components/field'
import { FormDialog } from './form-dialog'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useMatei } from '@/lib/derived'
import { fromCents, today, toCents } from '@/lib/format'

export function SynchroDialog({ synchro, onClose }) {
  const { run } = useStore()
  const { name } = useMatei()
  return (
    <FormDialog
      title={synchro ? 'Modifier la synchro' : 'Synchro'}
      description={`Ce que tu dois à ${name} sur une synchro. Ça ne compte pas dans le merch.`}
      onClose={onClose}
      onSubmit={(f) =>
        run(() => api('synchro', { id: synchro?.id, label: f.get('label'), date: f.get('date'), due_cents: toCents(f.get('due')) }), 'Ajouté à l’ardoise')
      }
    >
      <Field label={`Pour ${name}`}>{(id) => <MoneyInput id={id} name="due" defaultValue={fromCents(synchro?.due_cents)} required />}</Field>
      <Field label="Description">{(id) => <Input id={id} name="label" defaultValue={synchro?.label} placeholder="ex. 5 % de la synchro Valorant" required />}</Field>
      <Field label="Date">{(id) => <Input id={id} type="date" name="date" defaultValue={synchro?.date || today()} required />}</Field>
    </FormDialog>
  )
}

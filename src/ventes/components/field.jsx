// Champs de formulaire : libellé, contrôle, aide. Montants en euros avec le symbole dans le champ.

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function Field({ label, hint, children, className, id: idProp }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function MoneyInput({ className, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <Input inputMode="decimal" autoComplete="off" className="num pr-7 text-right" {...props} />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">€</span>
    </div>
  )
}

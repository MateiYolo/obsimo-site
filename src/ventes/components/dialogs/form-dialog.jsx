// Fenêtre de formulaire standard : titre, champs, Annuler / Enregistrer (⌘↵), bouton bloqué pendant l'envoi.

import { useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FormDialog({ title, description, submitLabel = 'Enregistrer', onSubmit, onClose, children, className }) {
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if ((await onSubmit(new FormData(e.currentTarget), e.currentTarget)) !== false) onClose()
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn('gap-0 p-0 sm:max-w-md', className)}
        // le curseur dans le premier champ à remplir, pas sur le premier bouton
        onOpenAutoFocus={(e) => {
          const input = e.currentTarget.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea')
          if (input) e.preventDefault(), input.focus()
        }}
      >
        <form onSubmit={submit} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.requestSubmit()}>
          <DialogHeader className="px-5 pt-5 pb-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-4 px-5 pb-5">{children}</div>
          <DialogFooter className="border-t bg-muted/30 px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

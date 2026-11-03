// Le « + » de la barre du bas : tout ce qu'on note au téléphone, en deux touches.

import { Banknote, Clapperboard, Gift, ShoppingBag } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUI } from '@/lib/ui'
import { useMatei } from '@/lib/derived'
import { fmt } from '@/lib/format'

export function QuickMenu({ onClose }) {
  const { open } = useUI()
  const m = useMatei()
  const items = [
    ['sale', {}, ShoppingBag, 'Vente', 'espèces, Bandcamp, disquaire…'],
    ['move', { reason: 'gift' }, Gift, 'Don', 'un vinyle offert, une perte'],
    ['payout', {}, Banknote, `J’ai payé ${m.name}`, m.balance > 0 ? `il reste ${fmt(m.balance)}` : 'à jour'],
    ['synchro', {}, Clapperboard, 'Synchro', `sa part d’une pub, d’une série`],
  ]
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 text-left">
          <DialogTitle>Noter…</DialogTitle>
          <DialogDescription className="sr-only">Choisis ce que tu veux noter</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {items.map(([name, props, Icon, label, hint]) => (
            <button
              key={name}
              type="button"
              onClick={() => open(name, props)}
              className="flex min-h-24 flex-col items-start justify-between rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/50 active:scale-[0.98] active:bg-accent"
            >
              <Icon className="size-5 text-muted-foreground" />
              <span>
                <span className="block text-sm font-semibold leading-tight">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

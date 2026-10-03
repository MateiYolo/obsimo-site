// Détail d'une vente dans un panneau latéral : articles, du total à la marge, actions (modifier, rembourser, supprimer).

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Confirm } from '@/components/confirm'
import { ChannelLabel } from '@/components/channel'
import { metrics } from '@/calc.js'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { fmt, dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export const STATUS = {
  paid: { label: 'Payée', className: '' },
  partially_refunded: { label: 'Remb. partiel', className: 'border-warning/40 text-warning' },
  refunded: { label: 'Remboursée', className: 'text-muted-foreground' },
  cancelled: { label: 'Annulée', className: 'text-muted-foreground' },
}

export function SaleSheet({ id, onClose }) {
  const { data: d, run } = useStore()
  const { open } = useUI()
  const s = d.sales.find((x) => x.id === id)
  const m = metrics(s)
  const name = (l) => d.products.find((x) => x.id === l.product_id)?.name
  const margin = m.revenue - m.fees - m.cogs

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="gap-3 border-b p-5">
          <div className="flex items-center gap-2 text-xs">
            <ChannelLabel channel={s.channel} long />
            {s.status !== 'paid' && (
              <Badge variant="outline" className={cn('font-normal', STATUS[s.status].className)}>
                {STATUS[s.status].label}
              </Badge>
            )}
          </div>
          <SheetTitle className="num text-2xl font-semibold tracking-tight">{fmt(s.total_cents)}</SheetTitle>
          <SheetDescription className="first-letter:uppercase">
            {dateTime(s.occurred_at)}
            {s.event && <> · {s.event}</>}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Articles</h3>
            <ul className="divide-y rounded-lg border">
              {s.lines.map((l, i) => (
                <li key={l.id ?? i} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="num w-6 text-muted-foreground">{l.qty}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{name(l) || l.label}</span>
                    {!l.product_id ? (
                      <span className="text-xs text-warning">Pas associé à un produit</span>
                    ) : (
                      name(l) !== l.label && <span className="text-xs text-muted-foreground">« {l.label} »</span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className="num block">{fmt(l.unit_price_cents * l.qty)}</span>
                    <span className="num text-xs text-muted-foreground">{l.unit_cost_cents == null ? 'coût ?' : `coût ${fmt(l.unit_cost_cents * l.qty)}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Du total à la marge</h3>
            <dl className="space-y-1.5">
              <Row label="Total payé" value={fmt(s.total_cents)} />
              {s.shipping_cents > 0 && <Row label="dont frais de port" value={fmt(s.shipping_cents)} muted />}
              {s.refunded_cents > 0 && <Row label="Remboursé" value={`− ${fmt(s.refunded_cents)}`} />}
              <Row label={`Commission${s.payment_method ? ` (${s.payment_method})` : ''}`} value={`− ${fmt(m.fees)}`} />
              <Row label="Coût de revient" value={`− ${fmt(m.cogs)}`} />
              <Separator className="my-2" />
              <Row label="Marge" value={fmt(margin)} strong className={margin < 0 ? 'text-destructive' : ''} />
            </dl>
          </section>

          {(s.note || s.external_id) && (
            <section className="space-y-1 text-xs text-muted-foreground">
              {s.note && <p>Note : {s.note}</p>}
              {s.external_id && <p className="font-mono">Réf. {s.external_id}</p>}
            </section>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => open('edit-sale', { id })}>
            <Pencil /> Modifier
          </Button>
          {(s.status === 'paid' || s.status === 'partially_refunded') && (
            <Button variant="outline" size="sm" onClick={() => open('refund', { id })}>
              <RotateCcw /> Rembourser
            </Button>
          )}
          <Confirm
            title="Supprimer cette vente ?"
            description={`Ses articles reviennent dans le stock.${s.external_id ? ' Une vente importée reviendra au prochain import : pour une commande annulée, préfère « Rembourser ».' : ''}`}
            onConfirm={() => run(() => api('sale-delete', { id }), 'Vente supprimée').then(onClose)}
          >
            <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive">
              <Trash2 /> Supprimer
            </Button>
          </Confirm>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value, muted, strong, className }) {
  return (
    <div className={cn('flex justify-between', muted && 'pl-3 text-xs text-muted-foreground', strong && 'font-medium')}>
      <dt className={cn(!strong && !muted && 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('num', className)}>{value}</dd>
    </div>
  )
}

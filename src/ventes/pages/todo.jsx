// À traiter : tout ce qui fausse les chiffres ou demande un geste (articles inconnus, coûts manquants, stock bas).

import { useState } from 'react'
import { CircleCheck, Link2, PackageX, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Page, Section, Empty } from '@/components/page'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useTodo } from '@/lib/derived'
import { PAGES } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function Todo() {
  const todo = useTodo()
  const { open } = useUI()
  return (
    <Page title={PAGES['a-traiter'].label} icon={PAGES['a-traiter'].icon} count={todo.count || null} className="mx-auto w-full max-w-3xl space-y-8">
      {!todo.count && (
        <Empty icon={CircleCheck} title="Tout est à jour">
          Chaque article vendu a son produit, chaque produit son coût, et aucun stock n’est bas.
        </Empty>
      )}

      {todo.unmapped.length > 0 && (
        <Section
          title="Articles à associer"
          description="Ces noms viennent de la caisse SumUp ou de Shopify sans produit correspondant : ils comptent dans le CA, pas dans le stock ni la marge. Une fois associé, le nom est retenu pour les ventes suivantes."
        >
          <List>
            {todo.unmapped.map((u) => (
              <AssignRow key={u.label} item={u} />
            ))}
          </List>
        </Section>
      )}

      {todo.noCost.length > 0 && (
        <Section title="Coût de revient manquant" description="Sans coût, la marge de ces produits est surestimée.">
          <List>
            {todo.noCost.map((p) => (
              <Row key={p.id} icon={Tag} title={p.name} meta={p.price_cents != null ? 'prix renseigné, coût inconnu' : 'ni prix ni coût'}>
                <Button size="sm" variant="outline" onClick={() => open('product', { id: p.id })}>
                  Renseigner
                </Button>
              </Row>
            ))}
          </List>
        </Section>
      )}

      {todo.stock.length > 0 && (
        <Section title="Stock bas" description="Produits déjà vendus avec 5 exemplaires ou moins. Un stock négatif veut dire qu’un inventaire manque.">
          <List>
            {todo.stock.map((p) => (
              <Row
                key={p.id}
                icon={PackageX}
                iconClass={p.stock <= 0 ? 'text-destructive' : 'text-warning'}
                title={p.name}
                meta={<span className={cn('num', p.stock <= 0 ? 'text-destructive' : 'text-warning')}>{p.stock < 0 ? `${p.stock} (négatif)` : p.stock === 0 ? 'rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}</span>}
              >
                <Button size="sm" variant="ghost" onClick={() => open('move', { id: p.id, reason: 'adjust' })}>
                  Inventaire
                </Button>
                <Button size="sm" variant="outline" onClick={() => open('move', { id: p.id, reason: 'restock' })}>
                  Réassort
                </Button>
              </Row>
            ))}
          </List>
        </Section>
      )}
    </Page>
  )
}

const List = ({ children }) => <ul className="divide-y overflow-hidden rounded-lg border bg-card">{children}</ul>

function Row({ icon: Icon, iconClass, title, meta, children }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Icon className={cn('size-4 shrink-0 text-muted-foreground', iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex gap-2 max-sm:w-full max-sm:pl-7 max-sm:[&>*]:flex-1">{children}</div>
    </li>
  )
}

function AssignRow({ item }) {
  const { data: d, run } = useStore()
  const [pid, setPid] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Row icon={Link2} iconClass="text-warning" title={`« ${item.label} »`} meta={`${item.qty} vendu${item.qty > 1 ? 's' : ''} · ${item.sales} vente${item.sales > 1 ? 's' : ''}`}>
      <Select value={pid} onValueChange={setPid}>
        <SelectTrigger size="sm" className="sm:w-48">
          <SelectValue placeholder="Choisir un produit…" />
        </SelectTrigger>
        <SelectContent>
          {d.products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!pid || busy}
        onClick={() => {
          setBusy(true)
          run(() => api('assign', { label: item.label, product_id: pid }), (o) => `« ${item.label} » associé (${o.lines} ligne${o.lines > 1 ? 's' : ''})`).catch(() => setBusy(false))
        }}
      >
        Associer
      </Button>
    </Row>
  )
}

// Palette ⌘K : aller à une page, lancer une action, ouvrir un produit ou une vente récente.

import { Download, Moon, Plus, RefreshCw, Sun, Package, Wallet, Boxes } from 'lucide-react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { Keys } from '@/components/shortcut'
import { ChannelIcon } from '@/components/channel'
import { NAV, PAGES } from '@/lib/nav'
import { navigate } from '@/lib/router'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { usePeriod } from '@/lib/derived'
import { downloadCsv, syncSumup, sumupMessage } from '@/lib/actions'
import { fmt, dateShort } from '@/lib/format'
import { metrics } from '@/calc.js'

export function CommandMenu() {
  const { data: d, run } = useStore()
  const { commandOpen, setCommandOpen, open, theme, setTheme } = useUI()
  const p = usePeriod()
  const go = (fn) => () => {
    setCommandOpen(false)
    fn()
  }
  const name = (l) => d.products.find((x) => x.id === l.product_id)?.name || l.label

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Rechercher" description="Pages, actions, produits et ventes" className="top-[20%] translate-y-0 sm:max-w-xl max-sm:top-2 max-sm:bottom-auto max-sm:left-2 max-sm:w-[calc(100%-1rem)] max-sm:rounded-2xl max-sm:border max-sm:data-[state=open]:slide-in-from-top max-sm:data-[state=closed]:slide-out-to-top" showCloseButton={false}>
      <CommandInput placeholder="Rechercher une page, une action, un produit…" />
      <CommandList className="max-h-[min(420px,60vh)]">
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={go(() => open('sale'))}>
            <Plus /> Nouvelle vente <CommandShortcut><Keys keys="n" /></CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go(() => open('expense'))}>
            <Wallet /> Nouvelle dépense
          </CommandItem>
          <CommandItem onSelect={go(() => open('product'))}>
            <Package /> Nouveau produit
          </CommandItem>
          <CommandItem onSelect={go(() => open('move', { reason: 'restock' }))}>
            <Boxes /> Réassort…
          </CommandItem>
          {d.integrations.sumup && (
            <CommandItem onSelect={go(() => run(() => syncSumup(), sumupMessage))}>
              <RefreshCw /> Synchroniser SumUp
            </CommandItem>
          )}
          <CommandItem onSelect={go(() => downloadCsv(`obsimo-ventes-${p.period}.csv`, p.sales, d.products))}>
            <Download /> Exporter les ventes en CSV <span className="text-muted-foreground">· {p.label}</span>
          </CommandItem>
          <CommandItem onSelect={go(() => setTheme(theme === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? <Moon /> : <Sun />} Passer en thème {theme === 'light' ? 'sombre' : 'clair'}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Aller à">
          {[...NAV.flatMap((g) => g.items), 'reglages'].map((k) => {
            const pg = PAGES[k]
            return (
              <CommandItem key={k} value={`page ${pg.label}`} onSelect={go(() => navigate(k))}>
                <pg.icon /> {pg.label}
                <CommandShortcut>
                  <Keys keys={`g ${pg.key}`} />
                </CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Produits">
          {d.products.map((x) => (
            <CommandItem key={x.id} value={`produit ${x.name} ${x.sumup_names.join(' ')}`} onSelect={go(() => open('product', { id: x.id }))}>
              <Package /> {x.name}
              {!x.components.length && <span className="num ml-auto text-xs text-muted-foreground">{x.stock} en stock</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ventes récentes">
          {d.sales.slice(0, 30).map((s) => (
            <CommandItem
              key={s.id}
              value={`vente ${s.id} ${s.lines.map(name).join(' ')} ${s.event || ''} ${s.note || ''}`}
              onSelect={go(() => navigate('ventes', { vente: s.id }))}
            >
              <ChannelIcon channel={s.channel} />
              <span className="truncate">{s.lines.map((l) => `${l.qty > 1 ? `${l.qty}× ` : ''}${name(l)}`).join(', ')}</span>
              <span className="num ml-auto shrink-0 text-xs text-muted-foreground">
                {dateShort(s.occurred_at)} · {fmt(metrics(s).revenue)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground pointer-coarse:hidden">
        <span className="flex items-center gap-1"><Keys keys="↑ ↓" /> naviguer</span>
        <span className="flex items-center gap-1"><Keys keys="↵" /> ouvrir</span>
        <span className="ml-auto flex items-center gap-1"><Keys keys="esc" /> fermer</span>
      </div>
    </CommandDialog>
  )
}

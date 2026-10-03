// Ventes : liste dense groupée par jour (comme une liste d'issues Linear), filtres canal / statut / soirée,
// recherche (/), navigation clavier (j / k, Entrée) et détail dans un panneau latéral (#/ventes?vente=ID).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, ListFilter, Plus, ReceiptText, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Page, Empty } from '@/components/page'
import { PeriodSelect } from '@/components/period-select'
import { ChannelIcon, CHANNEL_META } from '@/components/channel'
import { Hint, Keys } from '@/components/shortcut'
import { SaleSheet, STATUS } from '@/components/sale-sheet'
import { metrics, nightOf, dayOf, CHANNELS } from '@/calc.js'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { usePeriod } from '@/lib/derived'
import { useRoute } from '@/lib/router'
import { useHotkeys } from '@/lib/hotkeys'
import { downloadCsv, syncSumup, sumupMessage } from '@/lib/actions'
import { PAGES } from '@/lib/nav'
import { fmt, time, dayLabel, num } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 200

export function Sales() {
  const { data: d, run } = useStore()
  const { open } = useUI()
  const p = usePeriod()
  const { params, setParams } = useRoute()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [cursor, setCursor] = useState(-1)
  const search = useRef(null)
  const list = useRef(null)

  const channels = params.canal ? params.canal.split(',') : []
  const statuses = params.statut ? params.statut.split(',') : []
  const night = params.nuit || null
  const selected = params.vente || null
  const name = (l) => d.products.find((x) => x.id === l.product_id)?.name || l.label

  // une soirée ou une vente précise : on cherche dans tout l'historique, pas seulement la période
  const source = night ? d.sales : p.sales
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return source.filter(
      (s) =>
        (!channels.length || channels.includes(s.channel)) &&
        (!statuses.length || statuses.includes(s.status)) &&
        (!night || (['sumup', 'cash'].includes(s.channel) && nightOf(s.occurred_at) === night)) &&
        (!needle || [s.event, s.note, s.external_id, ...s.lines.map(name)].some((v) => v && String(v).toLowerCase().includes(needle))),
    )
  }, [source, q, params.canal, params.statut, night]) // eslint-disable-line

  const shown = filtered.slice(0, limit)
  const groups = useMemo(() => {
    const out = []
    for (const s of shown) {
      const day = dayOf(s.occurred_at)
      let g = out[out.length - 1]
      if (!g || g.day !== day) out.push((g = { day, sales: [], total: 0 }))
      g.sales.push(s)
      g.total += metrics(s).revenue
    }
    return out
  }, [shown])
  const total = filtered.reduce((a, s) => a + metrics(s).revenue, 0)

  const openSale = (id) => setParams({ vente: id })
  useEffect(() => setCursor(-1), [q, params.canal, params.statut, night, p.period])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  useHotkeys({
    '/': () => search.current?.focus(),
    j: () => setCursor((c) => Math.min(shown.length - 1, c + 1)),
    k: () => setCursor((c) => Math.max(0, c - 1)),
    arrowdown: () => setCursor((c) => Math.min(shown.length - 1, c + 1)),
    arrowup: () => setCursor((c) => Math.max(0, c - 1)),
    enter: () => cursor >= 0 && shown[cursor] && openSale(shown[cursor].id),
  })

  const toggle = (key, list, v) => setParams({ [key]: (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(',') || null })
  const filters = channels.length + statuses.length + (night ? 1 : 0)
  let index = -1

  return (
    <Page
      title={PAGES.ventes.label}
      icon={PAGES.ventes.icon}
      count={num.format(filtered.length)}
      actions={
        <>
          {!night && <PeriodSelect />}
          {d.integrations.sumup && (
            <Hint label="Importer les dernières ventes SumUp">
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={(e) => run(() => syncSumup(), sumupMessage)} aria-label="Synchroniser SumUp">
                <RefreshCw />
              </Button>
            </Hint>
          )}
          <Hint label="Exporter la sélection en CSV">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground max-sm:hidden" onClick={() => downloadCsv(`obsimo-ventes-${night || p.period}.csv`, filtered, d.products)} aria-label="Exporter en CSV">
              <Download />
            </Button>
          </Hint>
          <Hint label="Nouvelle vente" keys="n">
            <Button size="sm" onClick={() => open('sale')} aria-label="Nouvelle vente">
              <Plus /> <span className="hidden sm:inline">Vente</span>
            </Button>
          </Hint>
        </>
      }
      toolbar={
        <>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setQ(''), e.currentTarget.blur())}
              placeholder="Produit, concert, note…"
              className="h-8 pl-8 text-[13px]"
            />
            {!q && <Keys keys="/" className="absolute top-1/2 right-2 -translate-y-1/2 max-sm:hidden" />}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
                <ListFilter /> Filtrer
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Canal</DropdownMenuLabel>
              {Object.keys(CHANNELS).map((c) => (
                <DropdownMenuCheckboxItem key={c} checked={channels.includes(c)} onCheckedChange={() => toggle('canal', channels, c)} onSelect={(e) => e.preventDefault()}>
                  <ChannelIcon channel={c} /> {CHANNEL_META[c].long}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Statut</DropdownMenuLabel>
              {Object.entries(STATUS).map(([k, v]) => (
                <DropdownMenuCheckboxItem key={k} checked={statuses.includes(k)} onCheckedChange={() => toggle('statut', statuses, k)} onSelect={(e) => e.preventDefault()}>
                  {v.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {channels.map((c) => (
            <Chip key={c} onRemove={() => toggle('canal', channels, c)}>
              <ChannelIcon channel={c} /> {CHANNEL_META[c].long}
            </Chip>
          ))}
          {statuses.map((s) => (
            <Chip key={s} onRemove={() => toggle('statut', statuses, s)}>
              {STATUS[s].label}
            </Chip>
          ))}
          {night && <Chip onRemove={() => setParams({ nuit: null })}>Soirée du {dayLabel(night, false)}</Chip>}
          {filters > 1 && (
            <Button variant="link" size="xs" className="text-muted-foreground" onClick={() => setParams({ canal: null, statut: null, nuit: null })}>
              Tout effacer
            </Button>
          )}
          <span className="num ml-auto hidden text-xs text-muted-foreground sm:block">{fmt(total, true)}</span>
        </>
      }
      className="p-0 md:p-0"
    >
      {shown.length ? (
        <div ref={list} role="listbox" aria-label="Ventes" className="pb-10">
          {groups.map((g) => (
            <div key={g.day}>
              <div className="sticky top-12 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 text-xs backdrop-blur md:px-6">
                <span className="font-medium first-letter:uppercase">{dayLabel(g.day)}</span>
                <span className="text-muted-foreground">{g.sales.length}</span>
                <span className="num ml-auto text-muted-foreground">{fmt(g.total)}</span>
              </div>
              {g.sales.map((s) => {
                index++
                const i = index
                const m = metrics(s)
                return (
                  <button
                    key={s.id}
                    data-index={i}
                    role="option"
                    aria-selected={selected === s.id}
                    onClick={() => (setCursor(i), openSale(s.id))}
                    className={cn(
                      'group flex w-full items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/60 md:px-6',
                      (cursor === i || selected === s.id) && 'bg-accent',
                    )}
                  >
                    <ChannelIcon channel={s.channel} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {s.lines.map((l, j) => (
                          <span key={l.id ?? j}>
                            {j > 0 && <span className="text-muted-foreground">, </span>}
                            {l.qty > 1 && <span className="num text-muted-foreground">{l.qty} × </span>}
                            {name(l)}
                            {!l.product_id && <span className="ml-1 text-xs text-warning">?</span>}
                          </span>
                        ))}
                      </span>
                      {(s.event || s.note) && <span className="block truncate text-xs text-muted-foreground">{[s.event, s.note].filter(Boolean).join(' · ')}</span>}
                    </span>
                    {s.status !== 'paid' && (
                      <Badge variant="outline" className={cn('hidden font-normal sm:inline-flex', STATUS[s.status].className)}>
                        {STATUS[s.status].label}
                      </Badge>
                    )}
                    <span className="hidden w-32 truncate text-xs text-muted-foreground lg:block">{CHANNEL_META[s.channel]?.long}</span>
                    <span className="num w-11 text-right text-xs text-muted-foreground">{time(s.occurred_at)}</span>
                    <span className={cn('num w-20 text-right font-medium', s.status === 'refunded' || s.status === 'cancelled' ? 'text-muted-foreground line-through' : '')}>
                      {fmt(s.status === 'refunded' || s.status === 'cancelled' ? s.total_cents : m.revenue)}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length > shown.length && (
            <div className="flex justify-center p-4">
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Afficher {Math.min(PAGE_SIZE, filtered.length - shown.length)} de plus
              </Button>
            </div>
          )}
          <p className="hidden items-center justify-center gap-3 pt-6 text-xs text-muted-foreground md:flex">
            <span className="flex items-center gap-1"><Keys keys="j k" /> naviguer</span>
            <span className="flex items-center gap-1"><Keys keys="↵" /> ouvrir</span>
            <span className="flex items-center gap-1"><Keys keys="/" /> rechercher</span>
          </p>
        </div>
      ) : (
        <div className="p-4 md:p-6">
          <Empty
            icon={ReceiptText}
            title={q || filters ? 'Aucune vente ne correspond' : 'Aucune vente sur la période'}
            action={
              q || filters ? (
                <Button variant="outline" size="sm" onClick={() => (setQ(''), setParams({ canal: null, statut: null, nuit: null }))}>
                  Effacer les filtres
                </Button>
              ) : (
                <Button size="sm" onClick={() => open('sale')}>
                  <Plus /> Saisir une vente
                </Button>
              )
            }
          >
            {q || filters ? 'Essaie une autre recherche ou retire un filtre.' : 'Les ventes du site et de SumUp arrivent toutes seules. Le reste se saisit ici.'}
          </Empty>
        </div>
      )}
      {selected != null && d.sales.some((s) => s.id === selected) && <SaleSheet id={selected} onClose={() => setParams({ vente: null })} />}
    </Page>
  )
}

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-secondary/50 pr-1 pl-2 text-xs [&_svg]:size-3">
      {children}
      <button onClick={onRemove} className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Retirer le filtre">
        <X />
      </button>
    </span>
  )
}

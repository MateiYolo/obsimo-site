// Réglages : commissions par canal, connexions (Shopify, SumUp) et imports, apparence, session.

import { useState } from 'react'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Page } from '@/components/page'
import { MoneyInput } from '@/components/field'
import { ChannelIcon, CHANNEL_META } from '@/components/channel'
import { CHANNELS } from '@/calc.js'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { syncShopify, shopifyMessage, syncSumup, sumupMessage } from '@/lib/actions'
import { PAGES } from '@/lib/nav'
import { fromCents, toCents } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Settings() {
  const { data: d, run, logout } = useStore()
  const { theme, setTheme } = useUI()
  const i = d.integrations
  return (
    <Page title={PAGES.reglages.label} icon={PAGES.reglages.icon} className="mx-auto w-full max-w-3xl space-y-6">
      <Fees />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-5">
          <CardTitle className="text-sm font-medium">Connexions</CardTitle>
          <CardDescription className="text-xs">Les ventes du site et de la caisse arrivent toutes seules.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y px-0">
          <Integration channel="shopify" title="Shopify · ventes du site en direct" on={i.shopifyWebhook} detail="Webhooks « Paiement de commande » et « Mise à jour de commande » vers /api/webhooks/shopify." />
          <Integration channel="shopify" title="Shopify · historique et stock" on={i.shopifyAdmin} detail={i.shopifyAdmin ? 'Importer les anciennes commandes :' : 'Accès Admin API (SHOPIFY_ADMIN_TOKEN, ou client id / secret).'}>
            {i.shopifyAdmin && <SinceForm defaultValue="2024-01-01" label="Importer" onRun={(since) => run(() => syncShopify(since), shopifyMessage)} />}
          </Integration>
          <Integration channel="sumup" title="SumUp · caisse des concerts" on={i.sumup} detail={i.sumup ? 'Import automatique tous les matins. Réimporter depuis une date :' : 'Clé API SumUp (SUMUP_API_KEY).'}>
            {i.sumup && <SinceForm label="Réimporter" onRun={(since) => run(() => syncSumup(since), sumupMessage)} />}
          </Integration>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="py-5">
          <CardTitle className="text-sm font-medium">Apparence</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ToggleGroup type="single" variant="outline" value={theme} onValueChange={(v) => v && setTheme(v)}>
            <ToggleGroupItem value="dark" className="gap-1.5 px-3 text-[13px]">
              <Moon /> Sombre
            </ToggleGroupItem>
            <ToggleGroupItem value="light" className="gap-1.5 px-3 text-[13px]">
              <Sun /> Clair
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="gap-1.5 px-3 text-[13px]">
              <Monitor /> Appareil
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={logout}>
          <LogOut /> Se déconnecter
        </Button>
      </div>
    </Page>
  )
}

function Fees() {
  const { data: d, run } = useStore()
  const initial = () => Object.fromEntries(Object.entries(d.fees || {}).map(([k, f]) => [k, { pct: String(f.pct).replace('.', ','), fixed: fromCents(f.fixed_cents) || '0' }]))
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial())
  const set = (k, field) => (e) => setForm((f) => ({ ...f, [k]: { ...f[k], [field]: e.target.value } }))

  async function save(e) {
    e.preventDefault()
    const fees = structuredClone(d.fees)
    for (const k of Object.keys(fees)) {
      fees[k].pct = parseFloat(String(form[k].pct).replace(',', '.')) || 0
      fees[k].fixed_cents = toCents(form[k].fixed) || 0
    }
    setBusy(true)
    await run(() => api('fees', { fees }), 'Commissions enregistrées (pour les prochaines ventes)').catch(() => {})
    setBusy(false)
  }

  return (
    <Card className="gap-0 py-0">
      <form onSubmit={save}>
        <CardHeader className="border-b py-5">
          <CardTitle className="text-sm font-medium">Commissions par canal</CardTitle>
          <CardDescription className="text-xs">Estimées sur chaque nouvelle vente : un pourcentage du total plus un fixe. Modifiables vente par vente.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y px-0">
          {Object.entries(d.fees || {}).map(([k, f]) => (
            <div key={k} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <span className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                {CHANNELS[k] && <ChannelIcon channel={k} />}
                {f.label || CHANNEL_META[k]?.long || k}
              </span>
              <div className="relative w-24">
                <Input inputMode="decimal" value={form[k].pct} onChange={set(k, 'pct')} className="num pr-7 text-right" aria-label={`Pourcentage ${k}`} />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <span className="text-muted-foreground">+</span>
              <MoneyInput className="w-24" value={form[k].fixed} onChange={set(k, 'fixed')} aria-label={`Fixe ${k}`} />
            </div>
          ))}
        </CardContent>
        <CardFooter className={cn('justify-end gap-2 border-t bg-muted/30 py-3 transition-opacity', !dirty && 'opacity-60')}>
          {dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial())}>
              Annuler
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!dirty || busy}>
            Enregistrer
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function Integration({ channel, title, on, detail, children }) {
  return (
    <div className="flex flex-col gap-2 px-6 py-4">
      <div className="flex items-center gap-2 text-sm">
        <ChannelIcon channel={channel} />
        <span className="font-medium">{title}</span>
        <Badge variant="outline" className={cn('ml-auto gap-1.5 font-normal', on ? 'text-success' : 'text-muted-foreground')}>
          <span className={cn('size-1.5 rounded-full', on ? 'bg-success' : 'bg-muted-foreground/50')} />
          {on ? 'Connecté' : 'Pas encore'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
      {children}
    </div>
  )
}

function SinceForm({ defaultValue = '', label, onRun }) {
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const since = e.currentTarget.since.value
        if (!since) return
        setBusy(true)
        await onRun(since).catch(() => {})
        setBusy(false)
      }}
    >
      <Input type="date" name="since" defaultValue={defaultValue} required className="h-8 w-40" />
      <Button size="sm" variant="outline" disabled={busy}>
        {busy ? 'Import…' : label}
      </Button>
    </form>
  )
}

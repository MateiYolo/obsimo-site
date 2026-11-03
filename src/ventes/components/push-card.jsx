// Réglages → Notifications : activer les notifications de vente sur ce téléphone. Chaque téléphone s'active à part
// (le tien, celui de Matei). Sur iPhone : iOS 16.4 ou plus, et l'appli ouverte depuis l'écran d'accueil.

import { useEffect, useState } from 'react'
import { Bell, BellOff, Send, Share } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api, deviceId } from '@/lib/api'
import { useStore } from '@/lib/store'
import { dateMedium } from '@/lib/format'

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// la clé publique du serveur, au format attendu par pushManager.subscribe
const toKey = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export function PushCard() {
  const { data: d, run } = useStore()
  const me = deviceId()
  const mine = (d.push || []).find((x) => x.device === me)
  const [name, setName] = useState(mine?.name || '')
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(() => supported() && Notification.permission === 'denied')
  useEffect(() => setName((n) => n || mine?.name || ''), [mine?.name])

  async function enable() {
    setBusy(true)
    try {
      // la demande d'autorisation doit partir tout de suite du toucher (sinon iOS l'ignore)
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setDenied(perm === 'denied')
        toast.error('Notifications refusées sur ce téléphone')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const { publicKey } = await api('push-key', {})
      const old = await reg.pushManager.getSubscription()
      const sub = old || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))
      await run(() => api('push-subscribe', { subscription: sub.toJSON(), name: name || 'Téléphone' }), 'Notifications activées')
      await api('push-test', {})
    } catch (e) {
      toast.error(`Impossible d’activer : ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      await sub?.unsubscribe()
      await run(() => api('push-unsubscribe', { endpoint: sub?.endpoint }), 'Notifications coupées sur ce téléphone')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  let body
  if (ios() && !installed())
    body = (
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          Dans Safari, touche <Share className="inline size-4 -translate-y-0.5" /> <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>.
        </li>
        <li>Ouvre l’appli « Ventes » depuis son icône.</li>
        <li>Reviens ici (Menu → Réglages) pour activer.</li>
      </ol>
    )
  else if (!supported()) body = <p className="text-sm text-muted-foreground">Ce navigateur ne sait pas recevoir de notifications. Sur iPhone, il faut iOS 16.4 ou plus récent.</p>
  else if (denied)
    body = <p className="text-sm text-muted-foreground">Tu as refusé les notifications. Pour changer d’avis : Réglages de l’iPhone → Notifications → Ventes → Autoriser.</p>
  else if (mine)
    body = (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => api('push-test', {}).then(() => toast('Notification envoyée'))}>
          <Send /> M’envoyer un test
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={disable}>
          <BellOff /> Couper sur ce téléphone
        </Button>
      </div>
    )
  else
    body = (
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" className="max-w-40" aria-label="Prénom" />
        <Button disabled={busy} onClick={enable}>
          <Bell /> Activer ici
        </Button>
      </div>
    )

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-medium">Notifications de vente</CardTitle>
        <CardDescription className="text-xs">
          Une notif à chaque vente sur le site (tout de suite) ou saisie à la main. Les ventes à la caisse SumUp arrivent avec l’import du matin, en une seule notif. Pas de notif pour ce que tu saisis toi-même.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {body}
        {(d.push || []).length > 0 && (
          <p className="text-xs text-muted-foreground">
            Activé sur : {(d.push || []).map((x) => `${x.name || 'un téléphone'}${x.device === me ? ' (ce téléphone)' : ''} depuis le ${dateMedium(x.at)}`).join(' · ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

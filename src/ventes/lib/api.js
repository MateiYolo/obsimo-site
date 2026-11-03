// Appels à /api/ventes (une seule fonction, l'action dans ?a=…). Cookie de session httpOnly.
//
// Sans réseau (cave, club) : les saisies (vente, don, versement, synchro…) ne sont pas perdues. Elles sont gardées
// sur le téléphone et envoyées dès que ça capte (flushQueue, appelé par lib/store.jsx). Une vente porte un
// client_id : renvoyée deux fois, elle n'est enregistrée qu'une fois (merch_record_sale ignore les doublons).

export class AuthError extends Error {}

// les saisies qu'on peut garder pour plus tard ; le reste (imports, réglages, suppressions) demande du réseau
const QUEUEABLE = ['sale', 'movement', 'expense', 'synchro']
const KEY = 'ventes-queue'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

// identifiant de ce téléphone (pas de notification pour ses propres saisies)
export function deviceId() {
  try {
    let id = localStorage.getItem('ventes-device')
    if (!id) localStorage.setItem('ventes-device', (id = uid()))
    return id
  } catch {
    return ''
  }
}

export function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function writeQueue(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q))
  } catch {}
  window.dispatchEvent(new Event('ventes-queue'))
}
export function dropQueued(qid) {
  writeQueue(readQueue().filter((x) => x.qid !== qid))
}

async function send(action, body) {
  const res = await fetch(`/api/ventes${action ? `?a=${action}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify({ device: deviceId(), ...body }),
    credentials: 'same-origin',
  })
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }))
  if (res.status === 401 && action !== 'login') throw new AuthError('Session expirée')
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status })
  return json
}

const offlineError = (e) => !navigator.onLine || e instanceof TypeError // fetch qui n'aboutit pas

export async function api(action, body) {
  if (action === 'sale' && body && !body.client_id) body = { ...body, client_id: uid() }
  if (!QUEUEABLE.includes(action)) return send(action, body)
  try {
    if (!navigator.onLine) throw new TypeError('hors ligne')
    return await send(action, body)
  } catch (e) {
    if (!offlineError(e)) throw e
    const qid = uid()
    writeQueue([...readQueue(), { qid, action, body, at: new Date().toISOString() }])
    return { queued: true, qid }
  }
}

// Envoie ce qui attend, dans l'ordre. S'arrête au premier souci de réseau ; une saisie refusée par le serveur
// (données invalides) est retirée et signalée. Renvoie { sent, failed: [messages] }.
let flushing = null
export function flushQueue() {
  flushing ||= (async () => {
    const out = { sent: 0, failed: [] }
    try {
      for (const item of readQueue()) {
        try {
          await send(item.action, item.body)
          out.sent++
          dropQueued(item.qid)
        } catch (e) {
          if (e instanceof AuthError || offlineError(e) || !e.status || e.status >= 500) break // on réessaiera
          out.failed.push(e.message)
          dropQueued(item.qid)
        }
      }
    } finally {
      flushing = null
    }
    return out
  })()
  return flushing
}

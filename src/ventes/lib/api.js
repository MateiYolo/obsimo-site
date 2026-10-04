// Appels à /api/ventes (une seule fonction, l'action dans ?a=…). Cookie de session httpOnly.

export class AuthError extends Error {}

export async function api(action, body) {
  const res = await fetch(`/api/ventes${action ? `?a=${action}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }))
  if (res.status === 401 && action !== 'login') throw new AuthError('Session expirée')
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
  return json
}

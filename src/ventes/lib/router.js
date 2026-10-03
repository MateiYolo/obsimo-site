// Navigation par le hash (#/ventes?canal=sumup) : liens partageables, bouton retour du navigateur.

import { useCallback, useSyncExternalStore } from 'react'

const parse = () => {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?')
  return { page: path || 'apercu', params: Object.fromEntries(new URLSearchParams(query)) }
}

let current = parse()
const listeners = new Set()
window.addEventListener('hashchange', () => {
  current = parse()
  listeners.forEach((l) => l())
})
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

export function href(page, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  return `#/${page}${q.size ? `?${q}` : ''}`
}

export function navigate(page, params, { replace } = {}) {
  const url = href(page, params)
  if (replace) {
    history.replaceState(null, '', url)
    current = parse()
    listeners.forEach((l) => l())
  } else {
    location.hash = url
    window.scrollTo(0, 0)
  }
}

export function useRoute() {
  const route = useSyncExternalStore(subscribe, () => current)
  // change quelques paramètres de la page courante sans ajouter d'entrée dans l'historique
  const setParams = useCallback((patch) => navigate(current.page, { ...current.params, ...patch }, { replace: true }), [])
  return { ...route, setParams }
}

// Les données du dashboard (un seul appel GET), et `run` : exécute une action, recharge, affiche le résultat.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, AuthError, flushQueue, readQueue } from '@/lib/api'

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | login
  const [loginError, setLoginError] = useState(null)
  const loadedAt = useRef(0)
  const [pending, setPending] = useState(() => readQueue())

  const reload = useCallback(async () => {
    try {
      setData(await api())
      loadedAt.current = Date.now()
      setStatus('ready')
    } catch (e) {
      // pas de réseau : on garde ce qui est affiché plutôt que de renvoyer vers la connexion
      if (e instanceof TypeError && loadedAt.current) return
      if (!(e instanceof AuthError)) setLoginError(e instanceof TypeError ? 'Pas de réseau' : e.message)
      setData(null)
      setStatus('login')
    }
  }, [])

  // ce qui a été saisi hors réseau part dès que ça capte
  const flush = useCallback(async () => {
    if (!readQueue().length || !navigator.onLine) return
    const out = await flushQueue()
    if (out.sent) {
      toast.success(out.sent > 1 ? `${out.sent} saisies hors réseau envoyées` : 'Saisie hors réseau envoyée')
      await reload()
    }
    for (const m of out.failed) toast.error(`Saisie hors réseau refusée : ${m}`)
  }, [reload])

  useEffect(() => {
    const sync = () => setPending(readQueue())
    const tick = setInterval(flush, 20000)
    window.addEventListener('ventes-queue', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('online', flush)
    flush()
    return () => {
      clearInterval(tick)
      window.removeEventListener('ventes-queue', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('online', flush)
    }
  }, [flush])

  useEffect(() => {
    reload()
  }, [reload])

  // de retour sur l'appli après plus de 30 s : on recharge (une vente SumUp a pu arriver entre-temps)
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      flush()
      if (loadedAt.current && Date.now() - loadedAt.current > 30000) reload()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [reload, flush])

  const run = useCallback(
    async (fn, done) => {
      try {
        const out = await fn()
        if (out?.queued) {
          // pas de réseau : gardé sur le téléphone, rien à recharger (une vente a son propre message, avec « Annuler »)
          if (done !== false) toast('Pas de réseau : c’est gardé sur le téléphone', { description: 'Ça part tout seul dès que ça capte.' })
          return out
        }
        await reload()
        if (done) toast.success(typeof done === 'function' ? done(out) : done)
        return out
      } catch (e) {
        if (e instanceof AuthError) {
          setStatus('login')
          setData(null)
        }
        toast.error(e.message)
        throw e
      }
    },
    [reload],
  )

  const login = useCallback(
    async (password) => {
      await api('login', { password })
      setLoginError(null)
      await reload()
    },
    [reload],
  )

  const logout = useCallback(async () => {
    await api('logout', {})
    setData(null)
    setStatus('login')
  }, [])

  const value = useMemo(() => ({ data, status, loginError, reload, run, login, logout, pending, flush }), [data, status, loginError, reload, run, login, logout, pending, flush])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
export const useData = () => useContext(Ctx).data

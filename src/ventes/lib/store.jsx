// Les données du dashboard (un seul appel GET), et `run` : exécute une action, recharge, affiche le résultat.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, AuthError } from '@/lib/api'

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | login
  const [loginError, setLoginError] = useState(null)
  const loadedAt = useRef(0)

  const reload = useCallback(async () => {
    try {
      setData(await api())
      loadedAt.current = Date.now()
      setStatus('ready')
    } catch (e) {
      if (!(e instanceof AuthError)) setLoginError(e.message)
      setData(null)
      setStatus('login')
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // de retour sur l'appli après plus de 30 s : on recharge (une vente SumUp a pu arriver entre-temps)
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && loadedAt.current && Date.now() - loadedAt.current > 30000 && reload()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [reload])

  const run = useCallback(
    async (fn, done) => {
      try {
        const out = await fn()
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

  const value = useMemo(() => ({ data, status, loginError, reload, run, login, logout }), [data, status, loginError, reload, run, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
export const useData = () => useContext(Ctx).data

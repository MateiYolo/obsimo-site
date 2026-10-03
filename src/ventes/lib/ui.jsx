// État d'interface partagé : période affichée, thème, fenêtres (vente, produit, stock…) ouvertes de n'importe où.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePref } from '@/lib/prefs'

const Ctx = createContext(null)

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ventes-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('ventes-theme', theme)
    } catch {}
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#121212' : '#f7f7f5')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

export function UIProvider({ children }) {
  const [period, setPeriod] = usePref('period', '12m')
  const [theme, setTheme] = useTheme()
  const [dialog, setDialog] = useState(null) // { name, props }
  const [commandOpen, setCommandOpen] = useState(false)
  const open = useCallback((name, props = {}) => setDialog({ name, props, key: Date.now() }), [])
  const close = useCallback(() => setDialog(null), [])
  const value = useMemo(
    () => ({ period, setPeriod, theme, setTheme, dialog, open, close, commandOpen, setCommandOpen }),
    [period, setPeriod, theme, setTheme, dialog, open, close, commandOpen],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useUI = () => useContext(Ctx)

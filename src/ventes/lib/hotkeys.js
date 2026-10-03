// Raccourcis clavier façon Linear : touche seule (N, /, ?) ou séquence « G puis lettre » pour changer de page.

import { useEffect, useRef } from 'react'

const typing = (e) => {
  const t = e.target
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}
const modalOpen = () => !!document.querySelector('[role=dialog][data-state=open], [role=alertdialog][data-state=open]')

export function useHotkeys(map, { allowInModal = false } = {}) {
  const ref = useRef(map)
  ref.current = map
  const seq = useRef({ key: null, at: 0 })
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || typing(e) || (!allowInModal && modalOpen())) return
      if ((e.metaKey || e.ctrlKey) && !ref.current[`mod+${e.key.toLowerCase()}`]) return
      const key = (e.metaKey || e.ctrlKey ? 'mod+' : '') + e.key.toLowerCase()
      const now = Date.now()
      const combo = seq.current.key && now - seq.current.at < 1200 ? `${seq.current.key} ${key}` : null
      const fn = (combo && ref.current[combo]) || ref.current[key]
      seq.current = { key, at: now }
      if (fn) {
        e.preventDefault()
        seq.current = { key: null, at: 0 }
        fn(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allowInModal])
}

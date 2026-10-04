// Préférences d'affichage gardées dans le navigateur (période, thème, graphique…).

import { useEffect, useState } from 'react'

export function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(`ventes-${key}`)
      return v == null ? initial : JSON.parse(v)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`ventes-${key}`, JSON.stringify(value))
    } catch {}
  }, [key, value])
  return [value, setValue]
}

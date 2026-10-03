// Formats d'affichage : montants en centimes → euros, dates de Paris.

import { TZ } from '@/calc.js'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const euro0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
export const num = new Intl.NumberFormat('fr-FR')

// arrondi à l'euro quand c'est rond ou quand on le demande (chiffres clés)
export const fmt = (c, round) => (c == null ? '—' : (round || c % 100 === 0 ? euro0 : euro).format(c / 100))
export const fmtAxis = (c) => (Math.abs(c) >= 100000 ? `${compact.format(c / 100)} €` : euro0.format(c / 100))
export const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v)} %`
export const plural = (n, one, many = `${one}s`) => `${num.format(n)} ${n > 1 ? many : one}`

export const toCents = (v) => {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.')
  return s === '' || Number.isNaN(Number(s)) ? null : Math.round(Number(s) * 100)
}
export const fromCents = (c) => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, '').replace('.', ','))

const opts = (o) => ({ timeZone: TZ, ...o })
export const time = (iso) => new Date(iso).toLocaleTimeString('fr-FR', opts({ hour: '2-digit', minute: '2-digit' }))
export const dateShort = (iso) => new Date(iso).toLocaleDateString('fr-FR', opts({ day: 'numeric', month: 'short' }))
export const dateMedium = (iso) => new Date(iso).toLocaleDateString('fr-FR', opts({ day: 'numeric', month: 'short', year: 'numeric' }))
export const dateTime = (iso) =>
  new Date(iso).toLocaleString('fr-FR', opts({ weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
// une journée AAAA-MM-JJ (déjà dans le fuseau de Paris)
export const dayLabel = (day, withYear = true) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) })

export const localInput = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const today = () => localInput().slice(0, 10)

// « il y a 3 j » pour les listes
const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
export function ago(iso) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u)
  return 'à l’instant'
}

// Accueil : les 30 derniers jours en un coup d'œil, pour le plaisir. Le total monte en compteur, les barres des jours
// poussent une à une, et Obsimo (blond, coupe au bol, t-shirt vert) et son frère Matei (brun, barbe de quinze jours,
// tout en noir) posent avec leurs valises. Trois états, comparés à la moyenne sur 30 jours des six derniers mois :
// valises vides et têtes d'enterrement, valises correctes et sourires, ou valises qui débordent et pluie de pièces.
// Animations coupées si le téléphone demande moins de mouvement.

import { useEffect, useMemo, useState } from 'react'
import { dayOf, metrics } from '@/calc.js'
import { useData } from '@/lib/store'
import { fmt, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(() => (reduced() ? target : 0))
  useEffect(() => {
    if (reduced()) return setV(target)
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3)))) // ralentit à l'arrivée
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

// vides : moins de la moitié de la moyenne ; débordent : 40 % au-dessus ou plus
const LOW = 0.5
const HIGH = 1.4

export function Last30() {
  const d = useData()
  const s = useMemo(() => {
    const now = Date.now()
    const ago = (n) => dayOf(new Date(now - n * 864e5).toISOString())
    const days = Array.from({ length: 30 }, (_, i) => ago(29 - i))
    const idx = new Map(days.map((k, i) => [k, i]))
    const bars = days.map(() => 0)
    // les 6 périodes de 30 jours d'avant, pour la moyenne (seulement celles après la toute première vente)
    const windows = Array.from({ length: 6 }, () => 0)
    const first = d.sales.reduce((a, x) => (x.occurred_at < a ? x.occurred_at : a), new Date(now).toISOString())
    const firstAgo = Math.floor((now - new Date(first).getTime()) / 864e5)
    let total = 0
    let items = 0
    for (const sale of d.sales) {
      const m = metrics(sale)
      const day = dayOf(sale.occurred_at)
      if (idx.has(day)) {
        bars[idx.get(day)] += m.revenue
        total += m.revenue
        items += m.items
        continue
      }
      const k = Math.floor((now - new Date(sale.occurred_at).getTime()) / 864e5 / 30) - 1
      if (k >= 0 && k < 6) windows[k] += m.revenue
    }
    const counted = windows.filter((_, k) => firstAgo >= (k + 2) * 30) // période entière après la première vente
    const avg = counted.length ? counted.reduce((a, v) => a + v, 0) / counted.length : null
    const level = total <= 0 || (avg && total < avg * LOW) ? 'empty' : avg && total >= avg * HIGH ? 'rich' : 'ok'
    return { bars, total, items, avg, level, max: Math.max(...bars, 1) }
  }, [d])
  const shown = useCountUp(s.total)
  const delta = s.avg ? Math.round(((s.total - s.avg) / s.avg) * 100) : null
  const line = {
    rich: 'Les valises débordent. Ils ne s’en remettent pas.',
    ok: 'Les valises se remplissent tranquille.',
    empty: s.total ? 'Valises un peu vides ce mois-ci.' : 'Valises vides. On attend la prochaine date.',
  }[s.level]

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6">
      <style>{CSS}</style>
      <p className="text-sm text-muted-foreground">30 derniers jours</p>
      <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{fmt(shown, true)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {plural(s.items, 'article')}
        {delta != null && (
          <span className={cn('ml-2 font-medium', delta >= 0 ? 'text-success' : 'text-muted-foreground')}>
            {delta >= 0 ? '+' : ''}
            {delta} % vs ta moyenne
          </span>
        )}
      </p>

      <Brothers level={s.level} />
      <p className="-mt-1 text-center text-xs text-muted-foreground">{line}</p>

      <div className="mt-5 flex h-12 items-end gap-[3px]" aria-hidden>
        {s.bars.map((v, i) => (
          <div
            key={i}
            className={cn('l30-bar flex-1 rounded-t-[3px]', v ? (s.level === 'rich' ? 'bg-success' : 'bg-foreground/70') : 'bg-muted')}
            style={{ height: v ? `${Math.max(8, (v / s.max) * 100)}%` : '3px', animationDelay: `${i * 22}ms` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>il y a 30 j</span>
        <span>{s.avg != null ? `moyenne ${fmt(Math.round(s.avg), true)} / 30 j` : 'aujourd’hui'}</span>
      </div>
    </section>
  )
}

/* ---------- Le dessin ---------- */

const SKIN = '#f2c9a6'
const SKIN_LINE = '#c98f6b'
const INK = '#2a1a12'

// Les deux frères et leurs valises. viewBox 300 × 150, le sol à y = 138.
function Brothers({ level }) {
  const rich = level === 'rich'
  return (
    <svg viewBox="0 0 300 150" className={cn('mx-auto mt-2 block w-full max-w-sm', `l30-${level}`)} role="img" aria-label={{ rich: 'Les deux frères sautent de joie, les valises débordent de billets', ok: 'Les deux frères sourient, valises à moitié pleines', empty: 'Les deux frères font la tête devant des valises vides' }[level]}>
      <ellipse cx="150" cy="140" rx="135" ry="5" className="fill-muted" />
      {rich && <Rain />}
      <g className="l30-a">
        <Person cx={62} level={level} me />
      </g>
      <g className="l30-m">
        <Person cx={238} level={level} />
      </g>
      <Suitcase x={rich ? 92 : 98} level={level} />
      <Suitcase x={rich ? 156 : 162} level={level} flip />
      {level === 'empty' && (
        <g className="l30-fly fill-muted-foreground">
          <circle cx="150" cy="80" r="1.6" />
          <path d="M148 78.5 q-2 -3 -4 -1 M152 78.5 q2 -3 4 -1" fill="none" stroke="currentColor" strokeWidth=".8" className="stroke-muted-foreground" />
        </g>
      )}
      {rich && (
        <g className="l30-sparkle fill-[#f4c542]">
          <path d="M40 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
          <path d="M262 24 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" />
          <path d="M150 14 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" />
        </g>
      )}
    </svg>
  )
}

// Un frère. `me` : blond, coupe au bol, t-shirt vert ; sinon brun, barbe de quinze jours, tout en noir.
function Person({ cx, level, me }) {
  const shirt = me ? '#3f9b4f' : '#1b1b1d'
  const shirtLine = me ? '#2c6f38' : '#6b6b73'
  const pants = me ? '#2f3a4a' : '#141416'
  const up = level === 'rich'
  return (
    <g>
      {/* jambes */}
      <rect x={cx - 11} y={110} width={9} height={28} rx={3} fill={pants} stroke={shirtLine} strokeWidth=".8" />
      <rect x={cx + 2} y={110} width={9} height={28} rx={3} fill={pants} stroke={shirtLine} strokeWidth=".8" />
      <ellipse cx={cx - 7} cy={138} rx={7} ry={3} fill={INK} />
      <ellipse cx={cx + 7} cy={138} rx={7} ry={3} fill={INK} />
      {/* bras */}
      <g stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none">
        {up ? (
          <>
            <path className="l30-armL" d={`M${cx - 15} 82 L${cx - 30} 52`} />
            <path className="l30-armR" d={`M${cx + 15} 82 L${cx + 30} 52`} />
          </>
        ) : (
          <>
            <path d={`M${cx - 15} 82 L${cx - 22} 110`} />
            <path className={level === 'ok' && me ? 'l30-wave' : ''} d={`M${cx + 15} 82 L${cx + 22} 110`} style={{ transformOrigin: `${cx + 15}px 82px` }} />
          </>
        )}
      </g>
      {up && (
        <g fill={SKIN}>
          <circle cx={cx - 30} cy={51} r={4} />
          <circle cx={cx + 30} cy={51} r={4} />
        </g>
      )}
      {/* t-shirt */}
      <path d={`M${cx - 17} 112 L${cx - 17} 84 Q${cx - 17} 74 ${cx - 7} 74 L${cx + 7} 74 Q${cx + 17} 74 ${cx + 17} 84 L${cx + 17} 112 Z`} fill={shirt} stroke={shirtLine} strokeWidth="1" />
      <path d={`M${cx - 6} 74 Q${cx} 80 ${cx + 6} 74`} fill="none" stroke={shirtLine} strokeWidth="1.2" />
      {/* tête */}
      <rect x={cx - 4} y={66} width={8} height={9} fill={SKIN} />
      <circle cx={cx} cy={54} r={17} fill={SKIN} stroke={SKIN_LINE} strokeWidth=".8" />
      <circle cx={cx - 17} cy={56} r={3} fill={SKIN} stroke={SKIN_LINE} strokeWidth=".8" />
      <circle cx={cx + 17} cy={56} r={3} fill={SKIN} stroke={SKIN_LINE} strokeWidth=".8" />
      {me ? (
        // coupe au bol blonde : un dôme, une frange bien droite
        <path d={`M${cx - 19.5} 58 L${cx - 19.5} 49 A19.5 18 0 0 1 ${cx + 19.5} 49 L${cx + 19.5} 58 L${cx + 15} 58 L${cx + 15} 49 L${cx - 15} 49 L${cx - 15} 58 Z`} fill="#f1d36a" stroke="#c9a53c" strokeWidth="1" />
      ) : (
        <>
          {/* brun, court */}
          <path d={`M${cx - 17.5} 52 Q${cx - 19} 34 ${cx} 34 Q${cx + 19} 34 ${cx + 17.5} 52 Q${cx + 14} 42 ${cx + 4} 43 Q${cx - 8} 41 ${cx - 17.5} 52 Z`} fill="#4a2e1c" stroke="#33200f" strokeWidth=".8" />
          {/* barbe de quinze jours */}
          <path d={`M${cx - 16.5} 55 Q${cx - 16} 74 ${cx} 74 Q${cx + 16} 74 ${cx + 16.5} 55 Q${cx + 12} 60 ${cx} 60 Q${cx - 12} 60 ${cx - 16.5} 55 Z`} fill="#5a3a22" opacity=".72" />
          <path d={`M${cx - 7} 61 Q${cx} 58 ${cx + 7} 61`} stroke="#5a3a22" strokeWidth="2.4" fill="none" opacity=".8" strokeLinecap="round" />
        </>
      )}
      <Face cx={cx} level={level} />
    </g>
  )
}

function Face({ cx, level }) {
  const brows = level === 'empty'
  return (
    <g>
      {level === 'rich' ? (
        // yeux plissés de bonheur
        <g stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d={`M${cx - 9} 54 q3 -4 6 0`} />
          <path d={`M${cx + 3} 54 q3 -4 6 0`} />
        </g>
      ) : (
        <g fill={INK} className="l30-blink" style={{ transformOrigin: `${cx}px 53px` }}>
          <ellipse cx={cx - 6} cy={53} rx={1.9} ry={2.4} />
          <ellipse cx={cx + 6} cy={53} rx={1.9} ry={2.4} />
        </g>
      )}
      {brows && (
        <g stroke={INK} strokeWidth="1.3" strokeLinecap="round">
          <path d={`M${cx - 9} 47 L${cx - 4} 49`} />
          <path d={`M${cx + 9} 47 L${cx + 4} 49`} />
        </g>
      )}
      {level === 'empty' && <path d={`M${cx - 5} 65 q5 -4 10 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {level === 'ok' && <path d={`M${cx - 6} 62 q6 5 12 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {level === 'rich' && (
        <>
          <path d={`M${cx - 8} 60 q8 12 16 0 z`} fill="#7a2b2b" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M${cx - 6.5} 60.5 h13 v2 h-13 z`} fill="#fff" />
          <circle cx={cx - 11} cy={60} r={2.6} fill="#ef8f8f" opacity=".6" />
          <circle cx={cx + 11} cy={60} r={2.6} fill="#ef8f8f" opacity=".6" />
        </>
      )}
      {level === 'empty' && <path className="l30-drop" d={`M${cx + 15} 44 q2 4 0 6 q-2 -2 0 -6 z`} fill="#8cc9ef" />}
    </g>
  )
}

const Bill = ({ x, y, r = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <rect x={-8} y={-4} width={16} height={8} rx={1} fill="#7cc47f" stroke="#3f7f43" strokeWidth=".8" />
    <circle r={2} fill="none" stroke="#3f7f43" strokeWidth=".7" />
  </g>
)

// Une valise ouverte : vide, avec quelques liasses, ou qui déborde (et plus grosse).
function Suitcase({ x, level, flip }) {
  const big = level === 'rich'
  const w = big ? 52 : 40
  const h = big ? 22 : 16
  const y = 138 - h
  const lidH = big ? 30 : 24
  return (
    <g className={big ? 'l30-bulge' : ''} style={{ transformOrigin: `${x + w / 2}px 138px` }}>
      {/* couvercle ouvert, en arrière */}
      <rect x={x + 2} y={y - lidH + 2} width={w - 4} height={lidH} rx={4} fill="#a8713d" stroke="#5e3a17" strokeWidth="1.2" />
      <rect x={x + 6} y={y - lidH + 6} width={w - 12} height={lidH - 8} rx={2} fill="#7a4c22" />
      {/* contenu */}
      {level === 'ok' && (
        <g>
          <Bill x={x + w / 2 - 8} y={y + 1} />
          <Bill x={x + w / 2 + 6} y={y - 1} r={-8} />
          <Bill x={x + w / 2 - 1} y={y - 4} r={4} />
        </g>
      )}
      {big && (
        <g className="l30-pile">
          <path d={`M${x + 2} ${y + 2} Q${x + w / 2} ${y - 34} ${x + w - 2} ${y + 2} Z`} fill="#7cc47f" stroke="#3f7f43" strokeWidth="1" />
          <Bill x={x + 10} y={y - 6} r={-25} />
          <Bill x={x + w - 10} y={y - 8} r={30} />
          <Bill x={x + w / 2} y={y - 20} r={flip ? 12 : -10} />
          <Bill x={x + w / 2 - 12} y={y - 14} r={8} />
          <Bill x={x + w / 2 + 12} y={y - 15} r={-14} />
          <Bill x={x - 4} y={y - 1} r={-50} />
          <Bill x={x + w + 4} y={y - 2} r={55} />
          <circle cx={x + w / 2 - 4} cy={y - 26} r={3.2} fill="#f4c542" stroke="#b8901f" strokeWidth=".8" />
          <circle cx={x + w / 2 + 8} cy={y - 24} r={3.2} fill="#f4c542" stroke="#b8901f" strokeWidth=".8" />
        </g>
      )}
      {/* corps */}
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#b97d44" stroke="#5e3a17" strokeWidth="1.4" />
      <rect x={x + w * 0.25 - 2} y={y} width={4} height={h} fill="#8a5a2b" />
      <rect x={x + w * 0.75 - 2} y={y} width={4} height={h} fill="#8a5a2b" />
      <rect x={x + w / 2 - 4} y={y + 3} width={8} height={5} rx={1} fill="#e2c26a" stroke="#8a6a1f" strokeWidth=".6" />
    </g>
  )
}

// Pièces et billets qui tombent du ciel
function Rain() {
  const items = [
    [30, 0, 'c'],
    [70, 0.6, 'b'],
    [115, 1.2, 'c'],
    [185, 0.3, 'c'],
    [225, 0.9, 'b'],
    [270, 1.5, 'c'],
    [150, 1.8, 'b'],
  ]
  return (
    <g>
      {items.map(([x, delay, k], i) => (
        <g key={i} className="l30-fall" style={{ animationDelay: `${delay}s` }}>
          {k === 'c' ? <circle cx={x} cy={0} r={3.5} fill="#f4c542" stroke="#b8901f" strokeWidth=".8" /> : <Bill x={x} y={0} r={20} />}
        </g>
      ))}
    </g>
  )
}

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .l30-bar { transform-origin: bottom; animation: l30-grow .6s cubic-bezier(.2,.9,.3,1.2) both; }
  .l30-rich .l30-a { animation: l30-jump .8s ease-in-out infinite; }
  .l30-rich .l30-m { animation: l30-jump .8s ease-in-out .4s infinite; }
  .l30-rich .l30-armL { animation: l30-armL .4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 100% 100%; }
  .l30-rich .l30-armR { animation: l30-armR .4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 0% 100%; }
  .l30-rich .l30-bulge { animation: l30-bulge 1.6s ease-in-out infinite; }
  .l30-fall { animation: l30-fall 2.4s linear infinite; }
  .l30-sparkle { animation: l30-twinkle 1.4s ease-in-out infinite; }
  .l30-ok .l30-a { animation: l30-bob 2.4s ease-in-out infinite; }
  .l30-ok .l30-m { animation: l30-bob 2.4s ease-in-out 1.2s infinite; }
  .l30-wave { animation: l30-wave 1.2s ease-in-out infinite; }
  .l30-blink { animation: l30-blink 4s infinite; }
  .l30-empty .l30-a, .l30-empty .l30-m { animation: l30-sigh 3.6s ease-in-out infinite; }
  .l30-drop { animation: l30-drop 2.2s ease-in infinite; }
  .l30-fly { animation: l30-fly 3s ease-in-out infinite; }
}
@keyframes l30-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes l30-jump { 0%,100% { transform: translateY(0); } 45% { transform: translateY(-10px); } }
@keyframes l30-armL { from { transform: rotate(-10deg); } to { transform: rotate(12deg); } }
@keyframes l30-armR { from { transform: rotate(10deg); } to { transform: rotate(-12deg); } }
@keyframes l30-bulge { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04, 1.07); } }
@keyframes l30-fall { 0% { transform: translateY(-10px) rotate(0); opacity: 0; } 10% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(140px) rotate(200deg); opacity: 0; } }
@keyframes l30-twinkle { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
@keyframes l30-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes l30-wave { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-120deg); } }
@keyframes l30-blink { 0%,94%,100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
@keyframes l30-sigh { 0%,100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
@keyframes l30-drop { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }
@keyframes l30-fly { 0%,100% { transform: translate(0,0); } 25% { transform: translate(10px,-8px); } 50% { transform: translate(-6px,-14px); } 75% { transform: translate(-12px,-4px); } }
`

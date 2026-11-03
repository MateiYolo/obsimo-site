// Accueil : les 30 derniers jours en un coup d'œil, pour le plaisir. Le total monte en compteur, les barres des jours
// poussent une à une, et un petit bonhomme réagit : la fête si on fait mieux que les 30 jours d'avant, content si ça
// vend, endormi si rien ne bouge. Animations coupées si le téléphone demande moins de mouvement.

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

export function Last30() {
  const d = useData()
  const s = useMemo(() => {
    const now = Date.now()
    const days = Array.from({ length: 30 }, (_, i) => dayOf(new Date(now - (29 - i) * 864e5).toISOString()))
    const idx = new Map(days.map((k, i) => [k, i]))
    const before = new Set(Array.from({ length: 30 }, (_, i) => dayOf(new Date(now - (59 - i) * 864e5).toISOString())))
    const bars = days.map(() => 0)
    let total = 0
    let items = 0
    let prev = 0
    for (const sale of d.sales) {
      const day = dayOf(sale.occurred_at)
      const m = metrics(sale)
      if (idx.has(day)) {
        bars[idx.get(day)] += m.revenue
        total += m.revenue
        items += m.items
      } else if (before.has(day)) prev += m.revenue
    }
    const mood = total <= 0 ? 'sleepy' : total >= prev ? 'party' : 'happy'
    return { bars, total, items, prev, mood, max: Math.max(...bars, 1) }
  }, [d])
  const shown = useCountUp(s.total)
  const delta = s.prev ? Math.round(((s.total - s.prev) / s.prev) * 100) : null
  const line = {
    party: s.prev ? 'Mieux que le mois d’avant. Il est ravi.' : 'Ça démarre fort.',
    happy: 'Ça tourne, tranquille.',
    sleepy: 'Rien ce mois-ci. Il fait la sieste.',
  }[s.mood]

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6">
      <style>{CSS}</style>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">30 derniers jours</p>
          <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{fmt(shown, true)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {plural(s.items, 'article')}
            {delta != null && (
              <span className={cn('ml-2 font-medium', delta >= 0 ? 'text-success' : 'text-muted-foreground')}>
                {delta >= 0 ? '+' : ''}
                {delta} %
              </span>
            )}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{line}</p>
        </div>
        <Buddy mood={s.mood} />
      </div>

      <div className="mt-5 flex h-14 items-end gap-[3px]" aria-hidden>
        {s.bars.map((v, i) => (
          <div
            key={i}
            className={cn('l30-bar flex-1 rounded-t-[3px]', v ? (s.mood === 'party' ? 'bg-success' : 'bg-foreground/70') : 'bg-muted')}
            style={{ height: v ? `${Math.max(8, (v / s.max) * 100)}%` : '3px', animationDelay: `${i * 22}ms` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>il y a 30 j</span>
        <span>aujourd’hui</span>
      </div>
    </section>
  )
}

// Le bonhomme : une tête ronde, deux bras. Dessiné en SVG avec les couleurs du thème (clair ou sombre).
function Buddy({ mood }) {
  return (
    <svg viewBox="0 0 100 110" className={cn('size-24 shrink-0 sm:size-28', `l30-${mood}`)} role="img" aria-label={{ party: 'Bonhomme ravi', happy: 'Bonhomme content', sleepy: 'Bonhomme endormi' }[mood]}>
      {mood === 'party' && (
        <g className="l30-confetti">
          <rect x="12" y="10" width="5" height="5" rx="1" fill="var(--chart-1)" />
          <rect x="84" y="16" width="5" height="5" rx="1" fill="var(--chart-2)" />
          <rect x="20" y="34" width="4" height="4" rx="1" fill="var(--chart-3)" />
          <rect x="78" y="40" width="4" height="4" rx="1" fill="var(--chart-4)" />
          <circle cx="50" cy="6" r="2.5" fill="var(--chart-5)" />
        </g>
      )}
      <g className="l30-body">
        {/* bras */}
        {mood === 'party' ? (
          <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" className="text-foreground">
            <path className="l30-arm-l" d="M30 72 L14 46" />
            <path className="l30-arm-r" d="M70 72 L86 46" />
          </g>
        ) : (
          <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" className="text-foreground">
            <path d="M30 76 L18 92" />
            <path className={mood === 'happy' ? 'l30-wave' : ''} d="M70 76 L82 92" />
          </g>
        )}
        {/* corps + tête */}
        <rect x="32" y="66" width="36" height="36" rx="14" className={mood === 'party' ? 'fill-success' : 'fill-foreground/80'} />
        <circle cx="50" cy="48" r="26" className="fill-foreground" />
        {/* visage */}
        <g className="fill-background stroke-background" strokeLinecap="round">
          {mood === 'sleepy' ? (
            <>
              <path d="M37 47 q4 4 8 0" fill="none" strokeWidth="3" />
              <path d="M55 47 q4 4 8 0" fill="none" strokeWidth="3" />
              <circle cx="50" cy="60" r="3" strokeWidth="0" />
            </>
          ) : (
            <>
              <g className="l30-blink">
                <ellipse cx="41" cy="45" rx="3.2" ry={mood === 'party' ? 4.2 : 3.4} strokeWidth="0" />
                <ellipse cx="59" cy="45" rx="3.2" ry={mood === 'party' ? 4.2 : 3.4} strokeWidth="0" />
              </g>
              {mood === 'party' ? <path d="M38 55 q12 14 24 0 z" strokeWidth="2" strokeLinejoin="round" /> : <path d="M40 56 q10 8 20 0" fill="none" strokeWidth="3" />}
            </>
          )}
        </g>
      </g>
      {mood === 'sleepy' && (
        <g className="l30-zzz fill-muted-foreground" fontSize="12" fontWeight="700" fontFamily="inherit">
          <text x="76" y="26">z</text>
          <text x="84" y="14" fontSize="9">z</text>
        </g>
      )}
    </svg>
  )
}

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .l30-bar { transform-origin: bottom; animation: l30-grow .6s cubic-bezier(.2,.9,.3,1.2) both; }
  .l30-party .l30-body { animation: l30-jump .9s ease-in-out infinite; transform-origin: 50px 100px; }
  .l30-party .l30-arm-l { animation: l30-armL .45s ease-in-out infinite alternate; transform-origin: 30px 72px; }
  .l30-party .l30-arm-r { animation: l30-armR .45s ease-in-out infinite alternate; transform-origin: 70px 72px; }
  .l30-party .l30-confetti { animation: l30-pop 1.8s ease-in-out infinite; transform-origin: 50px 40px; }
  .l30-happy .l30-body { animation: l30-sway 2.4s ease-in-out infinite; transform-origin: 50px 100px; }
  .l30-wave { animation: l30-wave 1.2s ease-in-out infinite; transform-origin: 70px 76px; }
  .l30-blink { animation: l30-blink 4s infinite; transform-origin: 50px 45px; }
  .l30-sleepy .l30-body { animation: l30-breathe 3.2s ease-in-out infinite; transform-origin: 50px 100px; }
  .l30-zzz { animation: l30-float 2.6s ease-in-out infinite; }
}
@keyframes l30-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes l30-jump { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-7px); } 60% { transform: translateY(-7px) rotate(2deg); } }
@keyframes l30-armL { from { transform: rotate(-8deg); } to { transform: rotate(10deg); } }
@keyframes l30-armR { from { transform: rotate(8deg); } to { transform: rotate(-10deg); } }
@keyframes l30-pop { 0%,100% { transform: scale(.9); opacity: .7; } 50% { transform: scale(1.08); opacity: 1; } }
@keyframes l30-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes l30-wave { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-50deg); } }
@keyframes l30-blink { 0%,94%,100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
@keyframes l30-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes l30-float { 0% { transform: translateY(4px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-8px); opacity: 0; } }
`

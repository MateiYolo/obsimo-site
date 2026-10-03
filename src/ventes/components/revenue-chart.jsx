// CA par mois, en colonnes empilées par canal (recharts via le composant chart de shadcn).

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { SERIES, SERIES_COLOR } from '@/calc.js'
import { fmt, fmtAxis } from '@/lib/format'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const monthLabel = (key, withYear) => {
  const [y, m] = key.split('-')
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1]
}

const config = Object.fromEntries(SERIES.map((s) => [s.key, { label: s.label, color: SERIES_COLOR[s.key] }]))

export function RevenueChart({ rows }) {
  const data = rows.map((r) => ({ month: r.month, ...r.values, total: r.total, items: r.items }))
  const multiYear = new Set(rows.map((r) => r.month.slice(0, 4))).size > 1
  const used = SERIES.filter((s) => rows.some((r) => r.values[s.key] > 0))
  const series = used.length ? used : SERIES.slice(0, 1)
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} strokeDasharray="0" className="stroke-border" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={8}
          tickFormatter={(m) => (multiYear && m.endsWith('-01') ? `${monthLabel(m)} ${m.slice(2, 4)}` : monthLabel(m))}
        />
        <YAxis tickLine={false} axisLine={false} width={56} tickMargin={6} tickFormatter={fmtAxis} />
        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<Tip />} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} stackId="a" fill={`var(--color-${s.key})`} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{monthLabel(r.month, true)}</div>
      <div className="grid gap-1">
        {SERIES.filter((s) => r[s.key] > 0).map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="size-2 rounded-[2px]" style={{ background: SERIES_COLOR[s.key] }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="num ml-auto font-medium">{fmt(r[s.key])}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between border-t pt-1.5 font-medium">
        <span>Total</span>
        <span className="num">{fmt(r.total)}</span>
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {r.items} article{r.items > 1 ? 's' : ''}
      </div>
    </div>
  )
}

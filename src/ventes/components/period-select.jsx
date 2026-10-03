// Choix de la période (12 derniers mois, une année, depuis le début), partagé entre les pages.

import { CalendarRange } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { periodOptions } from '@/lib/derived'

export function PeriodSelect() {
  const d = useData()
  const { period, setPeriod } = useUI()
  const options = periodOptions(d.sales)
  const label = options.find(([v]) => v === period)?.[1]
  const short = period === '12m' ? '12 mois' : period === 'all' ? 'Tout' : period
  return (
    <Select value={period} onValueChange={setPeriod}>
      <SelectTrigger size="sm" className="h-8 gap-1.5 text-[13px]" aria-label="Période">
        <CalendarRange className="text-muted-foreground max-sm:hidden" />
        <SelectValue>
          <span className="sm:hidden">{short}</span>
          <span className="max-sm:hidden">{label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

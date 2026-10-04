// Choix de la période, partagé entre les pages. Sur grand écran, les raccourcis (24 h, 7 j, ce mois…) sont à un clic
// (ou touches 1 à 6) et les années dans un menu ; sur petit écran, tout est dans un seul menu.

import { CalendarRange } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Keys } from '@/components/shortcut'
import { PRESETS } from '@/calc.js'
import { useData } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useHotkeys } from '@/lib/hotkeys'
import { periodOptions } from '@/lib/derived'

export function PeriodSelect() {
  const d = useData()
  const { period, setPeriod } = useUI()
  const options = periodOptions(d.sales)
  const current = options.find(([v]) => v === period)
  const years = options.filter(([v]) => /^\d{4}$/.test(v))
  useHotkeys(Object.fromEntries(PRESETS.map(([v], i) => [String(i + 1), () => setPeriod(v)])))

  return (
    <>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger size="sm" className="h-8 gap-1.5 text-[13px] pointer-coarse:h-10 lg:hidden" aria-label="Période">
          <CalendarRange className="text-muted-foreground max-sm:hidden" />
          <SelectValue>
            <span className="sm:hidden">{current?.[2] ?? period}</span>
            <span className="max-sm:hidden">{current?.[1] ?? period}</span>
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

      <div className="flex items-center gap-1 max-lg:hidden">
        {/* le Tooltip remplace data-state sur le bouton : l'état actif se lit sur aria-checked */}
        <ToggleGroup type="single" size="sm" variant="outline" value={period} onValueChange={(v) => v && setPeriod(v)} aria-label="Période">
          {PRESETS.map(([v, l, short], i) => (
            <Tooltip key={v}>
              <TooltipTrigger asChild>
                <ToggleGroupItem value={v} aria-label={l} className="px-2.5 text-[13px] font-normal text-muted-foreground aria-checked:bg-foreground/10 aria-checked:font-medium aria-checked:text-foreground">
                  {short}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-2">
                {l}
                <Keys keys={String(i + 1)} />
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Select value={years.some(([v]) => v === period) ? period : ''} onValueChange={setPeriod}>
          <SelectTrigger size="sm" className="h-8 gap-1.5 text-[13px] data-[placeholder]:text-muted-foreground" aria-label="Année">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent align="end">
            {years.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

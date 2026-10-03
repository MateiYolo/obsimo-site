// Canaux de vente : pastille de couleur (celle du graphique), icône et libellé court.

import { Globe, Ticket, Banknote, Disc3, Shapes } from 'lucide-react'
import { SERIES_COLOR, seriesOf } from '@/calc.js'
import { cn } from '@/lib/utils'

export const CHANNEL_META = {
  shopify: { label: 'Site', long: 'Site (Shopify)', icon: Globe },
  sumup: { label: 'SumUp', long: 'Concert · SumUp', icon: Ticket },
  cash: { label: 'Espèces', long: 'Concert · espèces', icon: Banknote },
  bandcamp: { label: 'Bandcamp', long: 'Bandcamp', icon: Disc3 },
  other: { label: 'Autre', long: 'Autre', icon: Shapes },
}

export function ChannelDot({ channel, series, className }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: SERIES_COLOR[series || seriesOf(channel)] }} />
}

export function ChannelIcon({ channel, className }) {
  const Icon = CHANNEL_META[channel]?.icon || Shapes
  return <Icon className={cn('size-3.5 shrink-0', className)} style={{ color: SERIES_COLOR[seriesOf(channel)] }} />
}

export function ChannelLabel({ channel, long, className }) {
  const m = CHANNEL_META[channel] || CHANNEL_META.other
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-muted-foreground', className)}>
      <ChannelIcon channel={channel} />
      {long ? m.long : m.label}
    </span>
  )
}

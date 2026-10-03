// Bouton avec infobulle qui rappelle son raccourci clavier.

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

export function Keys({ keys, className }) {
  if (!keys) return null
  return (
    <KbdGroup className={className}>
      {keys.split(' ').map((k) => (
        <Kbd key={k}>{k === 'mod' ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl') : k.toUpperCase()}</Kbd>
      ))}
    </KbdGroup>
  )
}

export function Hint({ label, keys, children, side = 'bottom' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2">
        {label}
        <Keys keys={keys} />
      </TooltipContent>
    </Tooltip>
  )
}

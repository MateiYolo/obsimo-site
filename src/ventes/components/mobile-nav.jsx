// Téléphone : barre d'onglets en bas, à portée du pouce, avec « Nouvelle vente » au centre.
// « Menu » ouvre la barre latérale (toutes les pages, réglages) ; sa pastille signale ce qui est à traiter.

import { Menu, Plus } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { PAGES } from '@/lib/nav'
import { href, useRoute } from '@/lib/router'
import { useUI } from '@/lib/ui'
import { useTodo } from '@/lib/derived'
import { cn } from '@/lib/utils'

// en déplacement on suit les ventes et les soirées ; le stock et le reste sont dans « Menu »
const TABS = ['apercu', 'ventes', null, 'concerts']

export function MobileNav() {
  const { page } = useRoute()
  const { open } = useUI()
  const { setOpenMobile } = useSidebar()
  const todo = useTodo()
  const main = TABS.includes(page)

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg supports-[backdrop-filter]:bg-background/75 md:hidden"
    >
      <div className="grid h-16 grid-cols-5 items-stretch">
        {TABS.map((key) =>
          key ? (
            <Tab key={key} as="a" href={href(key)} icon={PAGES[key].icon} label={key === 'apercu' ? 'Aperçu' : PAGES[key].label} active={page === key} />
          ) : (
            <div key="new" className="flex items-center justify-center">
              <button
                onClick={() => open('sale')}
                aria-label="Nouvelle vente"
                className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-black/30 transition-transform active:scale-95"
              >
                <Plus className="size-6" strokeWidth={2.25} />
              </button>
            </div>
          ),
        )}
        <Tab as="button" onClick={() => setOpenMobile(true)} icon={Menu} label="Menu" active={!main} dot={todo.count > 0} />
      </div>
    </nav>
  )
}

function Tab({ as: C, icon: Icon, label, active, dot, ...props }) {
  return (
    <C
      {...props}
      aria-current={active ? 'page' : undefined}
      className={cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:opacity-70', active ? 'text-foreground' : 'text-muted-foreground')}
    >
      <span className="relative">
        <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
        {dot && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-warning ring-2 ring-background" />}
      </span>
      {label}
    </C>
  )
}

// Coquille : connexion, barre latérale, page courante, palette ⌘K, fenêtres et raccourcis globaux.

import { useEffect } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { AppSidebar } from '@/components/app-sidebar'
import { CommandMenu } from '@/components/command-menu'
import { MobileNav } from '@/components/mobile-nav'
import { DialogHost } from '@/components/dialogs/host'
import { DataProvider, useStore } from '@/lib/store'
import { UIProvider, useUI } from '@/lib/ui'
import { navigate, useRoute } from '@/lib/router'
import { useHotkeys } from '@/lib/hotkeys'
import { PAGES } from '@/lib/nav'
import { Login } from '@/pages/login'
import { Overview } from '@/pages/overview'
import { Todo } from '@/pages/todo'
import { Sales } from '@/pages/sales'
import { Concerts } from '@/pages/concerts'
import { Expenses } from '@/pages/expenses'
import { Stock } from '@/pages/stock'
import { Products } from '@/pages/products'
import { Settings } from '@/pages/settings'

const VIEWS = { apercu: Overview, 'a-traiter': Todo, ventes: Sales, concerts: Concerts, depenses: Expenses, stock: Stock, produits: Products, reglages: Settings }

export function App() {
  return (
    <UIProvider>
      <DataProvider>
        <TooltipProvider delayDuration={300}>
          <Root />
        </TooltipProvider>
      </DataProvider>
    </UIProvider>
  )
}

function Root() {
  const { status } = useStore()
  const { theme } = useUI()
  const mobile = useIsMobile()
  return (
    <>
      {status === 'loading' && <Loading />}
      {status === 'login' && <Login />}
      {status === 'ready' && <Shell />}
      {/* téléphone : en haut, loin du pouce et des boutons des fenêtres */}
      <Toaster theme={theme} position={mobile ? 'top-center' : 'bottom-right'} mobileOffset={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }} />
    </>
  )
}

function Shell() {
  const { page, params, setParams } = useRoute()
  const { open, setCommandOpen } = useUI()
  const View = VIEWS[page] || Overview

  // raccourci « Nouvelle vente » de l'icône sur l'écran d'accueil (#/ventes?nouvelle=1)
  useEffect(() => {
    if (params.nouvelle) {
      setParams({ nouvelle: null })
      open('sale')
    }
  }, [params.nouvelle, setParams, open])

  useHotkeys({
    'mod+k': () => setCommandOpen((o) => !o),
    n: () => open('sale'),
    '?': () => open('shortcuts'),
    ...Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [`g ${p.key}`, () => navigate(k)])),
  })

  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' }}>
      <AppSidebar />
      {/* sur téléphone, de la place en bas pour la barre d'onglets */}
      <SidebarInset className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:border md:pb-0">
        <View />
      </SidebarInset>
      <MobileNav />
      <CommandMenu />
      <DialogHost />
    </SidebarProvider>
  )
}

function Loading() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-60 flex-col gap-3 p-4 md:flex">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="m-2 flex-1 space-y-4 rounded-xl border bg-background p-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}

// Barre latérale : marque, recherche (⌘K), « Nouvelle vente », pages avec compteurs, état des connexions et compte.

import { ChevronsUpDown, LogOut, Monitor, Moon, Plus, Search, Sun, RefreshCw } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Keys } from '@/components/shortcut'
import { NAV, PAGES } from '@/lib/nav'
import { href, useRoute } from '@/lib/router'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { useTodo } from '@/lib/derived'
import { syncSumup, sumupMessage } from '@/lib/actions'

export function AppSidebar() {
  const { page } = useRoute()
  const { data, logout, run } = useStore()
  const { open, setCommandOpen, theme, setTheme } = useUI()
  const { setOpenMobile, isMobile } = useSidebar()
  const todo = useTodo()
  const done = () => isMobile && setOpenMobile(false)
  const counts = { 'a-traiter': todo.count || null }

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="gap-3 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-9 px-2 data-[state=open]:bg-sidebar-accent">
              <div className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary font-brand text-[13px] font-bold text-sidebar-primary-foreground">O</div>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="font-brand text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">Obsimo</span>
                <span className="text-muted-foreground">Ventes</span>
              </span>
              <ChevronsUpDown className="ml-auto size-3.5 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Apparence</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="dark">
                <Moon /> Sombre
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">
                <Sun /> Clair
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor /> Comme l’appareil
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut /> Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex gap-1.5">
          <SidebarMenuButton
            onClick={() => (done(), open('sale'))}
            className="h-8 flex-1 justify-start border bg-sidebar-accent/40 text-sidebar-accent-foreground shadow-xs hover:bg-sidebar-accent"
          >
            <Plus />
            <span>Nouvelle vente</span>
            <Keys keys="n" className="ml-auto" />
          </SidebarMenuButton>
          <SidebarMenuButton onClick={() => (done(), setCommandOpen(true))} className="size-8 shrink-0 justify-center border shadow-xs" aria-label="Rechercher (⌘K)">
            <Search />
          </SidebarMenuButton>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group, i) => (
          <SidebarGroup key={i} className="py-1">
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((key) => {
                const p = PAGES[key]
                return (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton asChild isActive={page === key} className="h-8 text-[13px]">
                      <a href={href(key)} onClick={done}>
                        <p.icon />
                        <span>{p.label}</span>
                      </a>
                    </SidebarMenuButton>
                    {counts[key] && <SidebarMenuBadge className="num rounded-full bg-warning/15 px-1.5 text-warning peer-data-[active=true]/menu-button:text-warning">{counts[key]}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="pb-3">
        {data?.integrations && (
          <div className="mx-2 mb-1 space-y-1.5 text-xs text-muted-foreground">
            <Integration on={data.integrations.shopifyWebhook} label="Shopify" />
            <div className="flex items-center justify-between">
              <Integration on={data.integrations.sumup} label="SumUp" />
              {data.integrations.sumup && (
                <button
                  className="inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                  onClick={(e) => {
                    const b = e.currentTarget
                    b.disabled = true
                    run(() => syncSumup(), sumupMessage).finally(() => (b.disabled = false))
                  }}
                >
                  <RefreshCw className="size-3" /> Synchro
                </button>
              )}
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={page === 'reglages'} className="h-8 text-[13px]">
              <a href={href('reglages')} onClick={done}>
                <PAGES.reglages.icon />
                <span>Réglages</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function Integration({ on, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${on ? 'bg-success' : 'bg-muted-foreground/40'}`} />
      {label}
      <span className="opacity-70">{on ? 'connecté' : 'non branché'}</span>
    </span>
  )
}


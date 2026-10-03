// Gabarit d'une page : barre du haut collante (menu, titre, actions), barre de filtres facultative, contenu.

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export function Page({ title, icon: Icon, count, actions, toolbar, children, className }) {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:rounded-t-xl md:px-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground" />
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{title}</span>
          {count != null && <span className="num text-muted-foreground">{count}</span>}
        </h1>
        <div className="ml-auto flex items-center gap-1.5">{actions}</div>
      </header>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 md:px-4">{toolbar}</div>}
      <div className={cn('flex-1 p-3 md:p-6', className)}>{children}</div>
    </>
  )
}

// Section titrée dans une page (titre discret, action à droite)
export function Section({ title, description, action, children, className }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-medium">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ icon: Icon, title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-lg border bg-muted/50">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

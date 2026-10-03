// Aide des raccourcis clavier (touche ?).

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Keys } from '@/components/shortcut'
import { NAV, PAGES } from '@/lib/nav'

const GENERAL = [
  ['Rechercher, lancer une action', 'mod k'],
  ['Nouvelle vente', 'n'],
  ['Afficher ou masquer le menu', 'mod b'],
  ['Rechercher dans la liste', '/'],
  ['Ligne suivante / précédente', 'j k'],
  ['Ouvrir la ligne', '↵'],
  ['Enregistrer un formulaire', 'mod ↵'],
  ['Cette aide', '?'],
]

export function ShortcutsDialog({ onClose }) {
  const pages = [...NAV.flatMap((g) => g.items), 'reglages']
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>Pour aller vite sans la souris.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 text-sm">
          <List rows={GENERAL} />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Aller à (G puis…)</p>
            <List rows={pages.map((k) => [PAGES[k].label, `g ${PAGES[k].key}`])} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function List({ rows }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map(([label, keys]) => (
        <li key={label} className="flex items-center justify-between px-3 py-2">
          {label}
          <Keys keys={keys} />
        </li>
      ))}
    </ul>
  )
}

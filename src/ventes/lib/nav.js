// Les pages du dashboard, leur icône et leur raccourci (G puis la lettre).

import { LayoutGrid, Inbox, ReceiptText, Ticket, Boxes, Package, Wallet, Settings, ChartColumn } from 'lucide-react'

export const PAGES = {
  apercu: { label: 'Accueil', icon: LayoutGrid, key: 'o' },
  'a-traiter': { label: 'À traiter', icon: Inbox, key: 'i' },
  ventes: { label: 'Ventes', icon: ReceiptText, key: 'v' },
  chiffres: { label: 'Chiffres', icon: ChartColumn, key: 'f' },
  concerts: { label: 'Concerts', icon: Ticket, key: 'c' },
  depenses: { label: 'Sorties d’argent', icon: Wallet, key: 'd' },
  stock: { label: 'Stock', icon: Boxes, key: 's' },
  produits: { label: 'Produits', icon: Package, key: 'p' },
  reglages: { label: 'Réglages', icon: Settings, key: 'r' },
}

// L'essentiel en haut ; le reste sous « Plus ». « À traiter » n'apparaît que s'il y a quelque chose à traiter.
export const NAV = [
  { label: null, items: ['apercu', 'a-traiter', 'ventes', 'stock'] },
  { label: 'Plus', items: ['chiffres', 'concerts', 'depenses', 'produits'] },
]

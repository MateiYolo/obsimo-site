// Les pages du dashboard, leur icône et leur raccourci (G puis la lettre).

import { LayoutGrid, Inbox, ReceiptText, Ticket, Boxes, Package, Wallet, Settings } from 'lucide-react'

export const PAGES = {
  apercu: { label: 'Vue d’ensemble', icon: LayoutGrid, key: 'o' },
  'a-traiter': { label: 'À traiter', icon: Inbox, key: 'i' },
  ventes: { label: 'Ventes', icon: ReceiptText, key: 'v' },
  concerts: { label: 'Concerts', icon: Ticket, key: 'c' },
  depenses: { label: 'Dépenses', icon: Wallet, key: 'd' },
  stock: { label: 'Stock', icon: Boxes, key: 's' },
  produits: { label: 'Produits', icon: Package, key: 'p' },
  reglages: { label: 'Réglages', icon: Settings, key: 'r' },
}

export const NAV = [
  { label: null, items: ['apercu', 'a-traiter'] },
  { label: 'Activité', items: ['ventes', 'concerts', 'depenses'] },
  { label: 'Catalogue', items: ['stock', 'produits'] },
]

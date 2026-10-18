// Les pages du dashboard, leur icône et leur raccourci (G puis la lettre).

import { House, ChartColumn, Inbox, ReceiptText, Ticket, Boxes, Package, Wallet, Settings } from 'lucide-react'

export const PAGES = {
  accueil: { label: 'Accueil', icon: House, key: 'h' },
  apercu: { label: 'Chiffres', icon: ChartColumn, key: 'o' },
  'a-traiter': { label: 'À traiter', icon: Inbox, key: 'i' },
  ventes: { label: 'Ventes', icon: ReceiptText, key: 'v' },
  concerts: { label: 'Concerts', icon: Ticket, key: 'c' },
  depenses: { label: 'Sorties d’argent', icon: Wallet, key: 'd' },
  stock: { label: 'Stock', icon: Boxes, key: 's' },
  produits: { label: 'Produits', icon: Package, key: 'p' },
  reglages: { label: 'Réglages', icon: Settings, key: 'r' },
}

// L'essentiel en haut ; le reste (chiffres détaillés, saisies moins fréquentes) regroupé sous « Plus ».
export const NAV = [
  { label: null, items: ['accueil', 'ventes', 'stock'] },
  { label: 'Plus', items: ['concerts', 'apercu', 'depenses', 'produits', 'a-traiter'] },
]

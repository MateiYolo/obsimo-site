// Actions partagées entre la barre latérale, la palette ⌘K et les pages.

import { api } from '@/lib/api'
import { toCsv } from '@/calc.js'

const s = (n, one, many) => `${n} ${n > 1 ? many : one}`

export const syncSumup = (since) => api('sync-sumup', since ? { since } : {})
export const sumupMessage = (o) => `SumUp : ${s(o.created, 'nouvelle vente', 'nouvelles ventes')}${o.updated ? `, ${s(o.updated, 'mise à jour', 'mises à jour')}` : ''}`

export const syncShopify = (since) => api('sync-shopify', { since })
export const shopifyMessage = (o) => `Shopify : ${s(o.created, 'commande importée', 'commandes importées')}, ${s(o.updated, 'mise à jour', 'mises à jour')}`

export const pushStock = () => api('push-stock', {})
export const pushMessage = (o) => (o.products.length ? `Stock envoyé à Shopify (${o.location}) : ${o.products.join(', ')}` : 'Aucun produit Shopify à mettre à jour')

export function downloadCsv(name, sales, products) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + toCsv(sales, products)], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

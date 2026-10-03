// Affiche la fenêtre demandée par useUI().open(name, props).

import { useUI } from '@/lib/ui'
import { SaleDialog } from './sale-dialog'
import { MoveDialog } from './move-dialog'
import { ExpenseDialog } from './expense-dialog'
import { ProductSheet } from './product-sheet'
import { EditSaleDialog, RefundDialog } from './sale-edit-dialogs'
import { ShortcutsDialog } from './shortcuts-dialog'

const DIALOGS = { sale: SaleDialog, move: MoveDialog, expense: ExpenseDialog, product: ProductSheet, 'edit-sale': EditSaleDialog, refund: RefundDialog, shortcuts: ShortcutsDialog }

export function DialogHost() {
  const { dialog, close } = useUI()
  if (!dialog) return null
  const C = DIALOGS[dialog.name]
  return <C key={dialog.key} {...dialog.props} onClose={close} />
}

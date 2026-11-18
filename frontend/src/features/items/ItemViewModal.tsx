import type { Item } from '@/api/types'
import { Modal } from '@/components/Modal'
import { ITEM_VIEW_TITLE_ID, ItemViewContent } from './ItemViewContent'

/** What to show. The list passes its row as `summary`; other callers pass only what they know. */
export interface ItemViewTarget {
  id: string
  summary?: Item
  title?: string | null
  source_url?: string | null
}

interface ItemViewModalProps {
  /** The item to show; undefined keeps the dialog closed. Only one is ever open. */
  target: ItemViewTarget | undefined
  onClose: () => void
}

/** Shows one saved item's text and data. Choosing another item replaces the content. */
export function ItemViewModal({ target, onClose }: ItemViewModalProps) {
  return (
    <Modal
      open={target !== undefined}
      onClose={onClose}
      labelledBy={ITEM_VIEW_TITLE_ID}
      className="h-[calc(100dvh-1.5rem)] sm:h-fit"
    >
      {target && <ItemViewContent key={target.id} target={target} onClose={onClose} />}
    </Modal>
  )
}

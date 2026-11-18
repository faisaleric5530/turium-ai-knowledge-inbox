import type { Item } from '@/api/types'

/** Best human label for an item: its title, else its URL, else the start of its text. */
export function displayTitle(item: Pick<Item, 'title' | 'source_url' | 'preview'>): string {
  if (item.title) return item.title
  if (item.source_url) return item.source_url
  return item.preview.slice(0, 60) || 'Untitled note'
}

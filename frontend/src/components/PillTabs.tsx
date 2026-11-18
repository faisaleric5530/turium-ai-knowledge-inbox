import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { pillClass } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

export interface PillTab<T extends string> {
  id: T
  label: string
  icon?: LucideIcon
  /** Optional trailing content (e.g. a count); receives whether this tab is selected. */
  badge?: (selected: boolean) => ReactNode
}

interface PillTabsProps<T extends string> {
  tabs: readonly PillTab<T>[]
  active: T
  onSelect: (id: T) => void
  ariaLabel: string
  /** Tab element ids are `${idPrefix}-${id}`. */
  idPrefix: string
  /** Each tab's aria-controls points at `${panelIdPrefix}-${id}`. */
  panelIdPrefix: string
  /**
   * 'manual': arrow keys only move focus, Enter/Space selects.
   * 'auto': focus and selection move together (handy for tiny tab sets).
   */
  activation?: 'manual' | 'auto'
  className?: string
  tabClassName?: string
}

/**
 * Pill-style WAI-ARIA tablist: roving tabindex, Arrow keys wrap, Home/End jump.
 * Shared by the page tabs and the item view dialog so the keyboard logic lives once.
 */
export function PillTabs<T extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  idPrefix,
  panelIdPrefix,
  activation = 'manual',
  className,
  tabClassName,
}: PillTabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>())

  function handleKeyDown(event: KeyboardEvent, current: T) {
    const index = tabs.findIndex((tab) => tab.id === current)
    let next: T | undefined
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length].id
    else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length].id
    else if (event.key === 'Home') next = tabs[0].id
    else if (event.key === 'End') next = tabs[tabs.length - 1].id
    if (next === undefined) return
    event.preventDefault()
    refs.current.get(next)?.focus()
    if (activation === 'auto') onSelect(next)
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={className}>
      {tabs.map(({ id, label, icon: Icon, badge }) => {
        const selected = id === active
        return (
          <button
            key={id}
            ref={(element) => {
              if (element) refs.current.set(id, element)
              else refs.current.delete(id)
            }}
            id={`${idPrefix}-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${panelIdPrefix}-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => handleKeyDown(event, id)}
            className={cn(pillClass(selected), tabClassName)}
          >
            {Icon && <Icon className="size-4" strokeWidth={1.85} aria-hidden />}
            {label}
            {badge?.(selected)}
          </button>
        )
      })}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Bookmark, MessageSquareText, Plus } from 'lucide-react'
import { PillTabs } from '@/components/PillTabs'
import type { PillTab } from '@/components/PillTabs'
import { TAB_IDS } from './useHashTab'
import type { TabId } from './useHashTab'

interface TabBarProps {
  active: TabId
  onSelect: (tab: TabId) => void
}

/** Primary page tabs. Arrow keys / Home / End move focus; Enter or Space activates. */
export function TabBar({ active, onSelect }: TabBarProps) {
  const tabs: PillTab<TabId>[] = TAB_IDS.map((id) => {
    if (id === 'add') return { id, label: 'Add', icon: Plus }
    if (id === 'ask') return { id, label: 'Ask', icon: MessageSquareText }
    return { id, label: 'Saved', icon: Bookmark }
  })

  return (
    <PillTabs
      tabs={tabs}
      active={active}
      onSelect={onSelect}
      ariaLabel="Sections"
      idPrefix="tab"
      panelIdPrefix="panel"
      className="grid grid-cols-3 gap-1.5 sm:flex"
      tabClassName="px-2 sm:min-w-28 sm:px-4"
    />
  )
}

interface TabPanelProps {
  id: TabId
  active: boolean
  children: ReactNode
}

/** Panels stay mounted and are hidden, so drafts, answers and state survive tab switches. */
export function TabPanel({ id, active, children }: TabPanelProps) {
  return (
    <div
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      className="space-y-6"
    >
      {children}
    </div>
  )
}

/**
 * Focus target when a tab is chosen. Visually hidden, because the active tab already
 * names the panel on screen; screen readers and keyboard focus still land here.
 */
export function PanelHeading({ id, title }: { id: TabId; title: string }) {
  return (
    <h2 id={`heading-${id}`} tabIndex={-1} className="sr-only">
      {title}
    </h2>
  )
}

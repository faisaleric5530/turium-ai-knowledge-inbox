import { useEffect, useLayoutEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { AskPanel } from '@/features/ask/AskPanel'
import { IngestForm } from '@/features/ingest/IngestForm'
import { ItemList } from '@/features/items/ItemList'
import { PanelHeading, TabBar, TabPanel } from '@/features/layout/AppTabs'
import { Header } from '@/features/layout/Header'
import { useHashTab } from '@/features/layout/useHashTab'
import type { TabId } from '@/features/layout/useHashTab'

function App() {
  const [tab, selectTab] = useHashTab()

  // One document scroll serves both tabs, so remember each tab's position and restore it.
  const scrollByTab = useRef<Record<TabId, number>>({ add: 0, saved: 0, ask: 0 })
  const shownTab = useRef<TabId>(tab)
  const firstRender = useRef(true)

  useEffect(() => {
    const remember = () => {
      scrollByTab.current[shownTab.current] = window.scrollY
    }
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [])

  // Capture the position at the moment of selection, before the panels swap.
  function handleSelect(next: TabId) {
    scrollByTab.current[shownTab.current] = window.scrollY
    selectTab(next)
  }

  // On a tab change (click, link, or browser back/forward): restore scroll, then move
  // focus to the new panel's heading so keyboard and screen-reader users land there.
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      shownTab.current = tab
      return
    }
    if (shownTab.current === tab) return
    shownTab.current = tab
    window.scrollTo(0, scrollByTab.current[tab])
    document.getElementById(`heading-${tab}`)?.focus({ preventScroll: true })
  }, [tab])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={(event) => {
          // Focus directly: a real "#main" jump would overwrite the tab in the URL hash.
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <Header />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[44rem] flex-1 px-4 py-6 outline-none sm:px-0 sm:py-10"
      >
        <Card>
          <div className="border-b border-border-subtle p-4 sm:px-6 sm:py-5">
            <TabBar active={tab} onSelect={handleSelect} />
          </div>

          <div className="p-4 sm:p-6">
            <TabPanel id="add" active={tab === 'add'}>
              <PanelHeading id="add" title="Add" />
              <IngestForm onViewSaved={() => handleSelect('saved')} />
            </TabPanel>

            <TabPanel id="saved" active={tab === 'saved'}>
              <PanelHeading id="saved" title="Saved" />
              <ItemList active={tab === 'saved'} onGoToAdd={() => handleSelect('add')} />
            </TabPanel>

            <TabPanel id="ask" active={tab === 'ask'}>
              <PanelHeading id="ask" title="Ask" />
              <AskPanel
                onGoToAdd={() => handleSelect('add')}
                onGoToSaved={() => handleSelect('saved')}
              />
            </TabPanel>
          </div>
        </Card>
      </main>
    </div>
  )
}

export default App

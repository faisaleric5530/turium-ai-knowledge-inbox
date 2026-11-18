import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type TabId = 'add' | 'saved' | 'ask'

export const TAB_IDS: readonly TabId[] = ['add', 'saved', 'ask']

// Unknown hashes (e.g. "#main") keep the last known tab instead of resetting it.
let lastTab: TabId = 'add'

function readTab(): TabId {
  const hash = window.location.hash
  if (hash === '#/ask') lastTab = 'ask'
  else if (hash === '#/saved') lastTab = 'saved'
  else if (hash === '#/add' || hash === '#/inbox') lastTab = 'add' // #/inbox is the old name
  return lastTab
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Rewrites the retired "#/inbox" link to "#/add" without adding a history entry. */
function redirectLegacyHash() {
  if (window.location.hash === '#/inbox') {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/add`)
  }
}

/** Active tab mirrored in the URL hash (#/add, #/saved, #/ask) so back/forward and links work. */
export function useHashTab(): [TabId, (tab: TabId) => void] {
  const tab = useSyncExternalStore(subscribe, readTab, () => 'add' as TabId)

  useEffect(() => {
    redirectLegacyHash()
    window.addEventListener('hashchange', redirectLegacyHash)
    return () => window.removeEventListener('hashchange', redirectLegacyHash)
  }, [])

  const select = useCallback((next: TabId) => {
    if (next !== readTab()) window.location.hash = `#/${next}`
  }, [])
  return [tab, select]
}

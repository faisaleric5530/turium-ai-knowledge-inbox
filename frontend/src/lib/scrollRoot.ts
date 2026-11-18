/**
 * The card has a standard height and its body scrolls inside it. These helpers find that
 * scroll area (falling back to the page if CSS ever makes it non-scrolling).
 */
export const SCROLL_ROOT_ATTR = 'data-scroll-root'

/** The card body, if it is currently a scroll container (desktop); otherwise null. */
export function innerScrollRoot(from?: Element | null): HTMLElement | null {
  const root = from
    ? from.closest<HTMLElement>(`[${SCROLL_ROOT_ATTR}]`)
    : document.querySelector<HTMLElement>(`[${SCROLL_ROOT_ATTR}]`)
  return root && getComputedStyle(root).overflowY !== 'visible' ? root : null
}

export function readScroll(): number {
  return innerScrollRoot()?.scrollTop ?? window.scrollY
}

export function writeScroll(top: number): void {
  const root = innerScrollRoot()
  if (root) root.scrollTop = top
  else window.scrollTo(0, top)
}

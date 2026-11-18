import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab / Shift+Tab cycling inside the dialog instead of leaving to the browser UI. */
function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const dialog = event.currentTarget
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0,
  )
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Id of the element inside `children` that names the dialog. */
  labelledBy: string
  children: ReactNode
  className?: string
}

/**
 * Accessible modal on the native <dialog> element. showModal() gives a focus trap,
 * Esc handling and an inert background for free. Esc, the backdrop and the caller's
 * own buttons all go through `onClose`, so the `open` prop stays the single source of
 * truth. Focus returns to whatever opened it, and page scroll is locked while open.
 */
export function Modal({ open, onClose, labelledBy, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const pressedOnBackdrop = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    const { overflow, paddingRight } = document.body.style
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px` // no layout jump
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      if (dialog.open) dialog.close()
      const target = opener.current
      opener.current = null
      if (target?.isConnected) target.focus({ preventScroll: true })
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      data-modal
      className={cn(
        'modal-dialog m-auto w-[calc(100vw-1.5rem)] max-w-none overflow-hidden rounded-[18px] border-[1.5px] border-border bg-card p-0 text-foreground shadow-lg',
        'max-h-[calc(100dvh-1.5rem)] sm:w-[min(92vw,44rem)] sm:max-h-[90dvh]',
        'backdrop:bg-foreground/50 backdrop:backdrop-blur-[3px]',
        className,
      )}
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault() // keep React state in charge instead of closing natively
        onClose()
      }}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        // A click that starts and ends on the backdrop (the dialog element itself) closes it;
        // a text selection that merely ends there does not.
        if (event.target === event.currentTarget && pressedOnBackdrop.current) onClose()
      }}
    >
      {open && <div className="flex max-h-[inherit] flex-col max-sm:h-full">{children}</div>}
    </dialog>
  )
}

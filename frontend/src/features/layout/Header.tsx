function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M9 10h14v3.4h-5.3V23h-3.4v-9.6H9z" fill="var(--primary-foreground)" />
    </svg>
  )
}

/** Sticky 60px bar: translucent, blurred, with a bottom border. Brand mark and app title. */
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-[20px]">
      <div className="mx-auto flex h-[60px] w-full max-w-[44rem] items-center gap-2.5 px-4 sm:px-0">
        <BrandMark />
        <h1 className="min-w-0 truncate font-heading text-base font-bold tracking-[-0.01em]">
          Turium AI Knowledge Inbox
        </h1>
      </div>
    </header>
  )
}

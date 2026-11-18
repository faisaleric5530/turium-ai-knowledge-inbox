/**
 * Loading placeholder shaped like the finished result (answer, then sources), so the page
 * does not jump when the answer arrives and there is room to scroll it into view.
 */
export function AnswerSkeleton() {
  return (
    <div aria-busy className="space-y-5">
      <div aria-hidden className="space-y-5">
        <div className="space-y-2.5">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-11/12" />
          <div className="skeleton h-3.5 w-4/5" />
          <div className="skeleton h-3.5 w-2/3" />
        </div>
        <div className="space-y-2.5">
          <div className="skeleton h-4 w-20" />
          <div className="sm:grid sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-4">
            <div className="mb-2 flex gap-2 sm:mb-0 sm:flex-col sm:gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-11 w-48 shrink-0 rounded-[10px] sm:w-full" />
              ))}
            </div>
            <div className="skeleton h-40 rounded-xl sm:h-[14.5rem]" />
          </div>
        </div>
      </div>
      <span className="sr-only">Finding an answer…</span>
    </div>
  )
}

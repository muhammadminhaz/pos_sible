"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * A horizontally scrollable region that fades out its right edge while more content
 * is hidden there, so people can tell the table continues.
 */
function ScrollFade({ className, onScroll, ...props }: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [more, setMore] = React.useState(false)

  const update = React.useCallback(() => {
    const el = ref.current
    if (el) setMore(Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 1)
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    // Observing fires once on attach, which also sets the initial state.
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [update])

  return (
    <div
      ref={ref}
      data-slot="scroll-fade"
      data-more={more}
      className={cn("edge-fade-x", className)}
      onScroll={(e) => {
        update()
        onScroll?.(e)
      }}
      {...props}
    />
  )
}

export { ScrollFade }

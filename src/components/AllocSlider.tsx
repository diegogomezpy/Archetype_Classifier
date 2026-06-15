import { useEffect, useRef } from 'react'

type Props = {
  allocX: number // 0-100 (share into X)
  onChange: (allocX: number) => void
}

export default function AllocSlider({ allocX, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  // Keep the latest onChange in a ref so the document listeners (bound once) never go stale.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Left end = X, right end = Y. Dragging toward a side funds that side.
  // Position from the left maps to Y's share; X is the remainder.
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    let pos = ((clientX - rect.left) / rect.width) * 100
    pos = Math.max(0, Math.min(100, pos))
    onChangeRef.current(Math.round(100 - pos)) // left => more X
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      setFromClientX(e.clientX)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current || !e.touches[0]) return
      e.preventDefault()
      setFromClientX(e.touches[0].clientX)
    }
    const stop = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.classList.remove('no-select')
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stop)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', stop)
    document.addEventListener('touchcancel', stop)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stop)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', stop)
      document.removeEventListener('touchcancel', stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startMouse = (e: React.MouseEvent) => {
    draggingRef.current = true
    document.body.classList.add('no-select')
    setFromClientX(e.clientX)
  }
  const startTouch = (e: React.TouchEvent) => {
    if (!e.touches[0]) return
    draggingRef.current = true
    document.body.classList.add('no-select')
    setFromClientX(e.touches[0].clientX)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(100, allocX + step)) // toward X
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(0, allocX - step)) // toward Y
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(100)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(0)
    }
  }

  // Thumb sits at the cursor: distance from left = Y's share = 100 - allocX.
  const thumbLeft = 100 - allocX

  return (
    <div className="select-none">
      {/* End labels */}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-teal">
          <span aria-hidden>◀</span> More into X
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-amber">
          More into Y <span aria-hidden>▶</span>
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={startMouse}
        onTouchStart={startTouch}
        onKeyDown={handleKey}
        role="slider"
        aria-label="Allocation between Investment X and Investment Y"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={allocX}
        aria-valuetext={`${allocX}% into X, ${100 - allocX}% into Y`}
        tabIndex={0}
        className="relative flex h-11 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {/* Soft gradient rail: teal (X) on the left, amber (Y) on the right */}
        <div
          className="h-3 w-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,160,136,0.30) 0%, rgba(10,160,136,0.12) 30%, #EDEBE5 50%, rgba(181,131,44,0.14) 70%, rgba(181,131,44,0.34) 100%)',
          }}
        />

        {/* Center reference tick */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border" />

        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white shadow-thumb"
          style={{ left: `${thumbLeft}%` }}
        >
          <span className="h-1 w-3 rounded-full bg-border" />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag toward the investment you want more of · splitting $10,000
      </p>
    </div>
  )
}

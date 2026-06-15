import { useEffect, useRef } from 'react'
import type { Outcome } from '../lib/payoff'

interface PayoffBarProps {
  outcomes: Outcome[] // joint distribution, sorted by delta ascending
  globalMin: number // most negative delta across all rounds (for color scaling)
  globalMax: number // most positive delta across all rounds (for color scaling)
}

const BAR_H = 56
const ZERO_LABEL_H = 22 // room below the bar for the $0 marker
const MIN_LABEL_PX = 40 // hide labels on tiles/clusters narrower than this
const MIN_LABEL_GAP_PX = 66 // min center-to-center spacing between shown labels
const CLUSTER_EPS = 25 // $ — combine adjacent tiles at ~the same value for labelling
// (distinct blended outcomes in every round differ by far more than this, so
// only visually-identical tiles — e.g. duplicates at the all-X/all-Y extremes —
// merge, and they report their true combined probability)
const SMOOTH = 0.22 // per-frame approach rate toward the target distribution

// Magnitude color ramps: pale/desaturated (small) → vivid/saturated (large).
// Stays bright at the high end (no dark/near-black tones).
const POS_LIGHT = [178, 224, 202]
const POS_VIVID = [0, 166, 80]
const NEG_LIGHT = [247, 201, 201]
const NEG_VIVID = [226, 48, 48]
const NEUTRAL = [206, 203, 195] // breakeven ($0)

type RGB = [number, number, number]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

function rampRGB(delta: number, gMin: number, gMax: number): RGB {
  if (delta === 0) return NEUTRAL as RGB
  if (delta > 0) {
    // Gains span a huge range (the lottery jackpot stretches gMax to ~$19.5k),
    // so a linear map leaves ordinary gains nearly pale. Ramp the saturation up
    // fast with a sub-linear curve — modest gains read clearly green while the
    // jackpot still tops out at full vivid.
    const t = gMax > 0 ? Math.pow(clamp01(delta / gMax), 0.32) : 0
    return [
      Math.round(lerp(POS_LIGHT[0], POS_VIVID[0], t)),
      Math.round(lerp(POS_LIGHT[1], POS_VIVID[1], t)),
      Math.round(lerp(POS_LIGHT[2], POS_VIVID[2], t)),
    ]
  }
  const t = gMin < 0 ? clamp01(Math.abs(delta) / Math.abs(gMin)) : 0
  return [
    Math.round(lerp(NEG_LIGHT[0], NEG_VIVID[0], t)),
    Math.round(lerp(NEG_LIGHT[1], NEG_VIVID[1], t)),
    Math.round(lerp(NEG_LIGHT[2], NEG_VIVID[2], t)),
  ]
}

const rgbStr = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`
const luminance = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

function fmtDelta(delta: number): string {
  if (delta === 0) return '$0'
  const sign = delta > 0 ? '+' : '−'
  return sign + '$' + Math.abs(delta).toLocaleString('en-US')
}

export default function PayoffBar({ outcomes, globalMin, globalMax }: PayoffBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  const zeroRef = useRef<HTMLDivElement>(null)

  // Animation state in refs so the frame loop is bound once and never stale.
  const curRef = useRef<Outcome[]>(outcomes) // currently displayed (smoothed) state
  const toRef = useRef<Outcome[]>(outcomes) // target state
  const rafRef = useRef<number | null>(null)

  // Draw an explicit outcomes array as a full-width stacked distribution.
  const draw = (state: Outcome[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.offsetWidth
    if (w === 0) return

    const dpr = window.devicePixelRatio || 1
    const pw = Math.round(w * dpr)
    const ph = Math.round(BAR_H * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, BAR_H)

    const n = state.length
    const total = state.reduce((s, o) => s + o.p, 0) || 1

    // Lay tiles edge-to-edge, left→right, ordered worst→best (state is sorted
    // ascending). Width = probability share, so the tiles fill the whole bar.
    const xs: number[] = []
    const ws: number[] = []
    let cum = 0
    for (let i = 0; i < n; i++) {
      const segW = (state[i].p / total) * w
      xs[i] = cum
      ws[i] = segW
      cum += segW
    }

    // Tiles (+0.5px overdraw hides sub-pixel seams between same-color tiles).
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rgbStr(rampRGB(state[i].delta, globalMin, globalMax))
      ctx.fillRect(xs[i], 0, ws[i] + 0.5, BAR_H)
    }

    // Subtle separators between adjacent tiles for definition — but not between
    // tiles at the same value (a clustered block reads as one seamless segment).
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    for (let i = 1; i < n; i++) {
      if (Math.abs(state[i].delta - state[i - 1].delta) <= CLUSTER_EPS) continue
      ctx.fillRect(xs[i] - 0.5, 0, 1, BAR_H)
    }

    // $0 line: the loss/gain split = cumulative probability of all losses.
    let pLoss = 0
    for (let i = 0; i < n; i++) if (state[i].delta < 0) pLoss += state[i].p / total
    const zeroX = pLoss * w
    ctx.fillStyle = 'rgba(35, 38, 47, 0.9)'
    ctx.fillRect(zeroX - 1, 0, 2, BAR_H)
    if (zeroRef.current) {
      zeroRef.current.style.left = `${zeroX}px`
      zeroRef.current.style.display = pLoss > 0.001 && pLoss < 0.999 ? 'block' : 'none'
    }

    // Build label clusters: adjacent tiles at (effectively) the same value are
    // one visual block, so report their combined probability.
    type Cluster = { delta: number; p: number; x: number; w: number }
    const clusters: Cluster[] = []
    for (let i = 0; i < n; i++) {
      const last = clusters[clusters.length - 1]
      if (last && Math.abs(state[i].delta - last.delta) <= CLUSTER_EPS) {
        last.p += state[i].p / total
        last.w += ws[i]
      } else {
        clusters.push({ delta: state[i].delta, p: state[i].p / total, x: xs[i], w: ws[i] })
      }
    }

    // Place one label per cluster, left→right, skipping ones too narrow or too
    // close to the previously shown label.
    let lastLabelX = -Infinity
    for (let j = 0; j < labelRefs.current.length; j++) {
      const el = labelRefs.current[j]
      if (!el) continue
      const c = clusters[j]
      const cx = c ? c.x + c.w / 2 : 0
      if (!c || c.w < MIN_LABEL_PX || cx - lastLabelX < MIN_LABEL_GAP_PX) {
        el.style.display = 'none'
        continue
      }
      lastLabelX = cx
      const rgb = rampRGB(c.delta, globalMin, globalMax)
      const onDark = luminance(rgb) < 160
      el.style.display = 'flex'
      el.style.left = `${cx}px`
      el.style.color = onDark ? '#ffffff' : 'rgb(35, 38, 47)'
      el.style.textShadow = onDark
        ? '0 1px 2px rgba(0,0,0,0.35)'
        : '0 1px 2px rgba(255,255,255,0.65)'
      el.innerHTML =
        `<span class="payoff-label-d">${fmtDelta(Math.round(c.delta))}</span>` +
        `<span class="payoff-label-p">${Math.round(c.p * 100)}%</span>`
    }
  }

  // One animation step: ease the displayed state toward the target, then draw.
  const tick = () => {
    const to = toRef.current
    let cur = curRef.current
    if (cur.length !== to.length) cur = to.map((o) => ({ ...o })) // snap on shape change

    let moving = false
    const next = to.map((t, i) => {
      const c = cur[i] ?? t
      const delta = c.delta + (t.delta - c.delta) * SMOOTH
      const p = c.p + (t.p - c.p) * SMOOTH
      if (Math.abs(t.delta - delta) > 0.5 || Math.abs(t.p - p) > 0.0008) moving = true
      return { delta, p }
    })

    curRef.current = moving ? next : to.map((o) => ({ ...o }))
    draw(curRef.current)
    rafRef.current = moving ? requestAnimationFrame(tick) : null
  }

  // Retarget whenever the distribution changes. Always clear the handle on
  // cleanup so a fresh frame can be scheduled (guards against StrictMode's
  // double-mount leaving a stale handle that would freeze the bar).
  useEffect(() => {
    toRef.current = outcomes
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomes, globalMin, globalMax])

  // Redraw the current state on resize.
  useEffect(() => {
    const target = containerRef.current
    if (!target) return
    const ro = new ResizeObserver(() => draw(curRef.current))
    ro.observe(target)
    draw(curRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: BAR_H + ZERO_LABEL_H }}
    >
      <div
        className="absolute inset-x-0 top-0 overflow-hidden rounded-lg bg-surface2"
        style={{ height: BAR_H }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {outcomes.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className="payoff-label"
          style={{ top: BAR_H / 2 }}
        />
      ))}

      <div ref={zeroRef} className="payoff-zero" style={{ top: BAR_H + 4 }}>
        $0
      </div>
    </div>
  )
}

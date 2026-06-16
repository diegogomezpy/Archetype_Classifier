import { useEffect, useRef } from 'react'
import type { AllocRound } from '../types'
import { INPUT, computeOutcomes, type Outcome } from '../lib/outcomes'

interface PayoffBarProps {
  round: AllocRound
  allocX: number // 0–100, share of the $10,000 in Investment X
}

// ── Tunable constants ───────────────────────────────────────────────────────

// Color: diverging, absolute, fast-rising. Intensity is anchored to a FIXED
// reference (not each round's own max) so the same dollar P&L always renders
// the same color across every round.
const COLOR_REF = 20000 // |P&L| that maps to full intensity
const RAMP_EXP = 0.4 // <1 surges to vivid early, then plateaus
const GAIN_HUE = 150 // green
const LOSS_HUE = 6 // red
const NEUTRAL_FILL = '#C8C6BD' // exactly $10k (|P&L| < 1)

// Font scaling for the per-segment dollar label (also fast-rising).
const FONT_REF = 6000 // |P&L| that maps to MAX_FONT
const MIN_FONT = 12.5
const MAX_FONT = 25

// Geometry (CSS px).
const LIFT_H = 58 // space above the bar: baseline label + lifted dollar labels
const BAR_H = 58 // the stacked bar
const PROB_H = 86 // space below: probability span brackets + labels
const PAD_X = 18 // horizontal inset so edge labels/brackets aren't clipped
const CORNER = 8 // rounded outer corners of the bar
const SEG_GAP = 2 // gap between adjacent segments
const LABEL_FIT_PAD = 12 // dollar label fits inside if textW + this ≤ segWidth
const LABEL_DEOVERLAP_GAP = 8 // min gap between de-overlapped labels
const TINY_SEG_PX = 7 // narrower than this → bracket collapses to a dot

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const ramp = (mag: number, ref: number) => Math.pow(clamp01(mag / ref), RAMP_EXP)

// Bright tint → vivid (never dark), anchored to COLOR_REF.
function fillColor(pnl: number): string {
  if (Math.abs(pnl) < 1) return NEUTRAL_FILL
  const t = ramp(Math.abs(pnl), COLOR_REF)
  const hue = pnl > 0 ? GAIN_HUE : LOSS_HUE
  return `hsl(${hue}, ${55 + t * 40}%, ${78 - t * 30}%)`
}

// Saturated, darker version for connector/bracket strokes so the pale small-
// magnitude tints stay legible against the card background.
function strokeColor(pnl: number): string {
  if (Math.abs(pnl) < 1) return '#9B988F'
  const t = ramp(Math.abs(pnl), COLOR_REF)
  const hue = pnl > 0 ? GAIN_HUE : LOSS_HUE
  return `hsl(${hue}, ${68 + t * 22}%, ${46 - t * 8}%)`
}

// Lightness of fillColor (for auto-contrast). Mirrors the formula above.
function fillIsDark(pnl: number): boolean {
  if (Math.abs(pnl) < 1) return false // neutral gray is light
  const t = ramp(Math.abs(pnl), COLOR_REF)
  return 78 - t * 30 < 58
}

function fontFor(pnl: number): number {
  return MIN_FONT + (MAX_FONT - MIN_FONT) * ramp(Math.abs(pnl), FONT_REF)
}

function pnlLabel(pnl: number): string {
  if (Math.abs(pnl) < 1) return '$0'
  const sign = pnl > 0 ? '+' : '−'
  return sign + '$' + Math.abs(Math.round(pnl)).toLocaleString('en-US')
}

// Walk up the DOM for the first non-transparent background, then decide ink by
// luminance — robust whether or not the app ever gains a dark theme.
function resolvedBg(el: HTMLElement | null): string {
  let node: HTMLElement | null = el
  while (node) {
    const bg = getComputedStyle(node).backgroundColor
    if (bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) return bg
    node = node.parentElement
  }
  return '#ffffff'
}
function luminance(rgb: string): number {
  const m = rgb.match(/[\d.]+/g)
  if (!m) return 1
  const [r, g, b] = m.map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

// Horizontal de-overlap: nudge centers apart (keeping order) so labels of the
// given half-widths don't collide, staying within [minX, maxX].
function deoverlap(centers: number[], halfW: number[], minX: number, maxX: number): number[] {
  const pos = centers.slice()
  const n = pos.length
  for (let i = 1; i < n; i++) {
    const minPos = pos[i - 1] + halfW[i - 1] + LABEL_DEOVERLAP_GAP + halfW[i]
    if (pos[i] < minPos) pos[i] = minPos
  }
  for (let i = n - 1; i >= 0; i--) {
    const cap = i === n - 1 ? maxX - halfW[i] : pos[i + 1] - halfW[i + 1] - LABEL_DEOVERLAP_GAP - halfW[i]
    if (pos[i] > cap) pos[i] = cap
  }
  for (let i = 0; i < n; i++) {
    const floor = i === 0 ? minX + halfW[i] : pos[i - 1] + halfW[i - 1] + LABEL_DEOVERLAP_GAP + halfW[i]
    if (pos[i] < floor) pos[i] = floor
  }
  return pos
}

const FONT = (size: number, weight = 400) =>
  `${weight} ${size}px Inter, system-ui, -apple-system, sans-serif`

export default function PayoffBar({ round, allocX }: PayoffBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const draw = () => {
      const w = container.offsetWidth
      if (w === 0) return
      const h = LIFT_H + BAR_H + PROB_H
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const ink = luminance(resolvedBg(container)) < 0.5 ? '#F0EEE8' : '#23262F'
      const muted = luminance(resolvedBg(container)) < 0.5 ? '#9AA0AD' : '#7C808B'

      const outcomes = computeOutcomes(round, allocX)
      const total = outcomes.reduce((s, o) => s + o.p, 0) || 1
      const innerW = w - 2 * PAD_X
      const barTop = LIFT_H
      const barBottom = LIFT_H + BAR_H

      // Segment geometry (width ∝ probability), ordered worst→best.
      type Seg = Outcome & { x0: number; x1: number; pnl: number }
      const segs: Seg[] = []
      let cum = 0
      for (const o of outcomes) {
        const x0 = PAD_X + (cum / total) * innerW
        cum += o.p
        const x1 = PAD_X + (cum / total) * innerW
        segs.push({ ...o, x0, x1, pnl: o.end - INPUT })
      }
      const n = segs.length

      // ── Bar fills (clipped to a rounded rect for rounded outer corners) ─────
      ctx.save()
      roundRectPath(ctx, PAD_X, barTop, innerW, BAR_H, CORNER)
      ctx.clip()
      segs.forEach((s, i) => {
        const left = s.x0 + (i > 0 ? SEG_GAP / 2 : 0)
        const right = s.x1 - (i < n - 1 ? SEG_GAP / 2 : 0)
        ctx.fillStyle = fillColor(s.pnl)
        ctx.fillRect(left, barTop, Math.max(0, right - left), BAR_H)
      })
      ctx.restore()

      // ── $10,000 baseline: split between losses (left) and gains (right) ────
      let lossP = 0
      for (const o of outcomes) if (o.end < INPUT) lossP += o.p
      const baseX = Math.max(PAD_X, Math.min(PAD_X + innerW, PAD_X + (lossP / total) * innerW))
      ctx.save()
      ctx.strokeStyle = muted
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(baseX, barTop - 4)
      ctx.lineTo(baseX, barBottom + 4)
      ctx.stroke()
      ctx.restore()
      // "$10,000 start" label above the baseline.
      ctx.font = FONT(11.5, 500)
      ctx.fillStyle = muted
      ctx.textBaseline = 'alphabetic'
      const blLabel = '$10,000 start'
      const blW = ctx.measureText(blLabel).width
      ctx.textAlign = 'left'
      const blX = Math.max(PAD_X, Math.min(w - PAD_X - blW, baseX - blW / 2))
      ctx.fillText(blLabel, blX, 14)

      // ── Dollar labels: inside if they fit, else lifted above with elbow ─────
      const lifted: Seg[] = []
      ctx.textBaseline = 'middle'
      for (let i = 0; i < n; i++) {
        const s = segs[i]
        const size = fontFor(s.pnl)
        const label = pnlLabel(s.pnl)
        ctx.font = FONT(size, 600)
        const tw = ctx.measureText(label).width
        const segVis = s.x1 - s.x0 - SEG_GAP
        if (tw + LABEL_FIT_PAD <= segVis) {
          ctx.fillStyle = fillIsDark(s.pnl) ? '#ffffff' : '#23262F'
          ctx.textAlign = 'center'
          ctx.fillText(label, (s.x0 + s.x1) / 2, barTop + BAR_H / 2 + 1)
        } else {
          lifted.push(s)
        }
      }
      if (lifted.length) {
        const centers = lifted.map((s) => (s.x0 + s.x1) / 2)
        const sizes = lifted.map((s) => fontFor(s.pnl))
        const labels = lifted.map((s) => pnlLabel(s.pnl))
        const halfW = lifted.map((s, i) => {
          ctx.font = FONT(sizes[i], 600)
          return ctx.measureText(labels[i]).width / 2 + 4
        })
        const labelY = LIFT_H - 26
        const placed = deoverlap(centers, halfW, PAD_X, w - PAD_X)
        lifted.forEach((s, i) => {
          const segCx = centers[i]
          const lx = placed[i]
          ctx.strokeStyle = strokeColor(s.pnl)
          ctx.fillStyle = strokeColor(s.pnl)
          ctx.lineWidth = 1
          ctx.setLineDash([])
          // elbow: label → down → across → dot on the bar
          ctx.beginPath()
          ctx.moveTo(lx, labelY + 8)
          ctx.lineTo(lx, labelY + 14)
          ctx.lineTo(segCx, barTop - 6)
          ctx.lineTo(segCx, barTop - 1)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(segCx, barTop - 1, 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.font = FONT(sizes[i], 600)
          ctx.textAlign = 'center'
          ctx.fillText(labels[i], lx, labelY)
        })
      }

      // ── Probability span brackets below the bar ────────────────────────────
      const bracketY = barBottom + 14
      const tickH = 6
      const pctY = barBottom + 44
      const wordY = barBottom + 60
      // de-overlap the (two-line) probability labels by their widest line
      ctx.font = FONT(16, 500)
      const pctTexts = segs.map((s) => `${Math.round((s.p / total) * 100)}%`)
      const halfW = segs.map((s, i) => {
        ctx.font = FONT(16, 500)
        const a = ctx.measureText(pctTexts[i]).width
        ctx.font = FONT(13, 400)
        const b = ctx.measureText('probability').width
        return Math.max(a, b) / 2 + 6
      })
      const centers = segs.map((s) => (s.x0 + s.x1) / 2)
      const placed = deoverlap(centers, halfW, PAD_X, w - PAD_X)

      segs.forEach((s, i) => {
        const segCx = centers[i]
        const labelX = placed[i]
        const stroke = strokeColor(s.pnl)
        const segW = s.x1 - s.x0 - SEG_GAP
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1.25
        ctx.setLineDash([])

        if (segW < TINY_SEG_PX) {
          // collapse bracket to a dot
          ctx.fillStyle = stroke
          ctx.beginPath()
          ctx.arc(segCx, bracketY, 1.75, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const bl = s.x0 + SEG_GAP / 2
          const br = s.x1 - SEG_GAP / 2
          ctx.beginPath()
          ctx.moveTo(bl, bracketY - tickH) // left tick up toward bar
          ctx.lineTo(bl, bracketY)
          ctx.lineTo(br, bracketY) // span
          ctx.lineTo(br, bracketY - tickH) // right tick up
          ctx.stroke()
        }

        // stem from bracket center down, bending to the (de-overlapped) label
        ctx.beginPath()
        ctx.moveTo(segCx, bracketY)
        ctx.lineTo(segCx, bracketY + 8)
        ctx.lineTo(labelX, bracketY + 16)
        ctx.lineTo(labelX, pctY - 14)
        ctx.stroke()

        // two-line label: "64%" (emphasis) + "probability" (lighter)
        ctx.textAlign = 'center'
        ctx.fillStyle = ink
        ctx.font = FONT(16, 500)
        ctx.fillText(pctTexts[i], labelX, pctY)
        ctx.fillStyle = muted
        ctx.font = FONT(13, 400)
        ctx.fillText('probability', labelX, wordY)
      })
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [round, allocX])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: LIFT_H + BAR_H + PROB_H }}>
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  )
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

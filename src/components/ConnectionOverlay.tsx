// CSKY Platform — Connection Overlay
// Uses the Glyph · G1 animation from nullframe
// First pattern: drones forming C S K Y letters in the grid

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { requestSerialPort } from '../system/serial'

const GW = 11
const GH = 7
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const dist = (x: number, y: number) => Math.hypot(x - 5, (y - 3) * 1.25)

// CSKY letter bitmaps on the 11×7 grid
// Each letter is 2 columns wide, with 1-column gaps between them
// Layout: C(cols 0-1) _ S(cols 3-4) _ K(cols 6-7) _ Y(cols 9-10)
const CSKY_GRID: number[][] = [
  // Row 0 (y=0)
  [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0],
  // Row 1 (y=1)
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
  // Row 2 (y=2)
  [1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0],
  // Row 3 (y=3)
  [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0],
  // Row 4 (y=4)
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0],
  // Row 5 (y=5)
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0],
  // Row 6 (y=6)
  [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0],
]

// Fit CSKY pattern to 11×7 grid
function cskyPattern(x: number, y: number): number {
  if (y < 0 || y >= 7 || x < 0 || x >= GW) return 0.06
  // The bitmap is 13 cols wide — center it in 11 cols (offset by -1)
  const bx = x + 1
  if (bx < 0 || bx >= 13) return 0.06
  const row = CSKY_GRID[y]
  if (!row) return 0.06
  return row[bx] ? 0.92 : 0.06
}

const PATS: ((x: number, y: number, t: number) => number)[] = [
  // Pattern 0: CSKY letters
  (x, y) => cskyPattern(x, y),
  // Pattern 1: Breathing ring
  (x, y, t) => clamp01(1.1 - (dist(x, y) - 2.6 + 0.25 * Math.sin(t * 1.6)) * 0.8),
  // Pattern 2: Static ring
  (x, y) => clamp01(1.1 - Math.abs(dist(x, y) - 2.7) * 0.8),
  // Pattern 3: Pac-man ring
  (x, y) => (Math.abs(Math.atan2(y - 3, x - 5)) < 0.62 ? 0.06 : clamp01(1.1 - Math.abs(dist(x, y) - 2.7) * 0.8)),
  // Pattern 4: Ring with center
  (x, y) => Math.max(clamp01(1.1 - Math.abs(dist(x, y) - 2.7) * 0.8), dist(x, y) < 1 ? 0.95 : 0),
  // Pattern 5: Columns
  (x, y) => (y >= 1 && y <= 5 && (x === 3 || x === 4 || x === 6 || x === 7) ? 0.92 : 0.06),
  // Pattern 6: Frame
  (x, y) => (((x === 2 || x === 8) && y >= 1 && y <= 5) || ((y === 1 || y === 5) && (x === 3 || x === 7)) ? 0.92 : 0.06),
  // Pattern 7: Diamond
  (x, y) => clamp01(1.1 - (Math.abs(x - 5) + Math.abs(y - 3)) * 0.36),
  // Pattern 8: Wave
  (x, y, t) => {
    const h = (Math.sin(t * 1.9 + x * 0.9) + Math.sin(t * 1.3 + x * 1.7)) * 0.25 + 0.55
    return GH - 1 - y < h * GH ? 0.84 : 0.06
  },
  // Pattern 9: Matrix rain
  (x, y, t) => {
    const v = Math.sin(x * 12.9898 + y * 37.719 + Math.floor(t * 2.5 + ((x * 7 + y * 13) % 4)) * 78.233) * 43758.5
    return (v - Math.floor(v)) * 0.92
  },
]

function easeOutBack(p: number) {
  const c = 1.70158
  const q = p - 1
  return 1 + (c + 1) * q * q * q + c * q * q
}

export function ConnectionOverlay({ onConnected }: { onConnected: () => void }) {
  const motionOff = useReducedMotion() ?? false
  const ref = useRef<HTMLCanvasElement>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const success = await requestSerialPort()
      if (success) {
        onConnected()
      } else {
        setError('No MAVLink data received. Check USB connection.')
        setConnecting(false)
      }
    } catch {
      setError('Connection failed. Try again.')
      setConnecting(false)
    }
  }

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const ro = new ResizeObserver(() => {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
    })
    ro.observe(cv)
    let vis = true
    const io = new IntersectionObserver(en => {
      vis = en[0]?.isIntersecting ?? true
    })
    io.observe(cv)

    const N = GW * GH
    const cur = new Float32Array(N)
    const slam = new Float32Array(N).fill(1)
    const dly = new Float32Array(N)
    let pat = 0
    let switchAt = 0
    let acc = 0
    let sweepAt = -10
    
    // We'll use a local requestAnimationFrame since this might run before bus starts,
    // or we can just use bus.draw if bus is already running. We use local for safety.
    let raf = 0
    let last = performance.now()
    
    function frame(time: number) {
      raf = requestAnimationFrame(frame)
      const t = time / 1000
      const dt = Math.min(0.1, (time - last) / 1000)
      last = time

      if (!vis || !w || !h) return
      acc += dt
      if (acc < 0.033) return
      const step = acc
      acc = 0
      if (!motionOff && t >= switchAt) {
        pat = (pat + 1) % PATS.length
        switchAt = t + 1.6
        for (let i = 0; i < N; i++) {
          dly[i] = t + Math.random() * 0.24
          slam[i] = 0
        }
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, w, h)
      const gap = 3
      const cell = Math.min((w - (GW - 1) * gap) / GW, (h - (GH - 1) * gap) / GH)
      const ox = (w - (GW * cell + (GW - 1) * gap)) / 2
      const oy = (h - (GH * cell + (GH - 1) * gap)) / 2
      const sweepX = (t - sweepAt) * 14 - 2
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x
          if (t > dly[i]) slam[i] = Math.min(1, slam[i] + step / 0.3)
          cur[i] += (PATS[pat](x, y, t) - cur[i]) * Math.min(1, step * 10)
          let v = clamp01(cur[i] + (1 - slam[i]) * 0.4)
          if (Math.abs(x - sweepX) < 0.8) v = 1
          const g = Math.round(28 + v * 204)
          ctx!.fillStyle = `rgb(${g},${g},${g})`
          const s = cell * (0.45 + 0.55 * easeOutBack(slam[i]))
          const cx = ox + x * (cell + gap) + cell / 2
          const cy = oy + y * (cell + gap) + cell / 2
          ctx!.beginPath()
          ctx!.roundRect(cx - s / 2, cy - s / 2, s, s, 2)
          ctx!.fill()
        }
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [motionOff])

  return (
    <motion.div 
      className="connection-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="conn-box">
        <div className="conn-canvas">
          <canvas ref={ref} />
        </div>
        <h1 className="conn-title">CSKY PLATFORM</h1>
        <p className="conn-desc">Awaiting MAVLink telemetry stream</p>
        {error && <p className="conn-error">{error}</p>}
        <button className="conn-btn" onClick={handleConnect} disabled={connecting}>
          {connecting ? 'CONNECTING...' : 'CONNECT USB'}
        </button>
      </div>
    </motion.div>
  )
}

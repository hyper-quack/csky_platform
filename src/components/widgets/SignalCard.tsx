// CSKY Platform — Signal Card
// Radio link quality with bar chart

import { useEffect, useRef } from 'react'
import { Card } from '../Card'
import { bus } from '../../system/telemetry'
import { useTelemetry, useBootNumber } from '../../system/hooks'

const BARS = 28

export function SignalCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const shown = useBootNumber(snap.radio.signalStrength)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0, h = 0
    const ro = new ResizeObserver(() => {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
    })
    ro.observe(cv)

    const buf = new Float32Array(BARS)
    let head = 0
    let acc = 1

    const offDraw = bus.draw((_t, dt) => {
      if (!w || !h) return
      acc += dt
      if (acc < 0.2) return
      acc = 0
      const base = Math.min(1, bus.get().radio.signalStrength / 100)
      buf[head] = Math.min(1, Math.max(0.06, base * (0.5 + Math.random() * 0.5)))
      head = (head + 1) % BARS

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const gap = 2
      const bw = (w - (BARS - 1) * gap) / BARS
      for (let i = 0; i < BARS; i++) {
        const v = buf[(head + i) % BARS]
        const bh = Math.max(2, v * h)
        ctx.fillStyle = i === BARS - 1 ? '#f26522' : '#d8d8d8'
        ctx.fillRect(i * (bw + gap), h - bh, bw, bh)
      }
    })

    return () => {
      offDraw()
      ro.disconnect()
    }
  }, [])

  return (
    <Card index={index} label="RADIO LINK" tag="SIM" tagAlways className="signal-card">
      <div className="metric">
        {shown}<small>%</small>
      </div>
      <div className="mono-sub">
        RSSI {snap.radio.rssi.toFixed(0)} dBm · NOISE {snap.radio.noise.toFixed(0)} dBm
      </div>
      <div className="canvas-fill" style={{ maxHeight: 36, marginTop: 'auto' }}>
        <canvas ref={ref} />
      </div>
    </Card>
  )
}

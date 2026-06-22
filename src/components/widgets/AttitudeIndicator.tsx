// CSKY Platform — Attitude Indicator
// Artificial horizon rendered on canvas

import { useEffect, useRef } from 'react'
import { bus } from '../../system/telemetry'

export function AttitudeIndicator() {
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
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    })
    ro.observe(cv)

    const offDraw = bus.draw(() => {
      if (!w || !h) return
      const snap = bus.get()
      const roll = snap.imu1.roll * Math.PI / 180
      const pitch = snap.imu1.pitch
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.42

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Clip to circle
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()

      // Rotate by roll
      ctx.translate(cx, cy)
      ctx.rotate(-roll)

      // Sky / ground split offset by pitch
      const pitchOffset = pitch * 2.5
      const skyGrad = ctx.createLinearGradient(0, -r * 2 + pitchOffset, 0, pitchOffset)
      skyGrad.addColorStop(0, '#1a3a5c')
      skyGrad.addColorStop(1, '#2a5a8c')
      ctx.fillStyle = skyGrad
      ctx.fillRect(-r * 2, -r * 2 + pitchOffset, r * 4, r * 2)

      const gndGrad = ctx.createLinearGradient(0, pitchOffset, 0, r * 2 + pitchOffset)
      gndGrad.addColorStop(0, '#5a3a1a')
      gndGrad.addColorStop(1, '#3a2510')
      ctx.fillStyle = gndGrad
      ctx.fillRect(-r * 2, pitchOffset, r * 4, r * 2)

      // Horizon line
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-r * 2, pitchOffset)
      ctx.lineTo(r * 2, pitchOffset)
      ctx.stroke()

      // Pitch ladder
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '9px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.lineWidth = 0.8
      for (let deg = -30; deg <= 30; deg += 10) {
        if (deg === 0) continue
        const y = pitchOffset - deg * 2.5
        const hw = 20
        ctx.beginPath()
        ctx.moveTo(-hw, y)
        ctx.lineTo(hw, y)
        ctx.stroke()
        ctx.fillText(`${deg}`, hw + 14, y + 3)
        ctx.fillText(`${deg}`, -hw - 14, y + 3)
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.restore()

      // Fixed reticle (not rotated)
      ctx.save()
      ctx.strokeStyle = '#f26522'
      ctx.lineWidth = 2

      // Center wings
      ctx.beginPath()
      ctx.moveTo(cx - 30, cy)
      ctx.lineTo(cx - 10, cy)
      ctx.lineTo(cx - 10, cy + 6)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cx + 30, cy)
      ctx.lineTo(cx + 10, cy)
      ctx.lineTo(cx + 10, cy + 6)
      ctx.stroke()

      // Center dot
      ctx.fillStyle = '#f26522'
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Bank angle arc
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, r - 4, Math.PI + 0.3, -0.3)
      ctx.stroke()

      // Bank angle marks
      for (const deg of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
        const a = (deg - 90) * Math.PI / 180
        const inner = r - 10
        const outer = r - (deg % 30 === 0 ? 2 : 6)
        ctx.strokeStyle = deg === 0 ? '#f26522' : 'rgba(255,255,255,0.3)'
        ctx.lineWidth = deg % 30 === 0 ? 1.5 : 0.8
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
        ctx.stroke()
      }

      // Roll pointer (triangle)
      const rollAngle = -roll - Math.PI / 2
      ctx.fillStyle = '#f26522'
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(rollAngle) * (r - 12), cy + Math.sin(rollAngle) * (r - 12))
      ctx.lineTo(cx + Math.cos(rollAngle - 0.06) * (r - 4), cy + Math.sin(rollAngle - 0.06) * (r - 4))
      ctx.lineTo(cx + Math.cos(rollAngle + 0.06) * (r - 4), cy + Math.sin(rollAngle + 0.06) * (r - 4))
      ctx.fill()

      // Border ring
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      ctx.restore()
    })

    return () => {
      offDraw()
      ro.disconnect()
    }
  }, [])

  return (
    <div className="attitude-wrap" id="attitude-indicator">
      <div className="meta-row">
        <span>ATTITUDE</span>
        <span className="tag always">LIVE</span>
      </div>
      <canvas ref={ref} className="attitude-canvas" />
    </div>
  )
}

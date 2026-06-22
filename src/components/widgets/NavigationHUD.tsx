// CSKY Platform — Navigation HUD
// Compass + crosshair overlay rendered on canvas

import { useEffect, useRef } from 'react'
import { bus } from '../../system/telemetry'

export function NavigationHUD() {
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const heading = snap.flight.heading
      const roll = snap.imu1.roll
      const pitch = snap.imu1.pitch

      // --- Compass arc at top ---
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '10px "Space Mono", monospace'
      ctx.textAlign = 'center'

      const compassR = Math.min(w, h) * 0.35
      const compassY = cy - compassR * 0.1

      // Tick marks
      for (let deg = 0; deg < 360; deg += 5) {
        const angle = ((deg - heading + 180) % 360 - 180) * Math.PI / 180
        if (Math.abs(angle) > Math.PI / 3) continue
        const x = cx + Math.sin(angle) * compassR
        const y = compassY - Math.cos(angle) * compassR
        const isMajor = deg % 30 === 0
        const len = isMajor ? 14 : 7

        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(
          x - Math.sin(angle) * len,
          y + Math.cos(angle) * len
        )
        ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'
        ctx.lineWidth = isMajor ? 1.5 : 0.8
        ctx.stroke()

        if (deg % 30 === 0) {
          const labels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }
          const label = labels[deg] ?? String(deg)
          ctx.fillStyle = deg === 0 ? '#f26522' : 'rgba(255,255,255,0.6)'
          ctx.fillText(
            label,
            x - Math.sin(angle) * (len + 12),
            y + Math.cos(angle) * (len + 12) + 3
          )
        }
      }

      // Center heading readout
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '12px "Space Mono", monospace'
      ctx.fillText(`${Math.round(heading)}°`, cx, compassY - compassR - 8)
      ctx.restore()

      // --- Crosshair ---
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1

      // Horizontal line
      ctx.beginPath()
      ctx.moveTo(cx - 30, cy)
      ctx.lineTo(cx - 8, cy)
      ctx.moveTo(cx + 8, cy)
      ctx.lineTo(cx + 30, cy)
      ctx.stroke()

      // Vertical line
      ctx.beginPath()
      ctx.moveTo(cx, cy - 30)
      ctx.lineTo(cx, cy - 8)
      ctx.moveTo(cx, cy + 8)
      ctx.lineTo(cx, cy + 30)
      ctx.stroke()

      // Center dot
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // --- Roll indicator arc ---
      ctx.save()
      ctx.translate(cx, cy + compassR * 0.5)
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(0, 0, 40, Math.PI + 0.5, -0.5)
      ctx.stroke()

      // Roll pointer
      const rollRad = roll * Math.PI / 180
      ctx.strokeStyle = '#f26522'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.sin(-rollRad) * 35, -Math.cos(-rollRad) * 35)
      ctx.stroke()
      ctx.restore()

      // --- Pitch ladder ---
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '9px "Space Mono", monospace'
      ctx.textAlign = 'right'
      ctx.lineWidth = 0.8

      const pitchScale = 3 // pixels per degree
      for (let deg = -20; deg <= 20; deg += 5) {
        if (deg === 0) continue
        const y = cy + (deg + pitch) * pitchScale
        const hw = deg % 10 === 0 ? 25 : 15
        ctx.beginPath()
        ctx.moveTo(cx - hw, y)
        ctx.lineTo(cx + hw, y)
        ctx.stroke()
        if (deg % 10 === 0) {
          ctx.fillText(`${deg}`, cx - hw - 4, y + 3)
        }
      }
      ctx.restore()

      // --- Bottom info ---
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '10px "Space Mono", monospace'

      // Speed (left)
      ctx.textAlign = 'left'
      ctx.fillText(`SPD ${snap.flight.speed.toFixed(1)} m/s`, 16, h - 30)
      ctx.fillText(`ALT ${snap.flight.altitudeAGL.toFixed(0)} m`, 16, h - 16)

      // Signal (right)
      ctx.textAlign = 'right'
      ctx.fillText(`RSSI ${snap.radio.rssi.toFixed(0)} dBm`, w - 16, h - 30)
      ctx.fillText(`${snap.radio.signalStrength.toFixed(0)}%`, w - 16, h - 16)
      ctx.restore()
    })

    return () => {
      offDraw()
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="nav-hud" id="nav-hud" />
}

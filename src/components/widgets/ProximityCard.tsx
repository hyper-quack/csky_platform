// CSKY Platform — Proximity Card (TF-Luna side lidars)
// Top-down obstacle view: left/right clearance for collision avoidance.

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const RANGE_M = 8 // TF-Luna max range
const WARN_M = 1.5 // amber below this
const DANGER_M = 0.5 // red below this

function color(dist: number, valid: boolean): string {
  if (!valid) return 'rgba(255,255,255,0.15)'
  if (dist < DANGER_M) return '#d71921'
  if (dist < WARN_M) return '#f2a51a'
  return '#3fb950'
}

// One side bar. `side` flips growth direction; bar fills from the drone outward,
// shorter = closer obstacle.
function SideBar({ dist, valid, side }: { dist: number; valid: boolean; side: 'L' | 'R' }) {
  const clamped = Math.max(0, Math.min(RANGE_M, dist))
  const pct = valid ? clamped / RANGE_M : 1
  const c = color(dist, valid)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: side === 'L' ? 'flex-start' : 'flex-end' }}>
        <span className="doto-sm" style={{ fontSize: 18, color: c }}>
          {valid ? `${dist.toFixed(2)} m` : '—'}
        </span>
      </div>
      <div
        style={{
          height: 12,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 2,
          display: 'flex',
          flexDirection: side === 'L' ? 'row-reverse' : 'row',
        }}
      >
        <div style={{ width: `${pct * 100}%`, height: '100%', background: c, borderRadius: 2, opacity: 0.85, transition: 'width 0.1s linear' }} />
      </div>
      <span className="mono-sub dim" style={{ textAlign: side === 'L' ? 'left' : 'right' }}>
        {side === 'L' ? 'LEFT' : 'RIGHT'}
      </span>
    </div>
  )
}

export function ProximityCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const p = snap.proximity
  const live = Date.now() - p.lastUpdate < 1000
  const nearest = Math.min(
    p.leftValid ? p.left : RANGE_M,
    p.rightValid ? p.right : RANGE_M,
  )
  const alarm = live && nearest < DANGER_M

  return (
    <Card
      index={index}
      label="PROXIMITY · TF-LUNA"
      tag="LIVE"
      className="proximity-card"
      right={
        <span className={`imu-health ${!live ? 'fail' : alarm ? 'fail' : nearest < WARN_M ? 'unknown' : 'ok'}`}>
          <span className={`led ${alarm ? 'red' : ''}`} style={{ width: 6, height: 6 }} />
          {!live ? 'NO DATA' : alarm ? 'TOO CLOSE' : nearest < WARN_M ? 'NEAR' : 'CLEAR'}
        </span>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px' }}>
        <SideBar dist={p.left} valid={live && p.leftValid} side="L" />
        {/* Top-down drone glyph */}
        <svg viewBox="0 0 32 32" width="32" height="32" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <circle cx="24" cy="8" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <circle cx="8" cy="24" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <line x1="8" y1="8" x2="24" y2="24" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <line x1="24" y1="8" x2="8" y2="24" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          {/* nose marker (forward = up) */}
          <polygon points="16,2 13,8 19,8" fill="#f26522" />
        </svg>
        <SideBar dist={p.right} valid={live && p.rightValid} side="R" />
      </div>
    </Card>
  )
}

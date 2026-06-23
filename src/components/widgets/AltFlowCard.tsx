// CSKY Platform — Altitude (lidar) + Optical Flow Card
// Vertical AGL tape from the MTF-01 lidar plus flow velocity/quality.

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const ALT_MAX = 8 // m, MTF-01 lidar working range

function AltTape({ height, valid }: { height: number; valid: boolean }) {
  const h = Math.max(0, Math.min(ALT_MAX, height))
  const pct = h / ALT_MAX
  // Ticks every 1 m.
  const ticks = []
  for (let m = 0; m <= ALT_MAX; m++) {
    const y = 120 - (m / ALT_MAX) * 116 - 2
    ticks.push(
      <g key={m}>
        <line x1="22" y1={y} x2="30" y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <text x="18" y={y + 3} textAnchor="end" fontSize="8" fontFamily='"Space Mono", monospace' fill="rgba(255,255,255,0.4)">
          {m}
        </text>
      </g>,
    )
  }
  const fillY = 120 - pct * 116 - 2
  return (
    <svg viewBox="0 0 60 124" width="60" height="124">
      <rect x="30" y="2" width="14" height="116" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" />
      {valid && (
        <rect x="30" y={fillY} width="14" height={120 - fillY - 2} fill="#f26522" opacity="0.7" />
      )}
      {ticks}
      {valid && (
        <polygon points={`46,${fillY} 52,${fillY - 4} 52,${fillY + 4}`} fill="#f26522" />
      )}
    </svg>
  )
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="mono-sub dim">{label}</span>
      <span className="doto-sm" style={{ whiteSpace: 'pre', opacity: dim ? 0.4 : 1 }}>
        {value}
      </span>
    </div>
  )
}

export function AltFlowCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const nav = snap.nav
  const speed = Math.sqrt(nav.flowVx * nav.flowVx + nav.flowVy * nav.flowVy)
  const qpct = Math.round((nav.flowQuality / 255) * 100)

  return (
    <Card index={index} label="ALTITUDE · FLOW" tag="LIVE" className="altflow-card">
      <div style={{ display: 'flex', gap: 14, margin: '6px 0 8px' }}>
        <AltTape height={nav.lidarHeight} valid={nav.lidarValid} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="doto-sm" style={{ fontSize: 22 }}>
              {nav.lidarValid ? nav.lidarHeight.toFixed(2) : '—'}
            </span>
            <span className="mono-sub dim">m AGL</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono-sub dim">LIDAR</span>
            <span className={`imu-health ${nav.lidarValid ? 'ok' : 'fail'}`}>
              <span className={`led ${nav.lidarValid ? '' : 'red'}`} style={{ width: 6, height: 6 }} />
              {nav.lidarValid ? 'LOCK' : 'NO RET'}
            </span>
          </div>
          <Row label="FLOW VX" value={`${nav.flowVx >= 0 ? '+' : ''}${nav.flowVx.toFixed(2)} m/s`} dim={!nav.flowValid} />
          <Row label="FLOW VY" value={`${nav.flowVy >= 0 ? '+' : ''}${nav.flowVy.toFixed(2)} m/s`} dim={!nav.flowValid} />
          <Row label="GND SPD" value={`${speed.toFixed(2)} m/s`} dim={!nav.flowValid} />
          <Row label="FLOW Q" value={`${qpct}%`} dim={!nav.flowValid} />
        </div>
      </div>
    </Card>
  )
}

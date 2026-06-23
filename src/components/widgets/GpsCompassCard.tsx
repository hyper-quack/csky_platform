// CSKY Platform — GPS + Compass Card
// Heading rose (driven by the FC's fused, mag-aided yaw) plus GPS readout.

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const OCTANTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function octant(heading: number): string {
  return OCTANTS[Math.round(((heading % 360) + 360) % 360 / 45) % 8]
}

function CompassRose({ heading }: { heading: number }) {
  // Fixed card (N up); the needle points along the current heading.
  const ticks = []
  for (let deg = 0; deg < 360; deg += 30) {
    const a = (deg * Math.PI) / 180
    const major = deg % 90 === 0
    const r1 = 46
    const r2 = major ? 36 : 41
    ticks.push(
      <line
        key={deg}
        x1={60 + Math.sin(a) * r1}
        y1={60 - Math.cos(a) * r1}
        x2={60 + Math.sin(a) * r2}
        y2={60 - Math.cos(a) * r2}
        stroke={major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}
        strokeWidth={major ? 1.4 : 0.8}
      />,
    )
  }

  const cardinals: Array<[string, number]> = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['W', 270],
  ]

  return (
    <div className="ring-wrap-sm" style={{ width: 120, height: 120 }}>
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {ticks}
        {cardinals.map(([label, deg]) => {
          const a = (deg * Math.PI) / 180
          return (
            <text
              key={label}
              x={60 + Math.sin(a) * 28}
              y={60 - Math.cos(a) * 28 + 4}
              textAnchor="middle"
              fontSize="11"
              fontFamily='"Space Mono", monospace'
              fill={label === 'N' ? '#f26522' : 'rgba(255,255,255,0.6)'}
            >
              {label}
            </text>
          )
        })}
        {/* Heading needle */}
        <g transform={`rotate(${heading} 60 60)`}>
          <polygon points="60,14 55,62 65,62" fill="#f26522" />
          <polygon points="60,106 55,58 65,58" fill="rgba(255,255,255,0.35)" />
        </g>
        <circle cx="60" cy="60" r="3" fill="rgba(255,255,255,0.8)" />
      </svg>
      <div className="ring-val-sm" style={{ top: '50%', transform: 'translate(-50%, 18px)' }}>
        {Math.round(((heading % 360) + 360) % 360)}°
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="mono-sub dim">{label}</span>
      <span className="doto-sm" style={{ whiteSpace: 'pre' }}>
        {value}
      </span>
    </div>
  )
}

export function GpsCompassCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const heading = ((snap.flight.heading % 360) + 360) % 360
  const gps = snap.gps

  const fixClass = gps.fix === '3D' ? 'ok' : gps.fix === '2D' ? 'unknown' : 'fail'
  const hasFix = gps.fix !== 'NONE'

  return (
    <Card index={index} label="GPS · COMPASS" tag="LIVE" className="gps-card">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '6px 0 10px' }}>
        <CompassRose heading={heading} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="doto-sm" style={{ fontSize: 20 }}>
              {Math.round(heading)}°
            </span>
            <span className="mono-sub dim">{octant(heading)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono-sub dim">FIX</span>
            <span className={`imu-health ${fixClass}`}>
              <span className={`led ${gps.fix === 'NONE' ? 'red' : ''}`} style={{ width: 6, height: 6 }} />
              {gps.fix}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="mono-sub dim">SATS</span>
            <span className="doto-sm" style={{ fontSize: 18 }}>
              {gps.satellites}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Row label="LAT" value={hasFix ? gps.lat.toFixed(7) + '°' : '—'} />
        <Row label="LON" value={hasFix ? gps.lon.toFixed(7) + '°' : '—'} />
        <Row label="ALT (MSL)" value={hasFix ? gps.alt.toFixed(1) + ' m' : '—'} />
        <Row label="HDOP" value={gps.hdop < 99 ? gps.hdop.toFixed(1) : '—'} />
      </div>
    </Card>
  )
}

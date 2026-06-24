// CSKY Platform — Navigation EKF Card
// Fused local position + velocity from the onboard navigation Kalman filter.

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="mono-sub dim">{label}</span>
      <span className="doto-sm" style={{ whiteSpace: 'pre' }}>{value}</span>
    </div>
  )
}

function sign(v: number, d = 2) {
  return (v >= 0 ? '+' : '') + v.toFixed(d)
}

export function NavEkfCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const e = snap.ekf
  const live = e.converged && Date.now() - e.lastUpdate < 1500
  const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy)

  return (
    <Card
      index={index}
      label="NAV · EKF"
      tag="LIVE"
      className="navekf-card"
      right={
        <span className={`imu-health ${live ? 'ok' : 'unknown'}`}>
          <span className={`led ${live ? '' : 'red'}`} style={{ width: 6, height: 6 }} />
          {live ? 'FUSED' : 'CONVERGING'}
        </span>
      }
    >
      {!live && (
        <div className="imu-disconnected" style={{ padding: '10px 0' }}>
          <span className="mono-sub dim">WAITING FOR GPS FIX / CONVERGENCE</span>
        </div>
      )}
      {live && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
          <span className="mono-sub dim">POSITION (m, NED rel. launch)</span>
          <Row label="N / E / D" value={`${sign(e.x, 1)} / ${sign(e.y, 1)} / ${sign(e.z, 1)}`} />
          <span className="mono-sub dim" style={{ marginTop: 4 }}>VELOCITY (m/s)</span>
          <Row label="vN / vE / vD" value={`${sign(e.vx)} / ${sign(e.vy)} / ${sign(e.vz)}`} />
          <Row label="GND SPEED" value={`${speed.toFixed(2)} m/s`} />
        </div>
      )}
    </Card>
  )
}

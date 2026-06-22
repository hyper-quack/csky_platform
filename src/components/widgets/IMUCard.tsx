// CSKY Platform — IMU Card
// Dual-IMU status with ring gauges for roll/pitch

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const RING_R = 38
const RING_C = 2 * Math.PI * RING_R

function ImuRing({ value, label, max = 45 }: { value: number; label: string; max?: number }) {
  const pct = Math.min(1, Math.abs(value) / max)
  const color = Math.abs(value) > max * 0.8 ? '#d71921' : '#f26522'

  return (
    <div className="imu-ring">
      <div className="ring-wrap-sm">
        <svg viewBox="0 0 84 84">
          <circle className="ring-bg" cx="42" cy="42" r={RING_R} />
          <circle
            className="ring-fg"
            cx="42" cy="42" r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - pct)}
            style={{ stroke: color }}
          />
        </svg>
        <div className="ring-val-sm">
          {value.toFixed(1)}°
        </div>
      </div>
      <span className="mono-sub dim">{label}</span>
    </div>
  )
}

function ImuSection({ imuNum, imu, heading }: { imuNum: number; imu: { acc: number[]; gyr: number[]; roll: number; pitch: number; health: string; name: string; connected: boolean; lastUpdate: number }; heading: number }) {
  const formatVal = (v: number) => {
    return (v >= 0 ? '+' : '') + v.toFixed(2).padStart(6, ' ')
  }

  const healthClass = imu.health === 'OK' ? 'ok' : imu.health === 'FAIL' ? 'fail' : 'unknown'
  const isConnected = imu.connected
  const lastSeen = imu.lastUpdate > 0
    ? `${((Date.now() - imu.lastUpdate) / 1000).toFixed(0)}s ago`
    : 'never'

  return (
    <div className="imu-section">
      <div className="imu-header">
        <span className="mono-sub">
          IMU{imuNum} · {imu.name}
        </span>
        <span className={`imu-health ${healthClass}`}>
          <span className={`led ${imu.health === 'FAIL' ? 'red' : ''}`} style={{ width: 6, height: 6 }} /> {imu.health}
        </span>
      </div>

      {isConnected && (
        <>
          <div className="imu-rings" style={{ display: 'flex', gap: 12, margin: '8px 0 8px' }}>
            <ImuRing value={imu.roll} label="ROLL" max={180} />
            <ImuRing value={imu.pitch} label="PITCH" max={90} />
            {imuNum === 1 && <ImuRing value={heading} label="YAW" max={360} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono-sub dim">GYR (RAD/S)</span>
              <span className="doto-sm" style={{ whiteSpace: 'pre' }}>
                {formatVal(imu.gyr[0])} {formatVal(imu.gyr[1])} {formatVal(imu.gyr[2])}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono-sub dim">ACC (M/S²)</span>
              <span className="doto-sm" style={{ whiteSpace: 'pre' }}>
                {formatVal(imu.acc[0])} {formatVal(imu.acc[1])} {formatVal(imu.acc[2])}
              </span>
            </div>
          </div>
        </>
      )}

      {!isConnected && (
        <div className="imu-disconnected">
          <span className="mono-sub dim">
            {imu.lastUpdate > 0 ? `LOST · last seen ${lastSeen}` : 'NOT DETECTED'}
          </span>
        </div>
      )}
    </div>
  )
}

export function IMUCard({ index }: { index: number }) {
  const snap = useTelemetry()

  return (
    <Card index={index} label="IMU STATUS" tag="LIVE" className="imu-card">
      <ImuSection imuNum={1} imu={snap.imu1} heading={snap.flight.heading} />
      <div className="imu-divider" />
      <ImuSection imuNum={2} imu={snap.imu2} heading={snap.flight.heading} />
    </Card>
  )
}

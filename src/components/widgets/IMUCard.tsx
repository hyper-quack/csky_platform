// CSKY Platform — IMU Card
// Dual-IMU status with ring gauges for roll/pitch

import { Card } from '../Card'
import { useTelemetry, useBootNumber } from '../../system/hooks'

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

export function IMUCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const gyrX = useBootNumber(Math.abs(snap.imu1.gyr[0]), 1)

  return (
    <Card index={index} label="IMU STATUS" tag="SIM" tagAlways className="imu-card">
      <div className="imu-header">
        <span className="mono-sub">IMU1 · {snap.imu1.name}</span>
        <span className={`imu-health ${snap.imu1.health === 'OK' ? 'ok' : 'fail'}`}>
          <span className="led" style={{ width: 6, height: 6 }} /> {snap.imu1.health}
        </span>
      </div>
      <div className="imu-rings">
        <ImuRing value={snap.imu1.roll} label="ROLL" />
        <ImuRing value={snap.imu1.pitch} label="PITCH" />
      </div>
      <div className="imu-gyro">
        <span className="mono-sub dim">GYRO</span>
        <span className="doto-sm">{gyrX}</span>
        <span className="mono-sub dim">DPS</span>
      </div>
      <div className="imu-sub">
        <span className="mono-sub dim">IMU2 · {snap.imu2.name} · {snap.imu2.health}</span>
      </div>
    </Card>
  )
}

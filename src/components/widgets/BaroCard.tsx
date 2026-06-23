// CSKY Platform — Barometer Card (SPL06)
// Pressure, temperature, and pressure-altitude (absolute + launch-relative).

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="mono-sub dim">{label}</span>
      <span className="doto-sm" style={{ whiteSpace: 'pre', fontSize: big ? 18 : undefined }}>
        {value}
      </span>
    </div>
  )
}

export function BaroCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const b = snap.baro
  const live = b.valid && Date.now() - b.lastUpdate < 2000

  return (
    <Card
      index={index}
      label="BARO · SPL06"
      tag="LIVE"
      className="baro-card"
      right={
        <span className={`imu-health ${live ? 'ok' : 'fail'}`}>
          <span className={`led ${live ? '' : 'red'}`} style={{ width: 6, height: 6 }} />
          {live ? 'OK' : 'NO DATA'}
        </span>
      }
    >
      {!live && (
        <div className="imu-disconnected" style={{ padding: '10px 0' }}>
          <span className="mono-sub dim">NOT DETECTED</span>
        </div>
      )}
      {live && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          <Row label="REL ALT" value={`${b.relAltitude >= 0 ? '+' : ''}${b.relAltitude.toFixed(2)} m`} big />
          <Row label="PRESSURE" value={`${b.pressure.toFixed(2)} hPa`} />
          <Row label="ALT (ISA)" value={`${b.altitude.toFixed(1)} m`} />
          <Row label="TEMP" value={`${b.temperature.toFixed(1)} °C`} />
        </div>
      )}
    </Card>
  )
}

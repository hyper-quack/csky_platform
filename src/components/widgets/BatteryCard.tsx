// CSKY Platform — Battery Card
// Adapted from nullframe with drone-specific fields

import { Card } from '../Card'
import { Segbar } from '../Segbar'
import { useTelemetry, useBootNumber } from '../../system/hooks'

export function BatteryCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const pct = Math.round(snap.battery.percent)
  const shown = useBootNumber(pct)

  return (
    <Card index={index} label="BATTERY" tag="LIVE" tagAlways className="battery-card">
      <div className="batt-main">
        <div className="doto-val">
          {shown}<small>%</small>
        </div>
        <div className="batt-details">
          <div className="batt-row">
            <span className="mono-sub dim">Voltage</span>
            <span className="mono-sub">{snap.battery.voltage.toFixed(1)}V</span>
          </div>
          <div className="batt-row">
            <span className="mono-sub dim">Current</span>
            <span className="mono-sub">{snap.battery.current.toFixed(1)}A</span>
          </div>
          <div className="batt-row">
            <span className="mono-sub dim">Capacity</span>
            <span className="mono-sub">{snap.battery.mAh} mAh</span>
          </div>
        </div>
      </div>
      <Segbar total={24} on={Math.round((pct / 100) * 24)} color="green" baseDelay={0.56} />
      <div className="mono-sub" style={{ marginTop: 8 }}>
        {snap.battery.cells}S · {snap.battery.temperature.toFixed(0)}°C
      </div>
    </Card>
  )
}

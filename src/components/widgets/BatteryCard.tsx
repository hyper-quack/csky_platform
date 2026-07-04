// CSKY Platform — Battery Card
// Adapted from nullframe with drone-specific fields.
// Cell count + pack capacity are user-set (persisted) so the charge estimate and
// capacity readout match the actual pack (e.g. 3S 5200mAh).

import { useState } from 'react'
import { Card } from '../Card'
import { Segbar } from '../Segbar'
import { bus } from '../../system/telemetry'
import { useTelemetry, useBootNumber } from '../../system/hooks'

export function BatteryCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const batt = snap.battery
  const pct = Math.round(batt.percent)
  const shown = useBootNumber(pct)
  const [editing, setEditing] = useState(false)

  return (
    <Card index={index} label="BATTERY" tag="LIVE" tagAlways className="battery-card">
      <div className="batt-main">
        <div className="doto-val">
          {shown}<small>%</small>
        </div>
        <div className="batt-details">
          <div className="batt-row">
            <span className="mono-sub dim">Voltage</span>
            <span className="mono-sub">{batt.voltage.toFixed(1)}V</span>
          </div>
          <div className="batt-row">
            <span className="mono-sub dim">Current</span>
            <span className="mono-sub">{batt.current.toFixed(1)}A</span>
          </div>
          <div className="batt-row">
            <span className="mono-sub dim">Capacity</span>
            <span className="mono-sub">{batt.capacity > 0 ? `${batt.capacity} mAh` : '—'}</span>
          </div>
        </div>
      </div>
      <Segbar total={24} on={Math.round((pct / 100) * 24)} color="green" baseDelay={0.56} />
      <div className="batt-foot mono-sub" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {batt.cells}S {batt.cellsConfig === 0 ? '(auto)' : ''} · {batt.temperature.toFixed(0)}°C
        </span>
        <button className="batt-cfg-btn" onClick={() => setEditing(v => !v)}>
          {editing ? 'done' : 'setup'}
        </button>
      </div>

      {editing && (
        <div className="batt-cfg">
          <label className="batt-cfg-row">
            <span className="mono-sub dim">Cells</span>
            <select
              value={batt.cellsConfig}
              onChange={e => bus.setBatteryConfig({ cellsConfig: Number(e.target.value) })}
            >
              <option value={0}>Auto</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}S</option>
              ))}
            </select>
          </label>
          <label className="batt-cfg-row">
            <span className="mono-sub dim">Capacity (mAh)</span>
            <input
              type="number" min={0} max={50000} step={100} value={batt.capacity}
              onChange={e => bus.setBatteryConfig({ capacity: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </Card>
  )
}

// CSKY Platform — Coverage Card

import { Card } from '../Card'
import { Segbar } from '../Segbar'
import { useTelemetry } from '../../system/hooks'

export function CoverageCard({ index }: { index: number }) {
  const snap = useTelemetry()

  return (
    <Card
      index={index}
      label={<><span className="card-icon">◉</span> COVERAGE</>}
      className="coverage-card"
      tag="SIM"
      tagAlways
    >
      <div className="coverage-body">
        <div className="coverage-row">
          <span className="mono-sub dim">Fc</span>
          <Segbar total={14} on={10} color="orange" baseDelay={0.45} />
        </div>
        <div className="coverage-row">
          <span className="mono-sub dim">Longitude</span>
          <span className="mono-sub">{snap.gps.lon.toFixed(4)}</span>
          <span className="mono-sub dim">W</span>
        </div>
        <div className="coverage-row">
          <span className="mono-sub dim">Latitude</span>
          <span className="mono-sub">{snap.gps.lat.toFixed(4)}</span>
          <span className="mono-sub dim">N</span>
        </div>
        <div className="coverage-row">
          <span className="mono-sub dim">Altitude</span>
          <span className="mono-sub">{snap.gps.alt.toFixed(1)}</span>
          <span className="mono-sub dim">M</span>
        </div>
      </div>
    </Card>
  )
}

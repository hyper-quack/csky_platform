// CSKY Platform — Recordings Card

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

export function RecordingsCard({ index }: { index: number }) {
  const snap = useTelemetry()

  return (
    <Card
      index={index}
      label={<><span className="card-icon">⊞</span> RECORDINGS</>}
      right={<span className="mono-sub dim">SN-308</span>}
      className="recordings-card"
      tag="SIM"
      tagAlways
    >
      <div className="recordings-body">
        <div className="rec-row">
          <span className="mono-sub dim">Point Clouds</span>
          <span className="mono-sub">{snap.pointCloudCount.toLocaleString()}</span>
        </div>
        <div className="rec-row">
          <span className="mono-sub dim">Photos</span>
          <span className="mono-sub">—</span>
        </div>
        <div className="rec-row">
          <span className="mono-sub dim">Videos</span>
          <span className="mono-sub">—</span>
        </div>
        <div className="rec-row">
          <span className="mono-sub dim">Pinpoints</span>
          <span className="mono-sub">—</span>
        </div>
      </div>
    </Card>
  )
}

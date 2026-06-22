// CSKY Platform — Camera Card

import { Card } from '../Card'
import { Segbar } from '../Segbar'

export function CameraCard({ index }: { index: number }) {
  return (
    <Card
      index={index}
      label={<><span className="card-icon">◎</span> CAMERA SETUP</>}
      right={<span className="badge action">ACTION</span>}
      className="camera-card"
      tag="SIM"
      tagAlways
    >
      <div className="camera-body">
        <div className="camera-row">
          <span className="mono-sub">Mode</span>
          <div className="toggle-group">
            <span className="tg-option active">Auto</span>
            <span className="tg-option">Manual</span>
          </div>
        </div>
        <div className="camera-row">
          <span className="mono-sub">Lens</span>
          <div className="toggle-group">
            <span className="tg-option">Precision</span>
            <span className="tg-option active">Wide</span>
          </div>
        </div>
        <div className="camera-row">
          <span className="mono-sub">Capture</span>
          <Segbar total={12} on={8} color="orange" baseDelay={0.5} />
        </div>
      </div>
    </Card>
  )
}

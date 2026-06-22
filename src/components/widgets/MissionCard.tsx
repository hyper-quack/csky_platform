// CSKY Platform — Mission Card

import { useEffect, useState } from 'react'
import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const pad = (n: number) => String(n).padStart(2, '0')

export function MissionCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const mm = pad(Math.floor(elapsed / 60))
  const ss = pad(elapsed % 60)

  return (
    <Card
      index={index}
      label={<><span className="card-icon">⬡</span> SCAN - #03</>}
      right={<span className={`badge ${snap.flight.armed ? 'active' : 'standby'}`}>{snap.flight.armed ? 'ACTIVE' : 'STANDBY'}</span>}
      className="mission-card"
      tag="SIM"
      tagAlways
    >
      <div className="mission-body">
        <div className="mission-timer">
          <span className="mono-sub">{mm}:{ss}</span>
          <span className="mono-sub dim">---</span>
          <span className="mono-sub dim">00:00</span>
        </div>
        <div className="mission-controls">
          <button className="ctrl-btn" aria-label="play">▶</button>
          <button className="ctrl-btn" aria-label="pause">⏸</button>
          <button className="ctrl-btn" aria-label="record"><span className="led red" /></button>
          <button className="ctrl-btn" aria-label="stop">⏹</button>
        </div>
        <div className="mono-sub dim" style={{ marginTop: 'auto' }}>
          MODE: {snap.flight.mode}
        </div>
      </div>
    </Card>
  )
}

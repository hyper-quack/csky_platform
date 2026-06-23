// CSKY Platform — RC / ExpressLRS Link Card
// Per-channel bars + link quality from the CRSF receiver.

import { Card } from '../Card'
import { useTelemetry } from '../../system/hooks'

const CH_LABELS = ['A', 'E', 'T', 'R', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']

function ChannelBar({ label, us }: { label: string; us: number }) {
  // 988..2012 µs -> 0..1
  const pct = Math.max(0, Math.min(1, (us - 988) / (2012 - 988)))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="mono-sub dim" style={{ width: 18 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 2, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ width: `${pct * 100}%`, height: '100%', background: '#f26522', borderRadius: 2, opacity: 0.8 }} />
      </div>
      <span className="doto-sm" style={{ width: 38, textAlign: 'right', fontSize: 11 }}>{us}</span>
    </div>
  )
}

export function RcLinkCard({ index }: { index: number }) {
  const snap = useTelemetry()
  const rc = snap.rc
  const live = rc.frames > 0 && Date.now() - rc.lastUpdate < 1000
  const lq = rc.linkQuality
  const lqClass = !live ? 'fail' : lq >= 70 ? 'ok' : lq >= 40 ? 'unknown' : 'fail'

  return (
    <Card
      index={index}
      label="RC · ELRS 900"
      tag="LIVE"
      className="rclink-card"
      right={
        <span className={`imu-health ${lqClass}`}>
          <span className={`led ${live ? '' : 'red'}`} style={{ width: 6, height: 6 }} />
          {live ? `LQ ${lq}%` : 'NO LINK'}
        </span>
      }
    >
      {!live && (
        <div className="imu-disconnected" style={{ padding: '10px 0' }}>
          <span className="mono-sub dim">
            {rc.frames > 0 ? 'LINK LOST — failsafe' : 'WAITING FOR RX'}
          </span>
        </div>
      )}
      {live && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {rc.channels.slice(0, 8).map((us, i) => (
            <ChannelBar key={i} label={CH_LABELS[i]} us={us} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="mono-sub dim">FRAMES</span>
            <span className="doto-sm">{rc.frames}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

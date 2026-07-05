import { useEffect, useRef, useState } from 'react'
import { Card } from '../Card'
import { useTelemetryLog } from '../../system/hooks'
import { isLogPaused, setLogPaused } from '../../system/telemetry'

const pad = (n: number) => String(n).padStart(2, '0')
const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function TelemetryFeed({ index }: { index: number }) {
  const logs = useTelemetryLog() // newest-first buffer (capped at 50)
  const [paused, setPaused] = useState(isLogPaused())

  const scrollRef = useRef<HTMLDivElement>(null)
  // Only auto-scroll to the newest line when the user is already parked at the
  // bottom. Once they scroll up to read history, new lines no longer yank them.
  const atBottomRef = useRef(true)

  // Render oldest→newest so the newest is at the bottom (classic console order).
  const ordered = [...logs].reverse()

  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [logs])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 12
  }

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    setLogPaused(next)
  }

  return (
    <Card
      index={index}
      label="TELEMETRY FEED"
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono-sub dim">CDC · USB</span>
          <button className="feed-toggle-btn" onClick={togglePause} aria-label={paused ? 'resume' : 'pause'}>
            {paused ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <polygon points="1,0 10,5 1,10" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="0" width="3" height="10" />
                <rect x="6" y="0" width="3" height="10" />
              </svg>
            )}
          </button>
        </div>
      }
      className="telem-feed"
    >
      <div className="feed-rows" ref={scrollRef} onScroll={onScroll}>
        {ordered.map(l => (
          <div className="feed-row" key={l.id}>
            <span>{l.msg}</span>
            <span className="dim">{formatTime(l.time)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

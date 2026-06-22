import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Card } from '../Card'
import { useTelemetryLog } from '../../system/hooks'
import { isLogPaused, setLogPaused } from '../../system/telemetry'

type Line = { id: number; msg: string; time: string }

const KEEP = 8

const pad = (n: number) => String(n).padStart(2, '0')
const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function TelemetryFeed({ index }: { index: number }) {
  const realLogs = useTelemetryLog()
  const [lines, setLines] = useState<Line[]>([])
  const [cursorId, setCursorId] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)

  // Use refs to track typing state so React effect cleanup doesn't kill active typing
  const lastIdRef = useRef(-1)
  const typingRef = useRef(false)
  const timerRef = useRef(0)

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    setLogPaused(next)
  }

  useEffect(() => {
    if (realLogs.length === 0) return

    // Find new logs we haven't processed yet
    const pending = realLogs
      .filter(l => l.id > lastIdRef.current)
      .sort((a, b) => a.id - b.id)

    if (pending.length === 0 || typingRef.current) return

    // Process the next log
    const nextLog = pending[0]
    lastIdRef.current = nextLog.id
    typingRef.current = true

    const myId = nextLog.id
    const full = nextLog.msg
    const time = formatTime(nextLog.time)

    setLines(ls => [{ id: myId, msg: '', time }, ...ls].slice(0, KEEP))
    setCursorId(myId)

    let i = 0

    const type = () => {
      i += 4
      const done = i >= full.length
      const text = done ? full : full.slice(0, i)

      setLines(ls => ls.map(l => (l.id === myId ? { ...l, msg: text } : l)))

      if (!done) {
        timerRef.current = window.setTimeout(type, 6)
      } else {
        typingRef.current = false
        setCursorId(null)
        timerRef.current = 0

        // If there are more pending logs, trigger a re-render to process them
        queueMicrotask(() => {
          setCursorId(prev => prev) // no-op state update to trigger effect re-run
        })
      }
    }
    type()

    // Don't return a cleanup that clears the timeout — the typing must survive re-renders
  }, [realLogs, cursorId])

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      typingRef.current = false
    }
  }, [])

  // Sync paused state on mount (in case it was paused before)
  useEffect(() => {
    setPaused(isLogPaused())
  }, [])

  return (
    <Card
      index={index}
      label="TELEMETRY FEED"
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono-sub dim">CDC · USB</span>
          <button className="feed-toggle-btn" onClick={togglePause}>
            {paused ? (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="1,0 10,5 1,10" />
                </svg>
                {/* SCAN */}
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <rect x="1" y="0" width="3" height="10" />
                  <rect x="6" y="0" width="3" height="10" />
                </svg>
                {/* PAUSE */}
              </>
            )}
          </button>
        </div>
      }
      className="telem-feed"
    >
      <div className="feed-rows">
        {lines.map((l, i) => (
          <motion.div
            key={l.id}
            className="feed-row"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: Math.max(0, 1 - i * 0.18), y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span>
              {l.msg}
              {l.id === cursorId && <span className="sq" />}
            </span>
            <span className="dim">{l.time}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

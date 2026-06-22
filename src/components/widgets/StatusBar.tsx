// CSKY Platform — Status Bar
// Top horizontal bar with branding, telemetry summary, and clock

import { useTelemetry } from '../../system/hooks'
import { DRONE_NAME, FIRMWARE_VER } from '../../system/fake'

const pad = (n: number) => String(n).padStart(2, '0')

export function StatusBar() {
  const snap = useTelemetry()
  const d = new Date(snap.timestamp)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const up = Math.floor(snap.uptime)
  const uptime = `${pad(Math.floor(up / 3600))}:${pad(Math.floor((up % 3600) / 60))}:${pad(up % 60)}`

  return (
    <header className="status-bar" id="status-bar">
      <div className="sb-left">
        <div className="sb-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 4L4 12v8l12 8 12-8v-8L16 4z" stroke="#f26522" strokeWidth="1.8" fill="none" />
            <circle cx="16" cy="16" r="3" fill="#f26522" />
            <line x1="16" y1="13" x2="16" y2="6" stroke="#f26522" strokeWidth="1.2" />
            <line x1="16" y1="19" x2="16" y2="26" stroke="#f26522" strokeWidth="1.2" />
            <line x1="13" y1="16" x2="6" y2="16" stroke="#f26522" strokeWidth="1.2" />
            <line x1="19" y1="16" x2="26" y2="16" stroke="#f26522" strokeWidth="1.2" />
          </svg>
          <span className="sb-brand">{DRONE_NAME}</span>
        </div>
        <div className="sb-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>search</span>
        </div>
      </div>
      <div className="sb-center">
        <div className="sb-stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>{snap.gps.satellites}</span>
          <span className="sb-unit">sat</span>
        </div>
        <div className="sb-stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20" />
            <path d="M2 12h20" />
          </svg>
          <span>{snap.flight.heading.toFixed(1)}</span>
          <span className="sb-unit">°</span>
        </div>
        <div className="sb-stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z" />
          </svg>
          <span>{snap.battery.temperature.toFixed(0)}°C</span>
        </div>
      </div>
      <div className="sb-right">
        <span className="sb-fw">{FIRMWARE_VER}</span>
        <span className="sb-uptime">UP {uptime}</span>
        <span className="sb-clock">{time}</span>
      </div>
    </header>
  )
}

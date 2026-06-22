// CSKY Platform — Drone Model
// SVG/CSS drone silhouette that rotates with telemetry

import { useTelemetry } from '../../system/hooks'
import { Segbar } from '../Segbar'
import { DRONE_NAME } from '../../system/fake'

export function DroneModel() {
  const snap = useTelemetry()

  return (
    <div className="drone-model-wrap" id="drone-model">
      <div className="drone-scene">
        <div
          className="drone-body-3d"
          style={{
            transform: `rotateX(${-snap.imu1.pitch * 2}deg) rotateZ(${snap.imu1.roll * 2}deg) rotateY(${snap.flight.heading * 0.5}deg)`,
          }}
        >
          {/* Drone body */}
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="drone-svg">
            {/* Center body */}
            <rect x="48" y="48" width="24" height="24" rx="4" fill="#333" stroke="#555" strokeWidth="1" />

            {/* Arms */}
            <line x1="60" y1="48" x2="60" y2="16" stroke="#444" strokeWidth="3" />
            <line x1="60" y1="72" x2="60" y2="104" stroke="#444" strokeWidth="3" />
            <line x1="48" y1="60" x2="16" y2="60" stroke="#444" strokeWidth="3" />
            <line x1="72" y1="60" x2="104" y2="60" stroke="#444" strokeWidth="3" />

            {/* Motors */}
            <circle cx="60" cy="16" r="12" fill="none" stroke="#f26522" strokeWidth="1" opacity="0.4" />
            <circle cx="60" cy="16" r="3" fill="#f26522" opacity="0.8" />
            <circle cx="60" cy="104" r="12" fill="none" stroke="#f26522" strokeWidth="1" opacity="0.4" />
            <circle cx="60" cy="104" r="3" fill="#f26522" opacity="0.8" />
            <circle cx="16" cy="60" r="12" fill="none" stroke="#f26522" strokeWidth="1" opacity="0.4" />
            <circle cx="16" cy="60" r="3" fill="#f26522" opacity="0.8" />
            <circle cx="104" cy="60" r="12" fill="none" stroke="#f26522" strokeWidth="1" opacity="0.4" />
            <circle cx="104" cy="60" r="3" fill="#f26522" opacity="0.8" />

            {/* Direction indicator */}
            <polygon points="60,42 55,48 65,48" fill="#f26522" />

            {/* Center LED */}
            <circle cx="60" cy="60" r="4" fill="#f26522" className="led" />
          </svg>
        </div>
      </div>
      <div className="drone-info">
        <div className="drone-info-row">
          <span className="mono-sub" style={{ color: '#4a9e5c' }}>■</span>
          <span className="mono-sub">{snap.battery.mAh} / {Math.round(snap.battery.mAh / (snap.battery.percent / 100))} mAh</span>
        </div>
        <div className="drone-info-row">
          <span className="mono-sub dim">{DRONE_NAME}</span>
          <span className="mono-sub dim">{snap.battery.temperature.toFixed(0)}°C</span>
        </div>
        <Segbar total={16} on={Math.round(snap.battery.percent / 100 * 16)} color="green" baseDelay={0.7} />
      </div>
    </div>
  )
}

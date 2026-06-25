// CSKY Platform — ESC / Motor Configuration View
// Replaces the point-cloud viewport. Reads SCKY_ESC_TELEM / SCKY_ESC_CONFIG and
// drives motor tests + ESC configuration over the MAVLink uplink (bus.esc*).

import { useEffect, useState } from 'react'
import { bus } from '../../system/telemetry'
import { useTelemetry } from '../../system/hooks'
import { Toggle } from '../Toggle'

const PROTOCOLS = ['DSHOT150', 'DSHOT300', 'DSHOT600']
const RPM_FULL_SCALE = 30000

// DShot special-command numbers used by the config controls.
const CMD = { beacon: (n: number) => n, spinNormal: 20, spinReversed: 21, mode3dOff: 9, mode3dOn: 10, save: 12 }

type Props = { onClose: () => void }

export function EscConfigView({ onClose }: Props) {
  const snap = useTelemetry()
  const esc = snap.esc
  const cfg = esc.config
  const live = Date.now() - esc.lastTelem < 2000

  // Local editable copy of the scalar config form; synced from the FC echo.
  const [form, setForm] = useState(cfg)
  const [throttles, setThrottles] = useState([0, 0, 0, 0])
  useEffect(() => {
    setForm(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esc.lastConfig])

  // A motor test on the FC auto-expires (3 s default). Re-send active throttles
  // every 500 ms so a held slider keeps the motor spinning instead of cutting out.
  // The FC slews each throttle toward its target (no instant step), so a fast
  // slider drag can't desync the ESC — it ramps up smoothly on the wire.
  useEffect(() => {
    if (!cfg.masterEnabled || throttles.every(t => t === 0)) return
    const id = setInterval(() => {
      throttles.forEach((t, i) => {
        if (t > 0) bus.escMotorTest(i + 1, t, 2)
      })
    }, 500)
    return () => clearInterval(id)
  }, [cfg.masterEnabled, throttles])

  const master = cfg.masterEnabled
  const packV = Math.max(...esc.motors.map(m => m.voltage), 0)
  const packW = packV * esc.totalCurrent

  function setThrottle(i: number, v: number) {
    setThrottles(t => t.map((x, idx) => (idx === i ? v : x)))
    if (master) bus.escMotorTest(i + 1, v, 2)
  }
  function stopAll() {
    setThrottles([0, 0, 0, 0])
    bus.escStopAll()
  }
  function setDirection(motor: number, reversed: boolean) {
    bus.escCommand(motor, reversed ? CMD.spinReversed : CMD.spinNormal)
    bus.escCommand(motor, CMD.save)
  }

  return (
    <div className="esc-view">
      <div className="esc-head">
        <div className="esc-title">
          <span className="esc-dot" data-live={live} />
          ESC / MOTOR CONFIGURATION
        </div>
        <div className="esc-head-right">
          <span className={`esc-master-label ${master ? 'on' : 'off'}`}>
            OUTPUT {master ? 'ARMED' : 'SAFE'}
          </span>
          <Toggle on={master} label="master enable" onChange={v => bus.escSetConfig({ masterEnabled: v })} />
          <button className="esc-close" onClick={onClose} aria-label="back to point cloud">✕</button>
        </div>
      </div>

      {!master && (
        <div className="esc-warn">
          Master output is <b>SAFE</b>. Enable it to arm the ESCs (the FC streams zero-throttle
          to arm them), then run motor tests. Throttle ramps up smoothly on the FC. Keep
          propellers removed on the bench.
        </div>
      )}

      <div className="esc-grid">
        {/* Power */}
        <section className="esc-panel">
          <h3>POWER</h3>
          <div className="esc-stats">
            <Stat label="VOLTAGE" value={packV.toFixed(2)} unit="V" />
            <Stat label="CURRENT" value={esc.totalCurrent.toFixed(2)} unit="A" />
            <Stat label="POWER" value={packW.toFixed(0)} unit="W" />
            <Stat label="CONSUMED" value={esc.mah.toFixed(0)} unit="mAh" />
          </div>
        </section>

        {/* Health */}
        <section className="esc-panel">
          <h3>ESC HEALTH</h3>
          <div className="esc-stats">
            <Stat label="PEAK A" value={esc.peakCurrent.toFixed(1)} unit="A" />
            <Stat label="PEAK °C" value={esc.peakTemp.toFixed(0)} unit="" />
            <Stat label="ERRORS" value={String(esc.motors.reduce((s, m) => s + m.error, 0))} unit="" />
            <Stat label="TELEM" value={live ? 'LIVE' : 'STALE'} unit="" />
          </div>
        </section>

        {/* Motors */}
        <section className="esc-panel esc-span">
          <h3>MOTORS {master ? '' : '(test disabled — output safe)'}</h3>
          <div className="esc-motors">
            {esc.motors.map((m, i) => (
              <div className="esc-motor" key={i}>
                <div className="esc-motor-id">M{i + 1}</div>
                <div className="esc-motor-rpm">
                  <div className="esc-bar"><div style={{ width: `${Math.min(100, (m.rpm / RPM_FULL_SCALE) * 100)}%` }} /></div>
                  <span>{m.rpm} rpm</span>
                </div>
                <div className="esc-motor-vals">
                  <span>{m.voltage.toFixed(1)}V</span>
                  <span>{m.current.toFixed(1)}A</span>
                  <span>{m.temp}°C</span>
                  <span className={m.error ? 'err' : ''}>err {m.error}</span>
                </div>
                <div className="esc-motor-test">
                  <input
                    type="range" min={0} max={100} value={throttles[i]} disabled={!master}
                    onChange={e => setThrottle(i, Number(e.target.value))}
                    onPointerUp={() => setThrottle(i, 0)}
                  />
                  <span className="esc-thr">{throttles[i]}%</span>
                </div>
                <div className="esc-dir">
                  <button
                    className={(cfg.dirMask & (1 << i)) === 0 ? 'active' : ''}
                    disabled={!master} onClick={() => setDirection(i + 1, false)}
                  >NORM</button>
                  <button
                    className={(cfg.dirMask & (1 << i)) !== 0 ? 'active' : ''}
                    disabled={!master} onClick={() => setDirection(i + 1, true)}
                  >REV</button>
                </div>
              </div>
            ))}
          </div>
          <button className="esc-stop" onClick={stopAll}>■ STOP ALL</button>
        </section>

        {/* Configuration */}
        <section className="esc-panel esc-span">
          <h3>ESC CONFIGURATION</h3>
          <div className="esc-form">
            <label>Protocol
              <select value={form.protocol} onChange={e => setForm({ ...form, protocol: Number(e.target.value) })}>
                {PROTOCOLS.map((p, i) => <option key={p} value={i}>{p}</option>)}
              </select>
            </label>
            <label>Refresh (Hz)
              <input type="number" min={50} max={1000} value={form.refreshHz}
                onChange={e => setForm({ ...form, refreshHz: Number(e.target.value) })} />
            </label>
            <label>Pole count
              <input type="number" min={2} max={64} value={form.poleCount}
                onChange={e => setForm({ ...form, poleCount: Number(e.target.value) })} />
            </label>
            <label className="esc-check">
              <input type="checkbox" checked={form.bidir}
                onChange={e => setForm({ ...form, bidir: e.target.checked })} />
              Bidirectional DShot
            </label>
            <label>Current scale
              <input type="number" value={form.curScale}
                onChange={e => setForm({ ...form, curScale: Number(e.target.value) })} />
            </label>
            <label>Current offset (mV)
              <input type="number" value={form.curOffset}
                onChange={e => setForm({ ...form, curOffset: Number(e.target.value) })} />
            </label>
          </div>
          <div className="esc-actions">
            <button className="esc-apply" onClick={() => bus.escSetConfig(form)}>APPLY CONFIG</button>
            <button onClick={() => bus.escCommand(0, CMD.save)}>SAVE TO ESC</button>
            <button onClick={() => bus.escCommand(0, CMD.mode3dOn)} disabled={!master}>3D ON</button>
            <button onClick={() => bus.escCommand(0, CMD.mode3dOff)} disabled={!master}>3D OFF</button>
          </div>
          <div className="esc-beacons">
            <span>Beacon:</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} disabled={!master} onClick={() => bus.escCommand(0, CMD.beacon(n))}>{n}</button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="esc-stat">
      <div className="esc-stat-label">{label}</div>
      <div className="esc-stat-value">{value}<small>{unit}</small></div>
    </div>
  )
}

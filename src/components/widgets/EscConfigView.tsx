// CSKY Platform — ESC / Motor Configuration View (analog PWM ESCs)
// Replaces the point-cloud viewport. Reads SCKY_ESC_TELEM / SCKY_ESC_CONFIG and
// drives motor tests + PWM ESC configuration over the MAVLink uplink (bus.esc*).
//
// The motors are simple analog ESCs (servo PWM only): no signal-wire telemetry,
// no direction/3D/beacon commands. Speed matching is done with per-motor min/max
// pulse calibration; motor order is remapped in software (logical M1..M4 -> a
// physical output PA0..PA3) so the wiring never has to change.

import { useEffect, useState } from 'react'
import { bus } from '../../system/telemetry'
import { useTelemetry } from '../../system/hooks'
import { Toggle } from '../Toggle'

// ESC action codes (SCKY_ESC_CMD.command).
const CMD_CAL_MAX = 1 // hold full throttle so the ESCs record MAX
const CMD_CAL_MIN = 2 // hold idle so the ESCs record MIN
const CMD_STOP_ALL = 3

const PULSE_LO = 800
const PULSE_HI = 2200
const MIN_SPAN = 50 // keep min at least this far below max

type Props = { onClose: () => void }

export function EscConfigView({ onClose }: Props) {
  const snap = useTelemetry()
  const esc = snap.esc
  const cfg = esc.config
  const live = Date.now() - esc.lastTelem < 2000

  // Local editable copy of the config form. `dirty` guards it from being
  // overwritten by the FC's ~1 Hz SCKY_ESC_CONFIG echo while the operator is
  // mid-edit — otherwise fields (and the motor-order dropdowns) snap back before
  // APPLY can be clicked. The echo only re-syncs the form once it is clean again.
  const [form, setForm] = useState(cfg)
  const [dirty, setDirty] = useState(false)
  const [throttles, setThrottles] = useState([0, 0, 0, 0])
  useEffect(() => {
    if (!dirty) setForm(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esc.lastConfig])

  // A motor test on the FC auto-expires (3 s default). Re-send active throttles
  // every 500 ms so a held slider keeps the motor spinning instead of cutting out.
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

  // Pulse width (µs) a given throttle % maps to for motor i, using its calibration.
  const pulseUs = (i: number, pct: number) =>
    Math.round(form.minUs[i] + (pct / 100) * (form.maxUs[i] - form.minUs[i]))

  function setThrottle(i: number, v: number) {
    setThrottles(t => t.map((x, idx) => (idx === i ? v : x)))
    if (master) bus.escMotorTest(i + 1, v, 2)
  }
  function stopAll() {
    setThrottles([0, 0, 0, 0])
    bus.escStopAll()
  }
  // Field editors keep the arrays immutable and mark the form dirty.
  function setMapEntry(i: number, ch: number) {
    setDirty(true)
    setForm(f => ({ ...f, outputMap: f.outputMap.map((x, idx) => (idx === i ? ch : x)) }))
  }
  function setMinUs(i: number, v: number) {
    setDirty(true)
    setForm(f => {
      // min may not cross max (kept MIN_SPAN below it).
      const clamped = Math.max(PULSE_LO, Math.min(v, f.maxUs[i] - MIN_SPAN))
      return { ...f, minUs: f.minUs.map((x, idx) => (idx === i ? clamped : x)) }
    })
  }
  function setMaxUs(i: number, v: number) {
    setDirty(true)
    setForm(f => {
      // max may not drop below min (kept MIN_SPAN above it).
      const clamped = Math.min(PULSE_HI, Math.max(v, f.minUs[i] + MIN_SPAN))
      return { ...f, maxUs: f.maxUs.map((x, idx) => (idx === i ? clamped : x)) }
    })
  }
  function editForm(patch: Partial<typeof form>) {
    setDirty(true)
    setForm(f => ({ ...f, ...patch }))
  }
  function applyConfig() {
    bus.escSetConfig(form)
    setDirty(false)
  }
  function calMax() {
    const ok = window.confirm(
      'Throttle-range calibration — STEP 1 of 2 (MAX):\n\n' +
        'IMPORTANT: the FC must stay powered over USB the whole time — do NOT power\n' +
        'the FC from the same battery you are about to plug into the ESCs, or it\n' +
        'reboots and drops the signal.\n\n' +
        '1. Remove all propellers. Keep the ESC/motor battery UNPLUGGED for now.\n' +
        '2. Press OK — the FC starts holding FULL throttle (2000µs) on every output.\n' +
        '   The FC log will read "ESC CAL MAX out=2000us" — confirm you see it.\n' +
        '3. NOW plug in the ESC battery. The ESCs beep and record MAX.\n\n' +
        'Then click "2 · SET MIN" — the ESCs beep again and record MIN. Proceed?'
    )
    if (ok) bus.escCommand(0, CMD_CAL_MAX)
  }
  function calMin() {
    bus.escCommand(0, CMD_CAL_MIN)
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
          Master output is <b>SAFE</b>. Enable it to arm the ESCs (the FC streams the idle
          pulse to arm them), then run motor tests. Throttle ramps up smoothly on the FC.
          Keep propellers removed on the bench.
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

        {/* Sense — analog ESCs have no signal-wire telemetry; only the FC's own
            analog current sense is live. */}
        <section className="esc-panel">
          <h3>SENSE</h3>
          <div className="esc-stats">
            <Stat label="PEAK A" value={esc.peakCurrent.toFixed(1)} unit="A" />
            <Stat label="PWM" value={String(cfg.pwmHz)} unit="Hz" />
            <Stat label="CURRENT" value={live ? 'LIVE' : 'STALE'} unit="" />
            <Stat label="ESC TELEM" value="N/A" unit="" />
          </div>
        </section>

        {/* Motors — test sliders + per-motor output remap */}
        <section className="esc-panel esc-span">
          <h3>MOTORS {master ? '' : '(test disabled — output safe)'}</h3>
          <div className="esc-motors">
            {[0, 1, 2, 3].map(i => (
              <div className="esc-motor" key={i}>
                <div className="esc-motor-id">M{i + 1}</div>
                <div className="esc-motor-test">
                  <input
                    type="range" min={0} max={100} value={throttles[i]} disabled={!master}
                    onChange={e => setThrottle(i, Number(e.target.value))}
                    onPointerUp={() => setThrottle(i, 0)}
                  />
                  <span className="esc-thr">{throttles[i]}%<small>{pulseUs(i, throttles[i])}µs</small></span>
                </div>
                <label className="esc-map">
                  output
                  <select value={form.outputMap[i]} onChange={e => setMapEntry(i, Number(e.target.value))}>
                    {[0, 1, 2, 3].map(ch => (
                      <option key={ch} value={ch}>PA{ch}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          <button className="esc-stop" onClick={stopAll}>■ STOP ALL</button>
        </section>

        {/* Calibration */}
        <section className="esc-panel esc-span">
          <h3>THROTTLE CALIBRATION (µs)</h3>
          <div className="esc-motors">
            {[0, 1, 2, 3].map(i => (
              <div className="esc-motor" key={i}>
                <div className="esc-motor-id">M{i + 1}</div>
                <label className="esc-map">min
                  <input type="number" min={PULSE_LO} max={PULSE_HI} value={form.minUs[i]}
                    onChange={e => setMinUs(i, Number(e.target.value))} />
                </label>
                <label className="esc-map">max
                  <input type="number" min={PULSE_LO} max={PULSE_HI} value={form.maxUs[i]}
                    onChange={e => setMaxUs(i, Number(e.target.value))} />
                </label>
              </div>
            ))}
          </div>
          <p className="esc-hint">
            Trim each motor's min/max so a shared throttle spins every motor at the same speed
            (min can't cross max). Click <b>APPLY CONFIG</b> below to send. Run the range-teach
            routine once first so the ESCs themselves learn 1000/2000 µs:
          </p>
          <div className="esc-actions">
            <button onClick={calMax}>1 · HOLD MAX</button>
            <button onClick={calMin}>2 · SET MIN</button>
            <button onClick={() => bus.escCommand(0, CMD_STOP_ALL)}>STOP CAL</button>
          </div>
        </section>

        {/* Configuration */}
        <section className="esc-panel esc-span">
          <h3>ESC CONFIGURATION</h3>
          <div className="esc-form">
            <label>PWM refresh (Hz)
              <input type="number" min={50} max={490} value={form.pwmHz}
                onChange={e => editForm({ pwmHz: Number(e.target.value) })} />
            </label>
            <label>Current scale (A/V)
              <input type="number" value={form.curScale}
                onChange={e => editForm({ curScale: Number(e.target.value) })} />
            </label>
            <label>Current offset (mV)
              <input type="number" value={form.curOffset}
                onChange={e => editForm({ curOffset: Number(e.target.value) })} />
            </label>
          </div>
          <div className="esc-actions">
            <button className="esc-apply" onClick={applyConfig}>APPLY CONFIG{dirty ? ' *' : ''}</button>
          </div>
          <p className="esc-hint">
            <b>Current scale</b> converts the ESC/PDB current-sensor voltage into amps
            (amps per volt on the C pad); <b>offset</b> is the sensor's reading at zero current.
            Raise the scale if the reported CURRENT reads low, lower it if it reads high.
            PWM refresh applies on the next FC boot; motor order + calibration apply immediately.
          </p>
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

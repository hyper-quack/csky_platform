// CSKY Platform — Control Test bench (geometric SE(3) controller)
// Replaces the point-cloud viewport, like the ESC view. Simulates the firmware's
// geometric controller + a rigid-body plant in the browser (see system/geosim.ts)
// so each flight-control test case can be run and the drone's *reaction* watched.
// A LIVE mode optionally streams the controller's mixer output to the REAL motors
// (scaled down for bench safety, props off) via the motor-test path. A prominent
// STOP EVERYTHING halts the sim and sends the FC safe-all (stop + master disable).

import { useEffect, useRef, useState } from 'react'
import { bus } from '../../system/telemetry'
import { Toggle } from '../Toggle'
import {
  Controller, defaultGains, defaultParams, hoverThrust, matColumn, mix, norm,
  scenarios, stepPlant, sub, toEuler,
  type MixerGains, type Scenario, type State,
} from '../../system/geosim'

type Props = { onClose: () => void }

const P = defaultParams()
const R2D = 180 / Math.PI
const CASES = scenarios()

export function ControlTestView({ onClose }: Props) {
  const [sel, setSel] = useState<Scenario>(CASES[0])
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [gains, setGains] = useState<MixerGains>(defaultGains())
  // LIVE mode: drive the REAL motors from the running controller, scaled down so
  // they spin slowly on the bench. Off by default (sim only).
  const [live, setLive] = useState(false)
  const [liveScale, setLiveScale] = useState(0.15)
  const [, setTick] = useState(0) // forces readout re-render each frame

  // Simulation lives in refs so the animation loop never churns React state.
  const ctrl = useRef(new Controller(P))
  const state = useRef<State>(sel.init())
  const simT = useRef(0)
  const motors = useRef<number[]>([0, 0, 0, 0])
  const thrust = useRef(0)
  const psi = useRef(0)
  const path = useRef<[number, number][]>([]) // [N, E] history for the map
  const psiHist = useRef<number[]>([])
  const runRef = useRef(running)
  const speedRef = useRef(speed)
  const gainsRef = useRef(gains)
  const selRef = useRef(sel)
  const mapCv = useRef<HTMLCanvasElement>(null)
  const psiCv = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef(live)
  const liveScaleRef = useRef(liveScale)
  const sendingRef = useRef(false) // whether we are currently commanding motors

  useEffect(() => { runRef.current = running }, [running])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { gainsRef.current = gains }, [gains])
  useEffect(() => { liveRef.current = live }, [live])
  useEffect(() => { liveScaleRef.current = liveScale }, [liveScale])

  // LIVE motor output: while enabled AND the sim is running, stream the mixer's
  // per-motor commands to the real ESCs (scaled by `liveScale` for bench safety)
  // over the standard motor-test path. Re-sent at ~8 Hz so the FC's 1 s test
  // watchdog keeps them alive; motors stop within ~1 s once we pause, disable, or
  // unmount. PROPS OFF — this spins real hardware.
  useEffect(() => {
    const id = setInterval(() => {
      const active = liveRef.current && runRef.current
      if (active) {
        const s = liveScaleRef.current
        for (let i = 0; i < 4; i++) {
          const pct = Math.max(0, Math.min(100, motors.current[i] * 100 * s))
          bus.escMotorTest(i + 1, pct, 1)
        }
        sendingRef.current = true
      } else if (sendingRef.current) {
        bus.escStopAll()
        sendingRef.current = false
      }
    }, 120)
    return () => {
      clearInterval(id)
      if (sendingRef.current) {
        bus.escStopAll()
        bus.escSetConfig({ masterEnabled: false })
        sendingRef.current = false
      }
    }
  }, [])

  // Enable/disable live output, with a props-off confirmation on enable.
  function enableLive(on: boolean) {
    if (on) {
      const ok = window.confirm(
        'LIVE MOTOR OUTPUT\n\n' +
          'This spins the REAL motors from the running test case.\n' +
          'REMOVE ALL PROPELLERS first.\n\n' +
          'Start with a low speed scale (≤ 20%). Proceed?'
      )
      if (!ok) return
    }
    setLive(on)
  }

  // Load a scenario: reset the plant, controller and history to its start.
  function load(sc: Scenario, run: boolean) {
    selRef.current = sc
    setSel(sc)
    ctrl.current = new Controller(P)
    state.current = sc.init()
    simT.current = 0
    motors.current = [0, 0, 0, 0]
    thrust.current = 0
    psi.current = 0
    path.current = []
    psiHist.current = []
    setRunning(run)
  }

  function stopEverything() {
    setLive(false)
    setRunning(false)
    sendingRef.current = false
    // Safe the real aircraft too, if one is connected.
    bus.escStopAll()
    bus.escSetConfig({ masterEnabled: false })
  }

  // One fixed control step (mirrors the 100 Hz firmware control loop tick).
  function stepOnce() {
    const sc = selRef.current
    const tgt = sc.target(simT.current)
    const out = ctrl.current.control(state.current, tgt, sc.mode, sc.thrust(P))
    // Collective: throttle stick would drive attitude mode on hardware; here we
    // map the controller thrust to a throttle fraction so the mixer preview is
    // meaningful in every mode.
    const coll = Math.max(0, Math.min(1, (out.f / hoverThrust(P)) * gainsRef.current.hoverThrottle))
    motors.current = mix(coll, out.moment, gainsRef.current)
    thrust.current = out.f
    psi.current = out.psi
    state.current = stepPlant(state.current, out.f, out.moment, P, P.ts)
    simT.current += P.ts
    path.current.push([state.current.p[0], state.current.p[1]])
    if (path.current.length > 2000) path.current.shift()
    psiHist.current.push(out.psi)
    if (psiHist.current.length > 600) psiHist.current.shift()
  }

  // Animation loop: advance the sim in real time (× speed) and redraw.
  useEffect(() => {
    let raf = 0
    let lastT = performance.now()
    let acc = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dtWall = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      if (runRef.current) {
        acc += dtWall * speedRef.current
        let guard = 0
        while (acc >= P.ts && guard++ < 200) {
          stepOnce()
          acc -= P.ts
          if (simT.current >= selRef.current.duration) {
            // Finite demos auto-pause at the end (holding the final state).
            runRef.current = false
            setRunning(false)
            break
          }
        }
      }
      drawMap()
      drawPsi()
      setTick(t => (t + 1) & 0xffff)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function drawMap() {
    const cv = mapCv.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width, H = cv.height
    ctx.clearRect(0, 0, W, H)
    const R = 3.5 // metres half-span
    const toPx = (n: number, e: number): [number, number] => [W / 2 + (e / R) * (W / 2), H / 2 - (n / R) * (H / 2)]
    // Grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let g = -3; g <= 3; g++) {
      const [, y] = toPx(g, 0); const [x] = toPx(0, g)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    // Target.
    const tgt = selRef.current.target(simT.current)
    const [tx, ty] = toPx(tgt.xd[0], tgt.xd[1])
    ctx.strokeStyle = '#f26522'
    ctx.beginPath(); ctx.arc(tx, ty, 7, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(tx - 10, ty); ctx.lineTo(tx + 10, ty); ctx.moveTo(tx, ty - 10); ctx.lineTo(tx, ty + 10); ctx.stroke()
    // Path.
    ctx.strokeStyle = 'rgba(74,158,92,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    path.current.forEach(([n, e], i) => {
      const [x, y] = toPx(n, e)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.stroke()
    // Drone.
    const [dx, dy] = toPx(state.current.p[0], state.current.p[1])
    ctx.fillStyle = '#4a9e5c'
    ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill()
  }

  function drawPsi() {
    const cv = psiCv.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width, H = cv.height
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath(); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke()
    const hist = psiHist.current
    if (hist.length < 2) return
    const maxPsi = 2
    ctx.strokeStyle = '#f26522'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    hist.forEach((p, i) => {
      const x = (i / (hist.length - 1)) * W
      const y = H - Math.min(1, p / maxPsi) * (H - 2)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  // Readout values (recomputed from refs on each render tick).
  const [roll, pitch, yaw] = toEuler(state.current.r).map(a => a * R2D)
  const pos = state.current.p
  const vel = state.current.v
  const posErr = norm(sub(pos, selRef.current.target(simT.current).xd))
  const bodyUp = matColumn(state.current.r, 2) // world-frame body-up axis
  const tiltDeg = Math.acos(Math.max(-1, Math.min(1, bodyUp[2]))) * R2D

  return (
    <div className="esc-view">
      <div className="esc-head">
        <div className="esc-title">
          <span className="esc-dot" data-live={running} />
          CONTROL TEST · GEOMETRIC SE(3)
        </div>
        <div className="esc-head-right">
          <span className={`esc-master-label ${running ? 'on' : 'off'}`}>SIM {running ? 'RUNNING' : 'PAUSED'}</span>
          <button className="esc-close" onClick={onClose} aria-label="back to point cloud">✕</button>
        </div>
      </div>

      <div className="esc-warn">
        In-browser <b>simulation</b> of the firmware controller — no motors move. Pick a
        case, watch the reaction, then use it to sanity-check gains before flying.
        <b> STOP EVERYTHING</b> also safes a connected FC (stop motors + master OFF).
      </div>

      <div className="esc-grid">
        {/* Test cases */}
        <section className="esc-panel">
          <h3>TEST CASES</h3>
          <div className="ctl-cases">
            {CASES.map(sc => (
              <button
                key={sc.id}
                className={`ctl-case ${sc.id === sel.id ? 'active' : ''}`}
                onClick={() => load(sc, true)}
              >
                <span className="ctl-case-name">{sc.name}</span>
                <span className="ctl-case-mode">{sc.mode}</span>
              </button>
            ))}
          </div>
          <p className="esc-hint">{sel.blurb}</p>
          <div className="esc-actions">
            <button onClick={() => setRunning(r => !r)}>{running ? '❚❚ PAUSE' : '▶ RUN'}</button>
            <button onClick={() => load(sel, false)}>↺ RESET</button>
          </div>
          <label className="ctl-speed">speed ×{speed.toFixed(2)}
            <input type="range" min={0.25} max={2} step={0.25} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} />
          </label>
        </section>

        {/* Reaction: attitude + telemetry */}
        <section className="esc-panel">
          <h3>DRONE REACTION</h3>
          <div className="ctl-scene">
            <div
              className="ctl-drone"
              style={{ transform: `rotateX(${(-pitch).toFixed(1)}deg) rotateZ(${(-yaw).toFixed(1)}deg) rotateY(${roll.toFixed(1)}deg)` }}
            >
              <svg width="120" height="120" viewBox="0 0 120 120">
                <rect x="48" y="48" width="24" height="24" rx="4" fill="#333" stroke="#555" />
                <line x1="60" y1="48" x2="60" y2="16" stroke="#f26522" strokeWidth="3" />
                <line x1="60" y1="72" x2="60" y2="104" stroke="#444" strokeWidth="3" />
                <line x1="48" y1="60" x2="16" y2="60" stroke="#444" strokeWidth="3" />
                <line x1="72" y1="60" x2="104" y2="60" stroke="#444" strokeWidth="3" />
                {[[60, 16], [60, 104], [16, 60], [104, 60]].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="9" fill="none" stroke="#f26522" opacity="0.5" />
                ))}
                <polygon points="60,42 55,48 65,48" fill="#f26522" />
              </svg>
            </div>
          </div>
          <div className="esc-stats">
            <Stat label="ROLL" value={roll.toFixed(1)} unit="°" />
            <Stat label="PITCH" value={pitch.toFixed(1)} unit="°" />
            <Stat label="YAW" value={yaw.toFixed(1)} unit="°" />
            <Stat label="TILT" value={tiltDeg.toFixed(1)} unit="°" />
          </div>
        </section>

        {/* Position map */}
        <section className="esc-panel">
          <h3>POSITION (top-down N/E)</h3>
          <canvas ref={mapCv} width={240} height={240} className="ctl-canvas" />
          <div className="esc-stats">
            <Stat label="NORTH" value={pos[0].toFixed(2)} unit="m" />
            <Stat label="EAST" value={pos[1].toFixed(2)} unit="m" />
            <Stat label="UP" value={pos[2].toFixed(2)} unit="m" />
            <Stat label="POS ERR" value={posErr.toFixed(2)} unit="m" />
          </div>
        </section>

        {/* Motors + thrust */}
        <section className="esc-panel">
          <h3>MIXER OUTPUT (M1–M4)</h3>
          <div className="ctl-motors">
            {motors.current.map((m, i) => (
              <div className="ctl-mbar" key={i}>
                <div className="ctl-mbar-track"><div className="ctl-mbar-fill" style={{ height: `${(m * 100).toFixed(0)}%` }} /></div>
                <span className="ctl-mbar-val">{(m * 100).toFixed(0)}</span>
                <span className="ctl-mbar-id">M{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="esc-stats">
            <Stat label="THRUST" value={thrust.current.toFixed(1)} unit="N" />
            <Stat label="HOVER" value={hoverThrust(P).toFixed(1)} unit="N" />
            <Stat label="Ψ ERR" value={psi.current.toFixed(3)} unit="" />
            <Stat label="|v|" value={norm(vel).toFixed(2)} unit="m/s" />
          </div>
        </section>

        {/* Attitude-error history */}
        <section className="esc-panel esc-span">
          <h3>ATTITUDE ERROR Ψ (0 = aligned, 2 = inverted)</h3>
          <canvas ref={psiCv} width={900} height={70} className="ctl-canvas ctl-wide" />
        </section>

        {/* Mixer gains */}
        <section className="esc-panel esc-span">
          <h3>MIXER GAINS (preview only — retune on the airframe)</h3>
          <div className="ctl-gains">
            <GainSlider label="k_roll" value={gains.kRoll} onChange={v => setGains(g => ({ ...g, kRoll: v }))} />
            <GainSlider label="k_pitch" value={gains.kPitch} onChange={v => setGains(g => ({ ...g, kPitch: v }))} />
            <GainSlider label="k_yaw" value={gains.kYaw} onChange={v => setGains(g => ({ ...g, kYaw: v }))} />
            <GainSlider label="hover_throttle" value={gains.hoverThrottle} min={0.2} max={0.8} step={0.01}
              onChange={v => setGains(g => ({ ...g, hoverThrottle: v }))} />
          </div>
          <p className="esc-hint">
            These map the controller's moment/thrust into normalised motor commands, exactly like
            <b> mixer.rs</b> in the firmware. Raise a gain to see that axis' motor spread grow;
            the airmode desaturation keeps every motor within 0–100 %.
          </p>
        </section>

        {/* Live motor output — drives the REAL ESCs from the running controller */}
        <section className="esc-panel esc-span">
          <h3>LIVE MOTOR OUTPUT — REAL ESCs</h3>
          <div className="ctl-live-row">
            <Toggle on={live} label="drive real motors" onChange={enableLive} />
            <span className={`esc-master-label ${live ? 'on' : 'off'}`}>
              {live ? (running ? '● MOTORS LIVE' : 'LIVE (paused)') : 'SIM ONLY'}
            </span>
          </div>
          <label className="ctl-gain ctl-live-scale">
            <span>speed scale</span>
            <input
              type="range" min={0} max={0.5} step={0.01} value={liveScale}
              onChange={e => setLiveScale(Number(e.target.value))}
            />
            <b>{Math.round(liveScale * 100)}%</b>
          </label>
          <p className="esc-hint">
            <b>PROPELLERS OFF.</b> When on, the running test case's mixer output drives the real
            motors through the ESCs, multiplied by <b>speed scale</b> so they spin slowly (full
            output × scale = throttle sent). Keep the scale low on the bench. Pausing, toggling
            off, STOP EVERYTHING, or leaving this view cuts the motors within ~1 s.
          </p>
        </section>

        {/* Safety */}
        <section className="esc-panel esc-span">
          <button className="esc-stop ctl-estop" onClick={stopEverything}>■ STOP EVERYTHING (safe sim + FC)</button>
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

function GainSlider({ label, value, onChange, min = 0, max = 0.1, step = 0.002 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <label className="ctl-gain">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <b>{value.toFixed(3)}</b>
    </label>
  )
}

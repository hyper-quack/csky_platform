// CSKY Platform — Drone Telemetry Bus

import { setMavlinkHandler } from './serial'
import { Heartbeat } from './mavlink/messages/heartbeat'
import { SysStatus } from './mavlink/messages/sys-status'
import { HighresImu } from './mavlink/messages/highres-imu'
import { SckyImuStatus } from './mavlink/messages/scky-imu-status'
import { Attitude } from './mavlink/messages/attitude'
import { VfrHud } from './mavlink/messages/vfr-hud'
import { GpsRawInt } from './mavlink/messages/gps-raw-int'
import { BatteryStatus } from './mavlink/messages/battery-status'
import { RadioStatus } from './mavlink/messages/radio-status'
import { Statustext } from './mavlink/messages/statustext'
import { GlobalPositionInt } from './mavlink/messages/global-position-int'
import { MAVLinkMessage } from './mavlink/node-mavlink-shim'

export type ImuData = {

  acc: [number, number, number]
  gyr: [number, number, number]
  roll: number
  pitch: number
  health: 'OK' | 'FAIL' | 'UNKNOWN'
  whoami: number
  name: string
  lastUpdate: number
  connected: boolean
}

export type BatteryData = {
  voltage: number
  current: number
  mAh: number
  percent: number
  cells: number
  temperature: number
}

export type GpsData = {
  lat: number
  lon: number
  alt: number
  satellites: number
  fix: '3D' | '2D' | 'NONE'
  hdop: number
}

export type RadioData = {
  rssi: number
  noise: number
  signalStrength: number
}

export type FlightData = {
  mode: string
  armed: boolean
  heading: number
  speed: number
  verticalSpeed: number
  altitudeAGL: number
}

export type DroneSnapshot = {
  timestamp: number
  bootAt: number
  uptime: number
  imu1: ImuData
  imu2: ImuData
  battery: BatteryData
  gps: GpsData
  radio: RadioData
  flight: FlightData
  fps: number
  frameMs: number
  pointCloudCount: number
}

type Drawer = (t: number, dt: number) => void

const bootAt = Date.now()

function initImu(): ImuData {
  return {
    acc: [0, 0, 0],
    gyr: [0, 0, 0],
    roll: 0,
    pitch: 0,
    health: 'UNKNOWN',
    whoami: 0,
    name: 'DISCONNECTED',
    lastUpdate: 0,
    connected: false,
  }
}

let snap: DroneSnapshot = {
  timestamp: bootAt,
  bootAt,
  uptime: 0,
  imu1: initImu(),
  imu2: initImu(),
  battery: { voltage: 0, current: 0, mAh: 0, percent: 0, cells: 6, temperature: 0 },
  gps: { lat: 0, lon: 0, alt: 0, satellites: 0, fix: 'NONE', hdop: 99.9 },
  radio: { rssi: 0, noise: 0, signalStrength: 0 },
  flight: { mode: 'UNKNOWN', armed: false, heading: 0, speed: 0, verticalSpeed: 0, altitudeAGL: 0 },
  fps: 60,
  frameMs: 16.7,
  pointCloudCount: 0,
}

const listeners = new Set<() => void>()
const drawers = new Set<Drawer>()
const events = new Map<string, Set<() => void>>()

let running = false
let raf = 0
let last = performance.now()
let fpsEma = 60

// Track whether FC has sent an ATTITUDE message (EKF-fused)
let hasAttitudeMsg = false

// Yaw synthesis integration (fallback when no ATTITUDE message)
let fakeYaw = 0
let lastImuTime = 0

function notify() {
  for (const fn of listeners) fn()
}

function emit(name: string) {
  events.get(name)?.forEach(fn => fn())
}

export type LogEntry = { id: number; msg: string; time: number }
let logId = 0
let logs: LogEntry[] = []
const logListeners = new Set<() => void>()

export const logBus = {
  subscribe(fn: () => void) {
    logListeners.add(fn)
    return () => logListeners.delete(fn)
  },
  get() {
    return logs
  }
}

function pushLog(msg: string) {
  logs = [{ id: logId++, msg, time: Date.now() }, ...logs].slice(0, 50)
  logListeners.forEach(fn => fn())
}

// Watchdog timer to mark IMUs stale if no status for 3 seconds
function checkWatchdogs() {
  const now = Date.now()
  let changed = false
  if (now - snap.imu1.lastUpdate > 3000 && snap.imu1.lastUpdate > 0 && snap.imu1.connected) {
    snap.imu1.health = 'UNKNOWN'
    snap.imu1.name = 'DISCONNECTED'
    snap.imu1.connected = false
    pushLog('[SYS] IMU1 DISCONNECTED (Watchdog)')
    changed = true
  }
  if (now - snap.imu2.lastUpdate > 3000 && snap.imu2.lastUpdate > 0 && snap.imu2.connected) {
    snap.imu2.health = 'UNKNOWN'
    snap.imu2.name = 'DISCONNECTED'
    snap.imu2.connected = false
    pushLog('[SYS] IMU2 DISCONNECTED (Watchdog)')
    changed = true
  }
  if (changed) notify()
}

// Separate rate limiters for different log categories
let lastHeartbeatLogTime = 0
let lastGenericLogTime = 0

// --- 1-second periodic telemetry logger ---
let telemetryLogTimer = 0

function formatSign(v: number, dec = 2): string {
  return (v >= 0 ? '+' : '') + v.toFixed(dec)
}

function periodicTelemetryLog() {
  const s = snap
  const up = Math.floor(s.uptime)

  // IMU line
  const imu1Status = s.imu1.connected ? `${s.imu1.name}(${s.imu1.health})` : 'DISCONNECTED'
  const imu2Status = s.imu2.connected ? `${s.imu2.name}(${s.imu2.health})` : 'DISCONNECTED'
  pushLog(`[HB up=${up}s] IMU1=${imu1Status} IMU2=${imu2Status}`)

  // Attitude line (if we have data)
  if (s.imu1.connected) {
    pushLog(
      `IMU1 roll=${formatSign(s.imu1.roll, 1)} pitch=${formatSign(s.imu1.pitch, 1)} hdg=${s.flight.heading.toFixed(1)}° | ` +
      `gyr=${formatSign(s.imu1.gyr[0])}/${formatSign(s.imu1.gyr[1])}/${formatSign(s.imu1.gyr[2])} rad/s | ` +
      `acc=${formatSign(s.imu1.acc[0])}/${formatSign(s.imu1.acc[1])}/${formatSign(s.imu1.acc[2])} m/s²`
    )
  }

  // GPS line
  if (s.gps.fix !== 'NONE') {
    pushLog(
      `GPS: lat=${s.gps.lat.toFixed(7)} lon=${s.gps.lon.toFixed(7)} alt=${s.gps.alt.toFixed(1)}m sats=${s.gps.satellites} fix=${s.gps.fix} hdop=${s.gps.hdop.toFixed(1)}`
    )
  }

  // Radio line (if we have signal)
  if (s.radio.rssi !== 0 || s.radio.signalStrength !== 0) {
    pushLog(
      `RADIO: rssi=${s.radio.rssi.toFixed(0)}dBm noise=${s.radio.noise.toFixed(0)}dBm signal=${s.radio.signalStrength.toFixed(0)}%`
    )
  }

  // Flight mode line
  pushLog(
    `NAV: mode=${s.flight.mode} armed=${s.flight.armed} spd=${s.flight.speed.toFixed(1)}m/s vspd=${formatSign(s.flight.verticalSpeed, 1)}m/s alt=${s.flight.altitudeAGL.toFixed(0)}m`
  )
}

let logPaused = false

function startPeriodicLog() {
  if (telemetryLogTimer || logPaused) return
  telemetryLogTimer = window.setInterval(periodicTelemetryLog, 1000)
}

function stopPeriodicLog() {
  if (telemetryLogTimer) {
    clearInterval(telemetryLogTimer)
    telemetryLogTimer = 0
  }
}

export function isLogPaused() { return logPaused }

export function setLogPaused(paused: boolean) {
  logPaused = paused
  if (paused) {
    stopPeriodicLog()
    pushLog('[SYS] Telemetry logging PAUSED')
  } else {
    pushLog('[SYS] Telemetry logging RESUMED')
    startPeriodicLog()
  }
}

// Flight mode lookup for ArduPilot custom_mode
const ARDUPILOT_MODES: Record<number, string> = {
  0: 'STABILIZE', 1: 'ACRO', 2: 'ALT_HOLD', 3: 'AUTO',
  4: 'GUIDED', 5: 'LOITER', 6: 'RTL', 7: 'CIRCLE',
  9: 'LAND', 11: 'DRIFT', 13: 'SPORT', 14: 'FLIP',
  15: 'AUTOTUNE', 16: 'POSHOLD', 17: 'BRAKE', 18: 'THROW',
  19: 'AVOID_ADSB', 20: 'GUIDED_NOGPS', 21: 'SMART_RTL',
  22: 'FLOWHOLD', 23: 'FOLLOW', 24: 'ZIGZAG', 25: 'SYSTEMID',
  26: 'AUTOROTATE', 27: 'AUTO_RTL',
}

// Set up MAVLink event listeners
setMavlinkHandler((msg: MAVLinkMessage) => {
  const now = Date.now()
  snap.timestamp = now
  snap.uptime = (now - bootAt) / 1000

  let shouldNotify = false

  if (msg instanceof Heartbeat) {
    snap.flight.armed = (msg.base_mode & 128) !== 0 // MAV_MODE_FLAG_SAFETY_ARMED
    // Decode flight mode from custom_mode (ArduPilot convention)
    const modeNum = msg.custom_mode
    snap.flight.mode = ARDUPILOT_MODES[modeNum] ?? `MODE_${modeNum}`
    shouldNotify = true

    // Start periodic logging on first heartbeat
    startPeriodicLog()

    if (now - lastHeartbeatLogTime > 2000) {
      pushLog(`[SYS] HEARTBEAT | SYS:${msg.system_status} MODE:${snap.flight.mode} ARMED:${snap.flight.armed}`)
      lastHeartbeatLogTime = now
    }
  }
  else if (msg instanceof Attitude) {
    // FC-fused attitude (EKF filtered) — this is the accurate source
    hasAttitudeMsg = true
    snap.imu1.roll = msg.roll * (180 / Math.PI)
    snap.imu1.pitch = msg.pitch * (180 / Math.PI)

    // Yaw from the FC's EKF (proper fused heading)
    let yawDeg = msg.yaw * (180 / Math.PI)
    if (yawDeg < 0) yawDeg += 360
    snap.flight.heading = yawDeg

    shouldNotify = true
  }
  else if (msg instanceof VfrHud) {
    snap.flight.speed = msg.groundspeed
    snap.flight.verticalSpeed = msg.climb
    snap.flight.altitudeAGL = msg.alt
    // VfrHud heading is 0-360 int16
    if (msg.heading >= 0 && msg.heading <= 360) {
      snap.flight.heading = msg.heading
    }
    shouldNotify = true
  }
  else if (msg instanceof SysStatus) {
    // SysStatus provides battery as a fallback (lower resolution than BATTERY_STATUS)
    if (msg.voltage_battery !== 0xFFFF && msg.voltage_battery > 0) {
      snap.battery.voltage = msg.voltage_battery / 1000 // mV to V
    }
    if (msg.current_battery >= 0) {
      snap.battery.current = msg.current_battery / 100 // cA to A
    }
    if (msg.battery_remaining >= 0) {
      snap.battery.percent = msg.battery_remaining
    }
    shouldNotify = true
  }
  else if (msg instanceof BatteryStatus) {
    // More detailed battery info
    if (msg.temperature !== 0x7FFF) { // INT16_MAX = unknown
      snap.battery.temperature = msg.temperature / 100 // cdegC to degC
    }
    if (msg.current_consumed >= 0) {
      snap.battery.mAh = msg.current_consumed
    }
    if (msg.battery_remaining >= 0) {
      snap.battery.percent = msg.battery_remaining
    }
    if (msg.current_battery >= 0) {
      snap.battery.current = msg.current_battery / 100 // cA to A
    }
    // Voltage from voltages array (first cell or aggregate)
    if (msg.voltages && typeof msg.voltages === 'number' && msg.voltages !== 0xFFFF) {
      snap.battery.voltage = msg.voltages / 1000 // mV to V
    }
    shouldNotify = true
  }
  else if (msg instanceof GpsRawInt) {
    snap.gps.lat = msg.lat / 1e7
    snap.gps.lon = msg.lon / 1e7
    snap.gps.alt = msg.alt / 1000 // mm to m
    snap.gps.satellites = msg.satellites_visible
    snap.gps.hdop = msg.eph !== 0xFFFF ? msg.eph / 100 : 99.9
    // GPS fix type: 0-1=no fix, 2=2D, 3+=3D
    if (msg.fix_type >= 3) snap.gps.fix = '3D'
    else if (msg.fix_type === 2) snap.gps.fix = '2D'
    else snap.gps.fix = 'NONE'
    shouldNotify = true
  }
  else if (msg instanceof GlobalPositionInt) {
    // Fused position (more accurate than raw GPS)
    snap.gps.lat = msg.lat / 1e7
    snap.gps.lon = msg.lon / 1e7
    snap.gps.alt = msg.alt / 1000 // mm to m
    snap.flight.altitudeAGL = msg.relative_alt / 1000 // mm to m
    // Ground speed from vx/vy
    const vx = msg.vx / 100 // cm/s to m/s
    const vy = msg.vy / 100
    snap.flight.speed = Math.sqrt(vx * vx + vy * vy)
    snap.flight.verticalSpeed = -(msg.vz / 100) // NED: vz positive = down, we want up = positive
    if (msg.hdg !== 0xFFFF) {
      snap.flight.heading = msg.hdg / 100 // cdeg to deg
    }
    shouldNotify = true
  }
  else if (msg instanceof RadioStatus) {
    // RSSI: SiK radios report 0-254 raw, approx 2x dB scale
    snap.radio.rssi = msg.rssi === 255 ? 0 : -(msg.rssi / 1.9) // rough dBm approximation
    snap.radio.noise = msg.noise === 255 ? 0 : -(msg.noise / 1.9)
    // Signal strength as percentage (0-254 → 0-100%)
    snap.radio.signalStrength = msg.rssi === 255 ? 0 : Math.min(100, (msg.rssi / 254) * 100)
    shouldNotify = true
  }
  else if (msg instanceof HighresImu) {
    // id 0 = IMU1, id 1 = IMU2. Default to 0 if extension field is missing.
    const imuId = msg.id ?? 0
    const target = imuId === 0 ? snap.imu1 : imuId === 1 ? snap.imu2 : null
    if (target) {
      target.acc = [msg.xacc, msg.yacc, msg.zacc]
      target.gyr = [msg.xgyro, msg.ygyro, msg.zgyro]
      target.lastUpdate = now

      // Mark as connected/receiving data even without SCKY_IMU_STATUS
      if (!target.connected) {
        target.connected = true
        target.health = 'OK'
        if (target.name === 'DISCONNECTED') target.name = 'IMU'
        pushLog(`[IMU${imuId + 1}] Receiving HIGHRES_IMU data`)
      }

      // Only compute attitude from accel if FC hasn't sent an ATTITUDE message
      if (!hasAttitudeMsg) {
        const ax = msg.xacc
        const ay = msg.yacc
        const az = msg.zacc

        const rollRad = Math.atan2(ay, az)
        const pitchRad = Math.atan2(-ax, Math.sqrt(ay * ay + az * az))

        target.roll = rollRad * (180 / Math.PI)
        target.pitch = pitchRad * (180 / Math.PI)
      }

      // Synthesize yaw via gyro integration (fallback when no ATTITUDE/VfrHud heading)
      if (imuId === 0 && !hasAttitudeMsg) {
        // Compute actual dt between HIGHRES_IMU messages
        const imuNow = msg.time_usec ? msg.time_usec / 1e6 : now / 1000
        const dt = lastImuTime > 0 ? Math.min(0.1, imuNow - lastImuTime) : 0.02
        lastImuTime = imuNow

        // zgyro is rad/s — integrate and convert to degrees
        fakeYaw = (fakeYaw + msg.zgyro * dt * (180 / Math.PI)) % 360
        if (fakeYaw < 0) fakeYaw += 360
        snap.flight.heading = fakeYaw
      }

      shouldNotify = true
    }
  }
  else if (msg instanceof SckyImuStatus) {
    const target = msg.imu_id === 0 ? snap.imu1 : msg.imu_id === 1 ? snap.imu2 : null
    if (target) {
      const newHealth = msg.healthy ? 'OK' : 'FAIL'
      if (target.health !== newHealth) {
        pushLog(`[IMU${msg.imu_id + 1}] Status changed to ${newHealth}`)
      }
      target.health = newHealth
      target.whoami = msg.whoami
      target.name = msg.whoami === 0x47 ? 'ICM-42688-P' : `0x${msg.whoami.toString(16).toUpperCase()}`
      target.connected = !!msg.connected
      if (!msg.connected) target.name = 'DISCONNECTED'
      target.lastUpdate = now
      shouldNotify = true
    }
  }
  else if (msg instanceof Statustext) {
    // Forward FC status text messages to our log feed
    const sevLabels = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG']
    const sevLabel = sevLabels[msg.severity] ?? `SEV${msg.severity}`
    // text field is parsed as array of uint8 bytes — decode to string
    let text = ''
    if (typeof msg.text === 'string') {
      text = msg.text
    } else if (Array.isArray(msg.text)) {
      text = String.fromCharCode(...(msg.text as number[]).filter(c => c > 0))
    }
    if (text) {
      pushLog(`[FC:${sevLabel}] ${text}`)
    }
    shouldNotify = true
  }
  else if (now - lastGenericLogTime > 2000) {
    // Generic log for unknown/other messages, rate limited
    pushLog(`[MAV] ${msg._message_name || 'UNKNOWN'} received`)
    lastGenericLogTime = now
  }

  if (shouldNotify) {
    notify()
  }
})

setInterval(checkWatchdogs, 1000)

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  if (dt > 0) fpsEma += (1 / Math.max(dt, 1e-4) - fpsEma) * 0.06
  snap.fps = Math.round(fpsEma)
  snap.frameMs = 1000 / Math.max(1, fpsEma)
  for (const d of drawers) d(t / 1000, dt)
}

let autoSweep = false
let sweepTimer = 0

function startSweep() {
  clearInterval(sweepTimer)
  if (autoSweep) {
    sweepTimer = window.setInterval(() => {
      if (!document.hidden) emit('sync')
    }, 45000)
  }
}

function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf)
  } else {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}

export const bus = {
  get: () => snap,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => void listeners.delete(fn)
  },
  draw(fn: Drawer) {
    drawers.add(fn)
    return () => void drawers.delete(fn)
  },
  on(name: 'sync' | 'reroll', fn: () => void) {
    if (!events.has(name)) events.set(name, new Set())
    events.get(name)!.add(fn)
    return () => void events.get(name)!.delete(fn)
  },
  sync: () => emit('sync'),
  reroll: () => emit('reroll'),
  setAutoSweep(v: boolean) {
    autoSweep = v
    startSweep()
    if (v) emit('sync')
  },
  start() {
    if (running) return
    running = true
    document.addEventListener('visibilitychange', onVisibility)
    startSweep()
    last = performance.now()
    raf = requestAnimationFrame(frame)
  },
  stop() {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
    clearInterval(sweepTimer)
    stopPeriodicLog()
    document.removeEventListener('visibilitychange', onVisibility)
  },
}

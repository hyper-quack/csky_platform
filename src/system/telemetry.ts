// CSKY Platform — Drone Telemetry Bus

import { setMavlinkHandler, writeMavlink } from './serial'
import { encodeMavlink2 } from './mavlink/encoder'
import { SckyEscTelem } from './mavlink/messages/scky-esc-telem'
import { SckyEscConfig } from './mavlink/messages/scky-esc-config'
import { SckyEscSet } from './mavlink/messages/scky-esc-set'
import { SckyEscCmd } from './mavlink/messages/scky-esc-cmd'
import { CommandLong } from './mavlink/messages/command-long'
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
import { RcChannels } from './mavlink/messages/rc-channels'
import { DistanceSensor } from './mavlink/messages/distance-sensor'
import { OpticalFlow } from './mavlink/messages/optical-flow'
import { ScaledPressure } from './mavlink/messages/scaled-pressure'
import { LocalPositionNed } from './mavlink/messages/local-position-ned'
import { NamedValueInt } from './mavlink/messages/named-value-int'
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

export type RcData = {
  channels: number[] // µs per channel
  linkQuality: number // 0..100 %
  rssi: number // -dBm
  frames: number // count of RC frames seen
  lastUpdate: number
}

export type NavData = {
  lidarHeight: number // m above ground (lidar)
  lidarValid: boolean
  flowVx: number // m/s, earth frame
  flowVy: number
  flowQuality: number // 0..255
  flowValid: boolean
  lastUpdate: number
}

export type BaroData = {
  pressure: number // hPa
  temperature: number // °C
  altitude: number // m, ISA absolute
  relAltitude: number // m, relative to ground reference captured at connect
  valid: boolean
  lastUpdate: number
}

export type ProximityData = {
  left: number // m, left side obstacle distance
  leftValid: boolean
  right: number // m, right side obstacle distance
  rightValid: boolean
  lastUpdate: number
}

export type EkfData = {
  // Fused local position (m, NED) and velocity (m/s, NED) from the nav EKF.
  x: number // north
  y: number // east
  z: number // down
  vx: number
  vy: number
  vz: number
  converged: boolean // true while LOCAL_POSITION_NED is arriving
  lastUpdate: number
}

export type EscMotor = {
  rpm: number
  voltage: number // V
  current: number // A
  temp: number // °C
  error: number // desync / error count
}

export type EscConfigData = {
  masterEnabled: boolean
  protocol: number // 0=DSHOT150, 1=DSHOT300, 2=DSHOT600
  refreshHz: number
  bidir: boolean
  dirMask: number // bit per motor: 1 = reversed
  mode3dMask: number // bit per motor: 1 = 3D on
  poleCount: number
  curScale: number
  curOffset: number
}

export type EscData = {
  motors: EscMotor[] // length 4
  mah: number // consumed
  totalCurrent: number // A, aggregate
  config: EscConfigData
  lastTelem: number
  lastConfig: number
  // Session peaks for the health panel.
  peakCurrent: number
  peakTemp: number
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
  rc: RcData
  nav: NavData
  baro: BaroData
  proximity: ProximityData
  ekf: EkfData
  esc: EscData
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
  rc: { channels: [], linkQuality: 0, rssi: 0, frames: 0, lastUpdate: 0 },
  nav: { lidarHeight: 0, lidarValid: false, flowVx: 0, flowVy: 0, flowQuality: 0, flowValid: false, lastUpdate: 0 },
  baro: { pressure: 0, temperature: 0, altitude: 0, relAltitude: 0, valid: false, lastUpdate: 0 },
  proximity: { left: 0, leftValid: false, right: 0, rightValid: false, lastUpdate: 0 },
  ekf: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, converged: false, lastUpdate: 0 },
  esc: {
    motors: Array.from({ length: 4 }, () => ({ rpm: 0, voltage: 0, current: 0, temp: 0, error: 0 })),
    mah: 0,
    totalCurrent: 0,
    config: {
      masterEnabled: false,
      protocol: 0,
      refreshHz: 1000,
      bidir: false,
      dirMask: 0,
      mode3dMask: 0,
      poleCount: 14,
      curScale: 490,
      curOffset: 0,
    },
    lastTelem: 0,
    lastConfig: 0,
    peakCurrent: 0,
    peakTemp: 0,
  },
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

// Barometer ground reference (hPa), captured on the first valid reading so the
// UI can show a launch-relative altitude that starts at zero.
let baroGroundHpa = 0

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

  // Proximity / side lidar line — always log so the user can diagnose the sensor
  const liveProx = Date.now() - s.proximity.lastUpdate < 2000
  const lStr = s.proximity.leftValid ? `${s.proximity.left.toFixed(2)}m` : (liveProx ? 'MAX' : 'NO DATA')
  const rStr = s.proximity.rightValid ? `${s.proximity.right.toFixed(2)}m` : (liveProx ? 'MAX' : 'NO DATA')
  pushLog(`PROX: L=${lStr} R=${rStr}${liveProx ? '' : ' (no DISTANCE_SENSOR msgs)'}`)
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
  else if (msg instanceof RcChannels) {
    const raw = [
      msg.chan1_raw, msg.chan2_raw, msg.chan3_raw, msg.chan4_raw,
      msg.chan5_raw, msg.chan6_raw, msg.chan7_raw, msg.chan8_raw,
      msg.chan9_raw, msg.chan10_raw, msg.chan11_raw, msg.chan12_raw,
      msg.chan13_raw, msg.chan14_raw, msg.chan15_raw, msg.chan16_raw,
    ]
    const count = Math.min(msg.chancount || 16, 16)
    snap.rc.channels = raw.slice(0, count).filter(v => v !== 0xFFFF)
    // FC packs CRSF uplink link-quality (0..100 %) into the RSSI byte.
    snap.rc.linkQuality = msg.rssi
    snap.rc.rssi = msg.rssi
    snap.rc.frames++
    snap.rc.lastUpdate = now
    shouldNotify = true
  }
  else if (msg instanceof DistanceSensor) {
    const meters = msg.current_distance / 100
    const inRange =
      msg.current_distance > msg.min_distance && msg.current_distance <= msg.max_distance
    // Route by mounting orientation: 25 = down (AGL), 2 = right, 6 = left.
    if (msg.orientation === 2) {
      snap.proximity.right = meters
      snap.proximity.rightValid = inRange
      snap.proximity.lastUpdate = now
    } else if (msg.orientation === 6) {
      snap.proximity.left = meters
      snap.proximity.leftValid = inRange
      snap.proximity.lastUpdate = now
    } else {
      // Downward lidar height drives the AGL indicator.
      snap.nav.lidarHeight = meters
      snap.nav.lidarValid = inRange
      snap.flight.altitudeAGL = meters
      snap.nav.lastUpdate = now
    }
    shouldNotify = true
  }
  else if (msg instanceof OpticalFlow) {
    snap.nav.flowVx = msg.flow_comp_m_x
    snap.nav.flowVy = msg.flow_comp_m_y
    snap.nav.flowQuality = msg.quality
    snap.nav.flowValid = msg.quality > 0
    if (msg.ground_distance > 0) snap.nav.lidarHeight = msg.ground_distance
    snap.nav.lastUpdate = now
    shouldNotify = true
  }
  else if (msg instanceof ScaledPressure) {
    const hpa = msg.press_abs // already hPa
    snap.baro.pressure = hpa
    snap.baro.temperature = msg.temperature / 100 // centidegrees -> °C
    // ISA barometric formula (hPa form).
    snap.baro.altitude = 44330 * (1 - Math.pow(hpa / 1013.25, 0.190295))
    if (baroGroundHpa === 0 && hpa > 300) baroGroundHpa = hpa
    snap.baro.relAltitude = baroGroundHpa > 0
      ? 44330 * (1 - Math.pow(hpa / baroGroundHpa, 0.190295))
      : 0
    snap.baro.valid = hpa > 300
    snap.baro.lastUpdate = now
    shouldNotify = true
  }
  else if (msg instanceof LocalPositionNed) {
    // Fused EKF solution (only emitted once converged).
    snap.ekf.x = msg.x
    snap.ekf.y = msg.y
    snap.ekf.z = msg.z
    snap.ekf.vx = msg.vx
    snap.ekf.vy = msg.vy
    snap.ekf.vz = msg.vz
    snap.ekf.converged = true
    snap.ekf.lastUpdate = now
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
  else if (msg instanceof NamedValueInt) {
    // T6_* diagnostics from the TF-Luna lidar on USART6 — log at 1 Hz.
    const name: string = typeof msg.name === 'string'
      ? msg.name
      : String.fromCharCode(...(msg.name as unknown as number[]).filter((c: number) => c > 0))
    if (name.startsWith('T6_')) {
      pushLog(`[LIDAR] ${name}=${msg.value}`)
    }
    shouldNotify = true
  }
  else if (msg instanceof SckyEscTelem) {
    const rpm = (msg.rpm as number[]) ?? []
    const cv = (msg.centivolt as number[]) ?? []
    const ca = (msg.centiamp as number[]) ?? []
    const tp = (msg.temperature as number[]) ?? []
    const er = (msg.error_count as number[]) ?? []
    for (let i = 0; i < 4; i++) {
      const m = snap.esc.motors[i]
      m.rpm = rpm[i] ?? 0
      m.voltage = (cv[i] ?? 0) / 100
      m.current = (ca[i] ?? 0) / 100
      m.temp = tp[i] ?? 0
      m.error = er[i] ?? 0
      if (m.current > snap.esc.peakCurrent) snap.esc.peakCurrent = m.current
      if (m.temp > snap.esc.peakTemp) snap.esc.peakTemp = m.temp
    }
    snap.esc.mah = msg.mah_consumed
    snap.esc.totalCurrent = msg.analog_current
    snap.esc.lastTelem = now
    shouldNotify = true
  }
  else if (msg instanceof SckyEscConfig) {
    snap.esc.config = {
      masterEnabled: !!msg.master_enabled,
      protocol: msg.protocol,
      refreshHz: msg.refresh_hz,
      bidir: !!msg.bidir,
      dirMask: msg.dir_mask,
      mode3dMask: msg.mode3d_mask,
      poleCount: msg.pole_count,
      curScale: msg.cur_scale,
      curOffset: msg.cur_offset,
    }
    snap.esc.lastConfig = now
    shouldNotify = true
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
  /** Write the ESC configuration. `patch` overrides fields of the current config. */
  escSetConfig(patch: Partial<EscConfigData>) {
    const c = { ...snap.esc.config, ...patch }
    const m = new SckyEscSet()
    m.cur_scale = c.curScale
    m.cur_offset = c.curOffset
    m.refresh_hz = c.refreshHz
    m.protocol = c.protocol
    m.master_enabled = c.masterEnabled ? 1 : 0
    m.bidir = c.bidir ? 1 : 0
    m.dir_mask = c.dirMask
    m.pole_count = c.poleCount
    m.mode3d_mask = c.mode3dMask
    // Optimistic local update so the UI reflects intent immediately; the FC's
    // SCKY_ESC_CONFIG echo confirms (or corrects) it within ~1 s.
    snap.esc.config = c
    notify()
    void writeMavlink(encodeMavlink2(m))
  },
  /** Spin one motor (1-based) at `throttlePct` (0..100) for `timeoutS` seconds. */
  escMotorTest(motor: number, throttlePct: number, timeoutS = 2) {
    const m = new CommandLong()
    m.target_system = 1
    m.target_component = 1
    m.command = 209 // MAV_CMD_DO_MOTOR_TEST
    m.confirmation = 0
    m.param1 = motor // motor instance (1-based)
    m.param2 = 0 // throttle type: percent
    m.param3 = throttlePct
    m.param4 = timeoutS
    m.param5 = 0 // motor count
    m.param6 = 0
    m.param7 = 0
    void writeMavlink(encodeMavlink2(m))
  },
  /** Stop all motors immediately (motor test at 0% with no timeout window). */
  escStopAll() {
    this.escMotorTest(1, 0, 0)
    this.escMotorTest(2, 0, 0)
    this.escMotorTest(3, 0, 0)
    this.escMotorTest(4, 0, 0)
  },
  /** Send a DShot special command. `target` 0=all, 1..4 = a motor. */
  escCommand(target: number, command: number) {
    const m = new SckyEscCmd()
    m.value = 0
    m.target = target
    m.command = command
    void writeMavlink(encodeMavlink2(m))
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

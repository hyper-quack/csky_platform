// CSKY Platform — Drone Telemetry Bus
// Adapted from Project Nullframe's telemetry system

export type ImuData = {
  acc: [number, number, number]
  gyr: [number, number, number]
  roll: number
  pitch: number
  health: 'OK' | 'FAIL' | 'UNKNOWN'
  whoami: number
  name: string
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

// Simulated state
let simTime = 0
let simHeading = 42
let simRoll = 0
let simPitch = 0
let simAlt = 120
let simSpeed = 4.2
let simBattPct = 87
let simBattV = 22.4
let simSats = 14
let simRssi = -58

function simImu(bias: number): ImuData {
  const t = simTime
  const roll = simRoll + Math.sin(t * 0.7 + bias) * 2.5 + (Math.random() - 0.5) * 0.3
  const pitch = simPitch + Math.sin(t * 0.5 + bias * 2) * 1.8 + (Math.random() - 0.5) * 0.2
  const ax = -Math.sin(pitch * Math.PI / 180) + (Math.random() - 0.5) * 0.01
  const ay = Math.sin(roll * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) + (Math.random() - 0.5) * 0.01
  const az = Math.cos(roll * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) + (Math.random() - 0.5) * 0.01
  return {
    acc: [ax, ay, az],
    gyr: [
      Math.sin(t * 1.2 + bias) * 3.5 + (Math.random() - 0.5) * 0.5,
      Math.sin(t * 0.9 + bias) * 2.8 + (Math.random() - 0.5) * 0.5,
      Math.sin(t * 0.6 + bias) * 1.2 + (Math.random() - 0.5) * 0.3,
    ],
    roll,
    pitch,
    health: 'OK',
    whoami: 0x47,
    name: 'ICM-42688-P',
  }
}

let snap: DroneSnapshot = {
  timestamp: bootAt,
  bootAt,
  uptime: 0,
  imu1: simImu(0),
  imu2: simImu(1),
  battery: { voltage: 22.4, current: 12.3, mAh: 4364, percent: 87, cells: 6, temperature: 36 },
  gps: { lat: 34.05, lon: -118.24, alt: 120, satellites: 14, fix: '3D', hdop: 0.9 },
  radio: { rssi: -58, noise: -95, signalStrength: 82 },
  flight: { mode: 'LOITER', armed: true, heading: 42, speed: 4.2, verticalSpeed: 0.3, altitudeAGL: 120 },
  fps: 60,
  frameMs: 16.7,
  pointCloudCount: 48200,
}

const listeners = new Set<() => void>()
const drawers = new Set<Drawer>()
const events = new Map<string, Set<() => void>>()

let running = false
let raf = 0
let last = 0
let pubAcc = 0
let fpsEma = 60

function notify() {
  for (const fn of listeners) fn()
}

function emit(name: string) {
  events.get(name)?.forEach(fn => fn())
}

function publish() {
  const now = Date.now()
  simTime = (now - bootAt) / 1000
  simHeading = (42 + Math.sin(simTime * 0.15) * 25 + simTime * 1.5) % 360
  simRoll = Math.sin(simTime * 0.7) * 4 + Math.sin(simTime * 1.3) * 1.5
  simPitch = Math.sin(simTime * 0.5) * 3 + Math.sin(simTime * 0.9) * 1
  simAlt = 120 + Math.sin(simTime * 0.2) * 8 + (Math.random() - 0.5) * 0.5
  simSpeed = Math.max(0, 4.2 + Math.sin(simTime * 0.3) * 1.5 + (Math.random() - 0.5) * 0.3)
  simBattPct = Math.max(5, 87 - simTime * 0.02)
  simBattV = 22.4 - (87 - simBattPct) * 0.03
  simSats = Math.round(14 + Math.sin(simTime * 0.1) * 2)
  simRssi = -58 + Math.sin(simTime * 0.4) * 8

  snap = {
    timestamp: now,
    bootAt,
    uptime: simTime,
    imu1: simImu(0),
    imu2: simImu(1),
    battery: {
      voltage: simBattV,
      current: 12.3 + Math.sin(simTime * 0.8) * 2 + (Math.random() - 0.5),
      mAh: Math.round(4364 - simTime * 0.8),
      percent: simBattPct,
      cells: 6,
      temperature: 36 + Math.sin(simTime * 0.15) * 3,
    },
    gps: {
      lat: 34.05 + Math.sin(simTime * 0.05) * 0.001,
      lon: -118.24 + Math.cos(simTime * 0.05) * 0.001,
      alt: simAlt,
      satellites: simSats,
      fix: '3D',
      hdop: 0.9 + Math.sin(simTime * 0.3) * 0.2,
    },
    radio: {
      rssi: simRssi,
      noise: -95 + Math.sin(simTime * 0.6) * 3,
      signalStrength: Math.min(100, Math.max(0, 82 + Math.sin(simTime * 0.4) * 10)),
    },
    flight: {
      mode: 'LOITER',
      armed: true,
      heading: simHeading,
      speed: simSpeed,
      verticalSpeed: Math.sin(simTime * 0.4) * 0.8,
      altitudeAGL: simAlt,
    },
    fps: Math.min(240, Math.round(fpsEma)),
    frameMs: 1000 / Math.max(1, fpsEma),
    pointCloudCount: Math.round(48200 + simTime * 12),
  }
  notify()
}

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  if (dt > 0) fpsEma += (1 / Math.max(dt, 1e-4) - fpsEma) * 0.06
  for (const d of drawers) d(t / 1000, dt)
  pubAcc += dt
  if (pubAcc >= 0.5) {
    pubAcc = 0
    publish()
  }
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
    publish()
  },
  stop() {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
    clearInterval(sweepTimer)
    document.removeEventListener('visibilitychange', onVisibility)
  },
}

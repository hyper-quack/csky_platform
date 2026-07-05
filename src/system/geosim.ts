// CSKY Platform — Geometric controller simulator (browser mirror of scky-control)
//
// A faithful TypeScript port of the firmware's geometric SE(3) tracking
// controller + a rigid-body plant, so the Control Test bench can *simulate the
// drone's reaction* to each test case with no hardware attached. The maths mirrors
// `scky_firmware/control/src/{math,controller,mixer,trajectory,plant}.rs` in the
// same Z-up convention (thrust along +R·e3, gravity −g·e3), so what you see here is
// how the real controller is expected to behave.

// ----------------------------------------------------------------------------
// Tiny linear algebra (Vec3 = [x,y,z], Mat3 = 9 numbers, row-major m[r*3+c]).
// ----------------------------------------------------------------------------
export type V3 = [number, number, number]
export type M3 = number[] // length 9

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z]
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2])

const mId = (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]
const mCols = (c0: V3, c1: V3, c2: V3): M3 => [
  c0[0], c1[0], c2[0],
  c0[1], c1[1], c2[1],
  c0[2], c1[2], c2[2],
]
const mCol = (m: M3, c: number): V3 => [m[c], m[3 + c], m[6 + c]]
const mT = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
const mTrace = (m: M3): number => m[0] + m[4] + m[8]
const mMul = (a: M3, b: M3): M3 => {
  const r = new Array(9).fill(0)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}
const mVec = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]
const mSub = (a: M3, b: M3): M3 => a.map((x, i) => x - b[i])
const hat = (w: V3): M3 => [0, -w[2], w[1], w[2], 0, -w[0], -w[1], w[0], 0]
const vee = (m: M3): V3 => [m[7], m[2], m[3]] // [m(2,1), m(0,2), m(1,0)]

export function so3exp(w: V3): M3 {
  const th = norm(w)
  if (th < 1e-9) return [1, -w[2], w[1], w[2], 1, -w[0], -w[1], w[0], 1]
  const k = scale(w, 1 / th)
  const K = hat(k)
  const s = Math.sin(th)
  const c = 1 - Math.cos(th)
  const KK = mMul(K, K)
  const out = mId()
  for (let i = 0; i < 9; i++) out[i] = out[i] + s * K[i] + c * KK[i]
  return out
}

/** ZYX Euler (roll, pitch, yaw) in radians from a rotation matrix. */
export function toEuler(r: M3): V3 {
  const roll = Math.atan2(r[7], r[8])
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r[6])))
  const yaw = Math.atan2(r[3], r[0])
  return [roll, pitch, yaw]
}

// ----------------------------------------------------------------------------
// Parameters (mirror QuadParams::default — the reference airframe).
// ----------------------------------------------------------------------------
export interface Params {
  gravity: number
  mass: number
  j: V3 // diagonal inertia
  ts: number
  tau: number
  kx: number
  kv: number
  kr: number
  komega: number
  ki: number
  iMax: number
}

export function defaultParams(): Params {
  const mass = 4.34
  return {
    gravity: 9.81,
    mass,
    j: [0.082, 0.0845, 0.1377],
    ts: 0.01,
    tau: 0.05,
    kx: 4.0 * mass,
    kv: 5.6 * mass,
    kr: 8.81,
    komega: 2.54,
    ki: 0.0,
    iMax: 3.0,
  }
}
export const hoverThrust = (p: Params) => p.mass * p.gravity

// ----------------------------------------------------------------------------
// State + target.
// ----------------------------------------------------------------------------
export interface State {
  p: V3
  v: V3
  r: M3
  omega: V3
}
export const levelState = (p: V3 = [0, 0, 0]): State => ({ p, v: [0, 0, 0], r: mId(), omega: [0, 0, 0] })

export type Mode = 'position' | 'velocity' | 'attitude'

export interface Target {
  xd: V3
  xd1: V3
  xd2: V3
  xd3: V3
  xd4: V3
  b1d: V3
  b1d1: V3
  b1d2: V3
  rd: M3
  omegaD: V3
  omegaDdot: V3
}
const Z: V3 = [0, 0, 0]
export function holdPos(xd: V3, yaw = 0): Target {
  return {
    xd, xd1: Z, xd2: Z, xd3: Z, xd4: Z,
    b1d: [Math.cos(yaw), Math.sin(yaw), 0], b1d1: Z, b1d2: Z,
    rd: mId(), omegaD: Z, omegaDdot: Z,
  }
}
export function holdAtt(rd: M3, omegaD: V3 = Z): Target {
  return { ...holdPos([0, 0, 0]), rd, omegaD }
}

// ----------------------------------------------------------------------------
// Dirty derivative (Tustin filtered differentiator).
// ----------------------------------------------------------------------------
class DirtyDerivative {
  private a1: number
  private a2: number
  private dot: V3 = [0, 0, 0]
  private xd1: V3 = [0, 0, 0]
  private it = 1
  constructor(private order: number, tau: number, ts: number) {
    this.a1 = (2 * tau - ts) / (2 * tau + ts)
    this.a2 = 2 / (2 * tau + ts)
  }
  calc(x: V3): V3 {
    if (this.it > this.order) this.dot = add(scale(this.dot, this.a1), scale(sub(x, this.xd1), this.a2))
    this.it++
    this.xd1 = x
    return this.dot
  }
}

// ----------------------------------------------------------------------------
// Geometric controller (Z-up port of controller.rs).
// ----------------------------------------------------------------------------
export interface ControlOut {
  f: number
  moment: V3
  rc: M3
  psi: number
  er: V3
}

export class Controller {
  private dv1: DirtyDerivative
  private dv2: DirtyDerivative
  private ix: V3 = [0, 0, 0]
  constructor(private p: Params) {
    this.dv1 = new DirtyDerivative(1, p.tau, p.ts)
    this.dv2 = new DirtyDerivative(2, p.tau * 10, p.ts)
  }

  control(s: State, t: Target, mode: Mode, thrustOverride: number | null): ControlOut {
    const p = this.p
    const e3: V3 = [0, 0, 1]
    const { p: x, v, r, omega } = s

    const v1 = this.dv1.calc(v)
    const v2 = this.dv2.calc(v1)

    const kx = mode === 'velocity' ? 0 : p.kx
    const ki = mode === 'position' ? p.ki : 0

    const ex = sub(x, t.xd)
    const ev = sub(v, t.xd1)
    const ea = sub(v1, t.xd2)
    const ej = sub(v2, t.xd3)

    if (ki > 0) {
      this.ix = add(this.ix, scale(ex, p.ts)).map(c => Math.max(-p.iMax, Math.min(p.iMax, c))) as V3
    }
    const ix = ki > 0 ? this.ix : Z

    // Z-up: gravity term is +m·g·e3.
    const a = add(
      add(add(scale(ex, -kx), scale(ev, -p.kv)), scale(ix, -ki)),
      add(scale(e3, p.mass * p.gravity), scale(t.xd2, p.mass)),
    )
    const na = Math.max(1e-9, norm(a))
    const na3 = na * na * na
    const na5 = na3 * na * na
    const fPos = dot(a, mVec(r, e3))

    // Z-up: b3c = +a/‖a‖.
    const b3c = scale(a, 1 / na)
    const c = cross(b3c, t.b1d)
    const nc = Math.max(1e-9, norm(c))
    const nc3 = nc * nc * nc
    const nc5 = nc3 * nc * nc
    const b2c = scale(c, 1 / nc)
    const b1c = scale(cross(b3c, c), -1 / nc)

    const a1 = add(add(add(scale(ev, -kx), scale(ea, -p.kv)), scale(ex, -ki)), scale(t.xd3, p.mass))
    const b3c1 = sub(scale(a1, 1 / na), scale(a, dot(a, a1) / na3))
    const c1 = add(cross(b3c1, t.b1d), cross(b3c, t.b1d1))
    const b2c1 = sub(scale(c1, 1 / nc), scale(c, dot(c, c1) / nc3))
    const b1c1 = add(cross(b2c1, b3c), cross(b2c, b3c1))

    const a2 = add(add(add(scale(ea, -kx), scale(ej, -p.kv)), scale(ev, -ki)), scale(t.xd4, p.mass))
    const b3c2 = add(
      sub(sub(scale(a2, 1 / na), scale(a1, (2 / na3) * dot(a, a1))),
        scale(a, (dot(a1, a1) + dot(a, a2)) / na3)),
      scale(a, (3 / na5) * dot(a, a1) * dot(a, a1)),
    )
    const c2 = add(add(cross(b3c2, t.b1d), cross(b3c, t.b1d2)), scale(cross(b3c1, t.b1d1), 2))
    const b2c2 = add(
      sub(sub(scale(c2, 1 / nc), scale(c1, (2 / nc3) * dot(c, c1))),
        scale(c, (dot(c1, c1) + dot(c, c2)) / nc3)),
      scale(c, (3 / nc5) * dot(c, c1) * dot(c, c1)),
    )
    const b1c2 = add(add(cross(b2c2, b3c), cross(b2c, b3c2)), scale(cross(b2c1, b3c1), 2))

    const rc0 = mCols(b1c, b2c, b3c)
    const rc1 = mCols(b1c1, b2c1, b3c1)
    const rc2 = mCols(b1c2, b2c2, b3c2)

    let rc: M3, omegaC: V3, omegaC1: V3, f: number
    if (mode === 'attitude') {
      rc = t.rd
      omegaC = t.omegaD
      omegaC1 = t.omegaDdot
      f = thrustOverride ?? hoverThrust(p)
    } else {
      omegaC = vee(mMul(mT(rc0), rc1))
      omegaC1 = vee(mSub(mMul(mT(rc0), rc2), mMul(hat(omegaC), hat(omegaC))))
      f = thrustOverride ?? fPos
      rc = rc0
    }

    const er = scale(vee(mSub(mMul(mT(rc), r), mMul(mT(r), rc))), 0.5)
    const eOmega = sub(omega, mVec(mMul(mT(r), rc), omegaC))

    const jOmega: V3 = [p.j[0] * omega[0], p.j[1] * omega[1], p.j[2] * omega[2]]
    const ffTerm = sub(mVec(mMul(hat(omega), mMul(mT(r), rc)), omegaC), mVec(mMul(mT(r), rc), omegaC1))
    const jFf: V3 = [p.j[0] * ffTerm[0], p.j[1] * ffTerm[1], p.j[2] * ffTerm[2]]
    const moment = sub(
      add(add(scale(er, -p.kr), scale(eOmega, -p.komega)), cross(omega, jOmega)),
      jFf,
    )

    const psi = 0.5 * mTrace(mSub(mId(), mMul(mT(rc), r)))
    return { f, moment, rc, psi, er }
  }
}

// ----------------------------------------------------------------------------
// Rigid-body plant (Z-up port of plant.rs).
// ----------------------------------------------------------------------------
export function stepPlant(s: State, f: number, moment: V3, p: Params, dt: number, substeps = 10): State {
  const h = dt / substeps
  const e3: V3 = [0, 0, 1]
  const jInv: V3 = [1 / p.j[0], 1 / p.j[1], 1 / p.j[2]]
  let { p: pos, v, r, omega } = s
  for (let n = 0; n < substeps; n++) {
    const acc = add(scale(e3, -p.gravity), scale(mVec(r, e3), f / p.mass))
    const newV = add(v, scale(acc, h))
    const newP = add(pos, scale(newV, h))
    const jOmega: V3 = [p.j[0] * omega[0], p.j[1] * omega[1], p.j[2] * omega[2]]
    const omegaDot: V3 = [
      jInv[0] * (moment[0] - cross(omega, jOmega)[0]),
      jInv[1] * (moment[1] - cross(omega, jOmega)[1]),
      jInv[2] * (moment[2] - cross(omega, jOmega)[2]),
    ]
    const newR = mMul(r, so3exp(scale(omega, h)))
    v = newV
    pos = newP
    r = newR
    omega = add(omega, scale(omegaDot, h))
  }
  return { p: pos, v, r, omega }
}

// ----------------------------------------------------------------------------
// Normalised mixer (Z-up port of mixer.rs). Quad-X sign table, tunable gains.
// ----------------------------------------------------------------------------
const X_SIGNS = [
  [1, -1, 1], // M1 front-right
  [1, 1, -1], // M2 rear-right
  [-1, 1, 1], // M3 rear-left
  [-1, -1, -1], // M4 front-left
]
export interface MixerGains {
  kRoll: number
  kPitch: number
  kYaw: number
  hoverThrottle: number
}
export const defaultGains = (): MixerGains => ({ kRoll: 0.02, kPitch: 0.02, kYaw: 0.02, hoverThrottle: 0.5 })

export function mix(throttle: number, moment: V3, g: MixerGains): number[] {
  const gains = [g.kRoll, g.kPitch, g.kYaw]
  const diff = X_SIGNS.map(s => s[0] * gains[0] * moment[0] + s[1] * gains[1] * moment[1] + s[2] * gains[2] * moment[2])
  let dmin = Math.min(...diff), dmax = Math.max(...diff)
  const span = dmax - dmin
  const d = span > 1 ? diff.map(x => x / span) : diff
  const out = d.map(x => throttle + x)
  const omin = Math.min(...out), omax = Math.max(...out)
  const shift = omax > 1 ? 1 - omax : omin < 0 ? -omin : 0
  return out.map(x => Math.max(0, Math.min(1, x + shift)))
}

// ----------------------------------------------------------------------------
// Test-case scenarios.
// ----------------------------------------------------------------------------
export interface Scenario {
  id: string
  name: string
  mode: Mode
  blurb: string
  duration: number
  init: () => State
  target: (t: number) => Target
  /** null → controller thrust (position/velocity); number → held thrust (attitude). */
  thrust: (p: Params) => number | null
}

const deg = (d: number) => (d * Math.PI) / 180

export function scenarios(): Scenario[] {
  return [
    {
      id: 'hover', name: 'Hover hold', mode: 'position', duration: 4,
      blurb: 'Level at the origin. Should stay put — thrust ≈ m·g, moment ≈ 0.',
      init: () => levelState([0, 0, 0]),
      target: () => holdPos([0, 0, 0]),
      thrust: () => null,
    },
    {
      id: 'roll', name: 'Roll step 25°', mode: 'attitude', duration: 3,
      blurb: 'Command a 25° bank in attitude mode; thrust holds hover. Watch it snap over and settle.',
      init: () => levelState(),
      target: () => holdAtt(so3exp([deg(25), 0, 0])),
      thrust: p => hoverThrust(p),
    },
    {
      id: 'pitch', name: 'Pitch step 25°', mode: 'attitude', duration: 3,
      blurb: 'Command a 25° pitch in attitude mode; thrust holds hover.',
      init: () => levelState(),
      target: () => holdAtt(so3exp([0, deg(25), 0])),
      thrust: p => hoverThrust(p),
    },
    {
      id: 'yawspin', name: 'Yaw spin 90°/s', mode: 'attitude', duration: 4,
      blurb: 'Moving attitude reference: spin about vertical at 90°/s (Ωd ≠ 0). Stays level, tracks the heading.',
      init: () => levelState(),
      target: t => holdAtt(so3exp([0, 0, deg(90) * t]), [0, 0, deg(90)]),
      thrust: p => hoverThrust(p),
    },
    {
      id: 'posN', name: 'Position step 2 m N', mode: 'position', duration: 6,
      blurb: 'Full outer loop: step the setpoint 2 m North. It tilts to accelerate, then levels over the target.',
      init: () => levelState([0, 0, 0]),
      target: () => holdPos([2, 0, 0]),
      thrust: () => null,
    },
    {
      id: 'alt', name: 'Altitude step +1.5 m', mode: 'position', duration: 5,
      blurb: 'Climb 1.5 m and hold. Pure collective — thrust rises then settles back to hover.',
      init: () => levelState([0, 0, 0]),
      target: () => holdPos([0, 0, 1.5]),
      thrust: () => null,
    },
    {
      id: 'flip', name: 'Upside-down recovery', mode: 'position', duration: 8,
      blurb: 'Start inverted (160° roll, off the 180° unstable point). The geometric law recovers decisively.',
      init: () => ({ ...levelState([0, 0, 0]), r: so3exp([deg(160), 0, 0]) }),
      target: () => holdPos([0, 0, 0]),
      thrust: () => null,
    },
    {
      id: 'circle', name: 'Circle 2 m', mode: 'position', duration: 10,
      blurb: 'Track a 2 m circle at 0.6 rad/s with tangent heading and analytic feedforward.',
      init: () => levelState([2, 0, 0]),
      target: t => circleTarget(2, 0.6, 0, t),
      thrust: () => null,
    },
  ]
}

function circleTarget(radius: number, w: number, z0: number, t: number): Target {
  const s = Math.sin(w * t), c = Math.cos(w * t)
  const w2 = w * w, w3 = w2 * w, w4 = w3 * w
  return {
    xd: [radius * c, radius * s, z0],
    xd1: [-radius * w * s, radius * w * c, 0],
    xd2: [-radius * w2 * c, -radius * w2 * s, 0],
    xd3: [radius * w3 * s, -radius * w3 * c, 0],
    xd4: [radius * w4 * c, radius * w4 * s, 0],
    b1d: [-s, c, 0],
    b1d1: [-w * c, -w * s, 0],
    b1d2: [w2 * s, -w2 * c, 0],
    rd: mId(), omegaD: Z, omegaDdot: Z,
  }
}

// Re-export the desired-attitude helper for the viewport ghost.
export { mCol as matColumn }

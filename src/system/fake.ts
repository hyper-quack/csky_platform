// CSKY Platform — Fake / Preview Data

export const DRONE_NAME = 'CSKY-01'
export const FIRMWARE_VER = 'FW.V1.0.3'

export const statusMessages = [
  'SYS NOMINAL · ALL SENSORS GREEN',
  'IMU1 ICM-42688-P · CALIBRATED',
  'GPS 3D FIX · 14 SATS · HDOP 0.9',
  'POINT CLOUD STREAMING · 48K PTS',
  'RADIO LINK STABLE · RSSI -58 DBM',
  'BATTERY 6S · 22.4V · NOMINAL',
  'LIDAR ALIGNMENT · WITHIN SPEC',
]

export const telemetryMessages = [
  'IMU1 OK WHO_AM_I=0x47 | roll=+0.3 pitch=-1.2 deg | gyro r/p/y=+3.2/+1.1/-0.4 dps | acc=+0.01/+0.02/+1.00 g',
  'IMU2 OK WHO_AM_I=0x47 | roll=+0.5 pitch=-1.0 deg | gyro r/p/y=+2.9/+0.8/-0.6 dps | acc=+0.00/+0.03/+0.99 g',
  '[HB up=42s] IMU1=ICM-42688-P(OK) IMU2=ICM-42688-P(OK)',
  'GPS: lat=34.0500 lon=-118.2400 alt=120.3m sats=14 fix=3D hdop=0.9',
  'BATT: 22.4V 12.3A 4364mAh 87% 6S temp=36°C',
  'RADIO: rssi=-58dBm noise=-95dBm signal=82%',
  'LIDAR: 48200 pts/frame rate=10Hz',
  'NAV: heading=042° speed=4.2m/s vspeed=+0.3m/s alt_agl=120m',
  'MODE: LOITER armed=true',
  'CLOUD: buffer=12.4MB upload_rate=2.1MB/s queue=3',
]

export const flightModes = ['STABILIZE', 'LOITER', 'AUTO', 'RTL', 'LAND', 'GUIDED', 'ACRO']

// Generate terrain-like point cloud data for preview
export function generatePointCloud(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  const spread = 50
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2
    const z = (Math.random() - 0.5) * spread * 2
    // Terrain: multi-octave noise approximation
    const y =
      Math.sin(x * 0.15) * 3 +
      Math.cos(z * 0.12) * 2.5 +
      Math.sin((x + z) * 0.08) * 4 +
      Math.cos(x * 0.3) * Math.sin(z * 0.25) * 1.5 +
      (Math.random() - 0.5) * 0.8
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
  }
  return positions
}

// Generate colors based on altitude (y) for point cloud
export function generatePointColors(positions: Float32Array): Float32Array {
  const count = positions.length / 3
  const colors = new Float32Array(count * 3)
  let minY = Infinity, maxY = -Infinity
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1]
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const range = maxY - minY || 1
  for (let i = 0; i < count; i++) {
    const t = (positions[i * 3 + 1] - minY) / range
    // Blue -> Cyan -> Green -> Yellow -> Orange gradient
    if (t < 0.25) {
      const s = t / 0.25
      colors[i * 3] = 0.1
      colors[i * 3 + 1] = 0.2 + s * 0.4
      colors[i * 3 + 2] = 0.6 + s * 0.2
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25
      colors[i * 3] = 0.1 + s * 0.2
      colors[i * 3 + 1] = 0.6 + s * 0.2
      colors[i * 3 + 2] = 0.8 - s * 0.5
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25
      colors[i * 3] = 0.3 + s * 0.5
      colors[i * 3 + 1] = 0.8 - s * 0.2
      colors[i * 3 + 2] = 0.3 - s * 0.15
    } else {
      const s = (t - 0.75) / 0.25
      colors[i * 3] = 0.8 + s * 0.15
      colors[i * 3 + 1] = 0.6 - s * 0.25
      colors[i * 3 + 2] = 0.15 - s * 0.05
    }
  }
  return colors
}

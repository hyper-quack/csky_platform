// CSKY Platform — Point Cloud Viewer
// 3D viewport using Three.js for visualizing drone point cloud data

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { generatePointCloud, generatePointColors } from '../../system/fake'
import { bus } from '../../system/telemetry'

const POINT_COUNT = 50000

function PointCloudMesh() {
  const meshRef = useRef<THREE.Points>(null)

  const { positions, colors } = useMemo(() => {
    const positions = generatePointCloud(POINT_COUNT)
    const colors = generatePointColors(positions)
    return { positions, colors }
  }, [])

  // Subtle animation — rotate slowly and pulse
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02
    }
  })

  const posAttr = useMemo(() => new THREE.BufferAttribute(positions, 3), [positions])
  const colAttr = useMemo(() => new THREE.BufferAttribute(colors, 3), [colors])

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={posAttr} />
        <primitive attach="attributes-color" object={colAttr} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  )
}

function DroneMarker() {
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    const unsub = bus.draw(() => {
      if (!ref.current) return
      const snap = bus.get()
      const t = snap.uptime
      ref.current.position.set(
        Math.sin(t * 0.15) * 15,
        12 + Math.sin(t * 0.4) * 2,
        Math.cos(t * 0.15) * 15
      )
      ref.current.rotation.y = snap.flight.heading * Math.PI / 180
    })
    return unsub
  }, [])

  return (
    <group ref={ref} position={[0, 12, 0]}>
      {/* Drone body */}
      <mesh>
        <boxGeometry args={[0.8, 0.15, 0.8]} />
        <meshBasicMaterial color="#f26522" />
      </mesh>
      {/* Arms */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i * Math.PI / 2) + Math.PI / 4
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0.8, 0, 0]}>
              <boxGeometry args={[0.8, 0.08, 0.08]} />
              <meshBasicMaterial color="#666" />
            </mesh>
            <mesh position={[1.2, 0.1, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
              <meshBasicMaterial color="#f26522" transparent opacity={0.3} wireframe />
            </mesh>
          </group>
        )
      })}
      {/* Downward beam */}
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.05, 2, 10, 8]} />
        <meshBasicMaterial color="#f26522" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

function GridHelper() {
  return (
    <gridHelper args={[100, 50, '#1a1a1a', '#111111']} position={[0, -8, 0]} />
  )
}

export function PointCloudViewer({ onOpenEsc }: { onOpenEsc?: () => void }) {
  return (
    <div className="point-cloud-viewer" id="point-cloud-viewer">
      <div className="pcv-sidebar">
        <button className="pcv-icon" aria-label="esc-config" title="ESC / Motors" onClick={onOpenEsc}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
          </svg>
        </button>
        <button className="pcv-icon" aria-label="fullscreen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
          </svg>
        </button>
        <button className="pcv-icon active" aria-label="overview">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
        <button className="pcv-icon" aria-label="layers">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </button>
        <button className="pcv-icon" aria-label="measure">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 3L3 21M21 3v7M21 3h-7" />
          </svg>
        </button>
        <button className="pcv-icon" aria-label="settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
      <div className="pcv-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        <span>Overview</span>
      </div>
      <Canvas
        camera={{ position: [30, 25, 30], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <PointCloudMesh />
        <DroneMarker />
        <GridHelper />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.5}
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>
      <div className="pcv-toolbar">
        <button className="pcv-tool" aria-label="zoom-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button className="pcv-tool" aria-label="center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button className="pcv-tool" aria-label="lock">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

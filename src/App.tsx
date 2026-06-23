// CSKY Platform — Main App

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { bus } from './system/telemetry'
import { CtlCtx, type Ctl } from './system/hooks'
import { StatusBar } from './components/widgets/StatusBar'
import { MissionCard } from './components/widgets/MissionCard'
import { CameraCard } from './components/widgets/CameraCard'
import { CoverageCard } from './components/widgets/CoverageCard'
import { RecordingsCard } from './components/widgets/RecordingsCard'
import { PointCloudViewer } from './components/widgets/PointCloudViewer'
import { NavigationHUD } from './components/widgets/NavigationHUD'
import { DroneModel } from './components/widgets/DroneModel'
import { IMUCard } from './components/widgets/IMUCard'
import { GpsCompassCard } from './components/widgets/GpsCompassCard'
import { AltFlowCard } from './components/widgets/AltFlowCard'
import { RcLinkCard } from './components/widgets/RcLinkCard'
import { BaroCard } from './components/widgets/BaroCard'
import { BatteryCard } from './components/widgets/BatteryCard'
import { SignalCard } from './components/widgets/SignalCard'
import { AttitudeIndicator } from './components/widgets/AttitudeIndicator'
import { TelemetryFeed } from './components/widgets/TelemetryFeed'
import { CommandPalette } from './components/CommandPalette'

import { ConnectionOverlay } from './components/ConnectionOverlay'

export default function App() {
  const [focus, setFocus] = useState(false)
  const [motionOff, setMotionOff] = useState(false)
  const [autoSweep, setAutoSweepState] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const ctl: Ctl = useMemo(
    () => ({
      focus,
      setFocus,
      motionOff,
      setMotionOff,
      autoSweep,
      setAutoSweep: (v: boolean) => {
        setAutoSweepState(v)
        bus.setAutoSweep(v)
      },
      soundOn,
      setSoundOn,
      paletteOpen,
      setPaletteOpen,
    }),
    [focus, motionOff, autoSweep, soundOn, paletteOpen],
  )

  useEffect(() => {
    if (connected) {
      bus.start()
      return () => bus.stop()
    }
  }, [connected])

  if (!connected) {
    return <ConnectionOverlay onConnected={() => setConnected(true)} />
  }

  return (
    <CtlCtx.Provider value={ctl}>
      <StatusBar />
      <main className={`platform ${focus ? 'focus' : ''} ${motionOff ? 'nofx' : ''}`}>
        {/* Top info cards row */}
        <MissionCard index={0} />
        <CameraCard index={1} />
        <CoverageCard index={2} />
        <RecordingsCard index={3} />

        {/* Drone model + battery (top-right) */}
        <div className="drone-sidebar-area">
          <DroneModel />
        </div>

        {/* Main viewport */}
        <div className="viewport-area">
          <PointCloudViewer />
          <NavigationHUD />
        </div>

        {/* Right sidebar */}
        <div className="sidebar-area">
          <IMUCard index={4} />
          <GpsCompassCard index={5} />
          <AltFlowCard index={6} />
          <BaroCard index={7} />
          <RcLinkCard index={8} />
          <BatteryCard index={9} />
          <SignalCard index={10} />
        </div>

        {/* Side bottom - attitude indicator */}
        <div className="sidebottom-area">
          <AttitudeIndicator />
        </div>

        {/* Bottom feed */}
        <TelemetryFeed index={11} />
      </main>
      <AnimatePresence>{paletteOpen && <CommandPalette />}</AnimatePresence>
    </CtlCtx.Provider>
  )
}

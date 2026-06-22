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
import { BatteryCard } from './components/widgets/BatteryCard'
import { SignalCard } from './components/widgets/SignalCard'
import { AttitudeIndicator } from './components/widgets/AttitudeIndicator'
import { TelemetryFeed } from './components/widgets/TelemetryFeed'
import { CommandPalette } from './components/CommandPalette'

export default function App() {
  const [focus, setFocus] = useState(false)
  const [motionOff, setMotionOff] = useState(false)
  const [autoSweep, setAutoSweepState] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)

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
        <div className="sidebar-area" style={{ gridArea: 'drone' }}>
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
          <BatteryCard index={5} />
          <SignalCard index={6} />
        </div>

        {/* Side bottom - attitude indicator */}
        <div className="sidebottom-area">
          <AttitudeIndicator />
        </div>

        {/* Bottom feed */}
        <TelemetryFeed index={7} />
      </main>
      <AnimatePresence>{paletteOpen && <CommandPalette />}</AnimatePresence>
    </CtlCtx.Provider>
  )
}

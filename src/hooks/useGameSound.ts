import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  getCueAudioStatus, loadPhaseCueSettings, savePhaseCueSettings, setRandomizerVolume,
  stopPhaseCue, stopRandomizerSound, subscribeCueAudioStatus, unlockPhaseCueAudio,
} from '../lib/phaseCueAudio'
import type { PhaseCueSettings } from '../lib/phaseCueAudio'

export default function useGameSound() {
  const [settings, setSettings] = useState(loadPhaseCueSettings)
  const settingsRef = useRef(settings)
  const status = useSyncExternalStore(subscribeCueAudioStatus, getCueAudioStatus)

  useEffect(() => {
    const activate = () => { void unlockPhaseCueAudio() }
    document.addEventListener('pointerdown', activate, { capture: true })
    document.addEventListener('keydown', activate, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', activate, { capture: true })
      document.removeEventListener('keydown', activate, { capture: true })
      stopPhaseCue()
      stopRandomizerSound()
    }
  }, [])

  function changeSettings(next: PhaseCueSettings) {
    settingsRef.current = next
    setSettings(next)
    savePhaseCueSettings(next)
    if (!next.enabled) { stopPhaseCue(); stopRandomizerSound() }
    else setRandomizerVolume(next.volume)
    void unlockPhaseCueAudio()
  }

  return { settings, settingsRef, status, changeSettings }
}

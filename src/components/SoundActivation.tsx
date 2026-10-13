import { unlockPhaseCueAudio } from '../lib/phaseCueAudio'
import type { CueAudioStatus, PhaseCueSettings } from '../lib/phaseCueAudio'

type Props = { settings: PhaseCueSettings; status: CueAudioStatus; onOpenSettings: () => void }

export default function SoundActivation({ settings, status, onOpenSettings }: Props) {
  if (!settings.enabled) return null
  if (settings.volume === 0) return <button className="sound-activation" onClick={onOpenSettings} title="Volume suara 0%. Buka pengaturan untuk menaikkannya.">Volume 0%</button>
  if (status.state === 'ready') return null
  return <button className="sound-activation" aria-label="Aktifkan suara permainan" title={status.message} onClick={() => { void unlockPhaseCueAudio() }}>
    {status.state === 'error' ? 'Coba suara lagi' : 'Aktifkan suara'}
  </button>
}

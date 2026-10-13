import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { PHASE_CUES } from '../lib/phaseCues'
import { getCueAudioStatus, playPhaseCue, playRandomizerSound, subscribeCueAudioStatus, unlockPhaseCueAudio } from '../lib/phaseCueAudio'
import type { PhaseCueSettings as Settings } from '../lib/phaseCueAudio'
import type { TimerId } from '../data/timers'
import { TIMER_CONFIG } from '../data/timers'

type Props = { open: boolean; settings: Settings; onChange: (settings: Settings) => void; onClose: () => void }

export default function PhaseCueSettings({ open, settings, onChange, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState('Coba cue sebelum permainan untuk mengecek suara speaker.')
  const audioStatus = useSyncExternalStore(subscribeCueAudioStatus, getCueAudioStatus)
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current?.close()
  }, [open])

  async function preview(id: TimerId | 'randomizer', title: string) {
    const unlocked = await unlockPhaseCueAudio()
    const played = unlocked && await (id === 'randomizer' ? playRandomizerSound('preview', settings.volume) : playPhaseCue(id, settings.volume))
    setStatus(played ? settings.volume === 0 ? 'Volume suara 0%. Naikkan volume untuk mendengarkan.' : `Memutar cue ${title}.` : getCueAudioStatus().message)
  }

  return <dialog ref={dialog} className="dialog phase-cue-dialog" aria-labelledby="phase-cue-title" onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-card">
      <header className="dialog-header">
        <h2 id="phase-cue-title">Sound cue permainan</h2>
        <button className="close-button" aria-label="Tutup pengaturan suara" onClick={onClose} autoFocus>×</button>
      </header>
      <p className="dialog-description">Suara roulette mengikuti undian. Voiceover fase berbunyi saat timer mulai.</p>
      <label className="phase-cue-toggle"><input type="checkbox" checked={settings.enabled} onChange={event => onChange({ ...settings, enabled: event.target.checked })} /> Suara otomatis aktif</label>
      <label className="phase-cue-volume">Volume <input type="range" min="0" max="100" step="1" value={Math.round(settings.volume * 100)} aria-label="Volume sound cue" onChange={event => onChange({ ...settings, volume: Number(event.target.value) / 100 })} /><output>{Math.round(settings.volume * 100)}%</output></label>
      <div className="phase-cue-list">{PHASE_CUES.map(cue => <button key={cue.id} type="button" className="phase-cue-preview" aria-label={`Coba suara ${cue.title}`} onClick={() => void preview(cue.id, cue.title)}>
        <span className={`phase-cue-mark phase-cue-mark--${cue.id}`} style={{ '--cue-color': TIMER_CONFIG.find(timer => timer.id === cue.id)!.color } as CSSProperties} aria-hidden="true">▶</span>
        <span><strong>{cue.title}</strong><small>{cue.description}</small></span>
      </button>)}<button type="button" className="phase-cue-preview" aria-label="Coba suara Randomizer" onClick={() => void preview('randomizer', 'Randomizer')}>
        <span className="phase-cue-mark phase-cue-mark--randomizer" aria-hidden="true">▶</span>
        <span><strong>Randomizer</strong><small>Roulette, empat hasil, lalu gong penutup</small></span>
      </button></div>
      <p className="phase-cue-status" role="status" aria-live="polite">{settings.volume === 0 ? 'Volume suara 0%. Naikkan volume untuk mendengarkan.' : audioStatus.state !== 'ready' ? audioStatus.message : status}
        {audioStatus.state !== 'ready' && <button className="text-button" onClick={() => { void unlockPhaseCueAudio() }}>Aktifkan suara</button>}
      </p>
    </div>
  </dialog>
}

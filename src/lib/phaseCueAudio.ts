import type { TimerId } from '../data/timers'
import { PHASE_CUES } from './phaseCues'
import { RANDOMIZER_CUES, randomizerPlaybackTiming } from './randomizerCues'
import type { RandomizerCueId } from './randomizerCues'

const settingsKey = 'pindahkan:phase-cues:v1'
let context: AudioContext | null = null
let activation: Promise<boolean> | null = null
let playing: AudioBufferSourceNode | null = null
let generation = 0
let randomizerGeneration = 0
const randomizerPlaying = new Map<AudioBufferSourceNode, GainNode>()
const buffers = new Map<string, Promise<AudioBuffer>>()
export type CueAudioStatus = { state: 'locked' | 'ready' | 'error'; message: string }
let audioStatus: CueAudioStatus = { state: 'locked', message: 'Klik Aktifkan suara untuk mengizinkan audio permainan.' }
const statusListeners = new Set<() => void>()

function updateStatus(state: CueAudioStatus['state'], message: string) {
  if (audioStatus.state === state && audioStatus.message === message) return
  audioStatus = { state, message }
  statusListeners.forEach(listener => listener())
}

export function getCueAudioStatus() { return audioStatus }
export function subscribeCueAudioStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => { statusListeners.delete(listener) }
}

export type PhaseCueSettings = { enabled: boolean; volume: number }

export function loadPhaseCueSettings(): PhaseCueSettings {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey) ?? 'null')
    if (value && typeof value.enabled === 'boolean' && typeof value.volume === 'number' && Number.isFinite(value.volume)) {
      return { enabled: value.enabled, volume: Math.max(0, Math.min(1, value.volume)) }
    }
  } catch { /* Use the defaults if browser storage is unavailable. */ }
  return { enabled: true, volume: .8 }
}

export function savePhaseCueSettings(settings: PhaseCueSettings) {
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)) } catch { /* Settings still work for this session. */ }
}

function bufferFor(file: string, audio: AudioContext): Promise<AudioBuffer> {
  const cached = buffers.get(file)
  if (cached) return cached
  const loading = fetch(`${import.meta.env.BASE_URL}${file}`)
    .then(response => { if (!response.ok) throw new Error('Cue audio unavailable.'); return response.arrayBuffer() })
    .then(data => audio.decodeAudioData(data))
    .catch(error => { buffers.delete(file); throw error })
  buffers.set(file, loading)
  return loading
}

// Call within a click or key event so Safari permits the later automatic cue.
export function unlockPhaseCueAudio(): Promise<boolean> {
  try {
    if (!context || context.state === 'closed') {
      context = new AudioContext()
      context.addEventListener('statechange', () => {
        if (context?.state === 'running') updateStatus('ready', 'Suara aktif.')
        else updateStatus('locked', 'Browser menjeda audio. Klik Aktifkan suara untuk melanjutkan.')
      })
    }
    const audio = context
    void Promise.allSettled([...PHASE_CUES.map(cue => cue.file), ...Object.values(RANDOMIZER_CUES)].map(file => bufferFor(file, audio)))
    if (audio.state === 'running') {
      updateStatus('ready', 'Suara aktif.')
      return Promise.resolve(true)
    }
    // A blocked Safari resume can remain pending; leave the activation button usable.
    activation = new Promise<boolean>(resolve => {
      const timeout = window.setTimeout(() => {
        updateStatus('locked', 'Browser belum mengizinkan audio. Klik Aktifkan suara lagi.')
        resolve(false)
      }, 2000)
      audio.resume().then(() => {
        window.clearTimeout(timeout)
        const running = audio.state === 'running'
        updateStatus(running ? 'ready' : 'locked', running ? 'Suara aktif.' : 'Browser belum mengizinkan audio. Klik Aktifkan suara lagi.')
        resolve(running)
      }).catch(() => {
        window.clearTimeout(timeout)
        updateStatus('locked', 'Browser belum mengizinkan audio. Klik Aktifkan suara lagi.')
        resolve(false)
      })
    })
    return activation
  } catch { updateStatus('error', 'Audio belum tersedia di browser ini. Coba aktifkan suara lagi.'); return Promise.resolve(false) }
}

export function stopPhaseCue() {
  generation++
  try { playing?.stop() } catch { /* The previous cue may already have ended. */ }
  playing = null
}

export async function playPhaseCue(id: TimerId, volume: number, startsAtMs?: number): Promise<boolean> {
  const audio = context
  if (!audio || audio.state === 'closed') return false
  stopPhaseCue()
  stopRandomizerSound()
  const request = generation
  try {
    if (audio.state !== 'running' && (!activation || !await activation)) return false
    if (request !== generation) return false
    const buffer = await bufferFor(PHASE_CUES.find(cue => cue.id === id)!.file, audio)
    if (request !== generation || audio.state !== 'running') return false
    const timing = startsAtMs === undefined ? { delay: 0, offset: 0 } : randomizerPlaybackTiming(buffer.duration, startsAtMs, performance.now())
    if (!timing) return false
    const source = audio.createBufferSource()
    const gain = audio.createGain()
    source.buffer = buffer
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audio.currentTime)
    source.connect(gain).connect(audio.destination)
    source.onended = () => { if (playing === source) playing = null; source.disconnect(); gain.disconnect() }
    playing = source
    source.start(audio.currentTime + timing.delay, timing.offset)
    return true
  } catch {
    if (request === generation) updateStatus('error', 'File suara gagal dimuat. Coba suara lagi untuk mengulang pemuatan.')
    return false
  }
}

export function stopRandomizerSound() {
  randomizerGeneration++
  for (const source of randomizerPlaying.keys()) {
    try { source.stop() } catch { /* Already finished. */ }
  }
  randomizerPlaying.clear()
}

export function setRandomizerVolume(volume: number) {
  if (!context) return
  for (const gain of randomizerPlaying.values()) {
    gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), context.currentTime, .02)
  }
}

export async function playRandomizerSound(id: RandomizerCueId, volume: number, startsAtMs = performance.now(), rate = 1): Promise<boolean> {
  const audio = context
  if (!audio || audio.state === 'closed') return false
  if (id === 'spin' || id === 'preview') {
    stopPhaseCue()
    stopRandomizerSound()
  }
  const request = randomizerGeneration
  try {
    if (audio.state !== 'running' && (!activation || !await activation)) return false
    if (request !== randomizerGeneration) return false
    const buffer = await bufferFor(RANDOMIZER_CUES[id], audio)
    if (request !== randomizerGeneration || audio.state !== 'running') return false
    const timing = randomizerPlaybackTiming(buffer.duration / rate, startsAtMs, performance.now())
    if (!timing) return false
    const source = audio.createBufferSource()
    const gain = audio.createGain()
    source.buffer = buffer
    source.playbackRate.value = rate
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audio.currentTime)
    source.connect(gain).connect(audio.destination)
    source.onended = () => { randomizerPlaying.delete(source); source.disconnect(); gain.disconnect() }
    randomizerPlaying.set(source, gain)
    source.start(audio.currentTime + timing.delay, timing.offset * rate)
    return true
  } catch {
    if (request === randomizerGeneration) updateStatus('error', 'File suara randomizer gagal dimuat. Coba suara lagi untuk mengulang pemuatan.')
    return false
  }
}

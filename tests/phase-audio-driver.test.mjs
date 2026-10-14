import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

async function fixture(t, { delayVoice = false, blockedResume = false } = {}) {
  const original = { AudioContext: globalThis.AudioContext, fetch: globalThis.fetch, performance: globalThis.performance, window: globalThis.window }
  let now = 0, releaseVoice
  let timerId = 0
  const timers = new Map(), resumes = []
  const deferred = new Promise(resolve => { releaseVoice = resolve })
  const sources = [], gains = [], contexts = []
  class Param {
    value = 1
    events = []
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]) }
    setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]) }
    cancelScheduledValues(time) { this.events.push(['cancel', time]) }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]) }
  }
  class Audio {
    constructor() { contexts.push(this) }
    state = blockedResume ? 'suspended' : 'running'
    destination = {}
    listeners = []
    get currentTime() { return now / 1000 }
    addEventListener(_, listener) { this.listeners.push(listener) }
    changeState(state) { this.state = state; this.listeners.forEach(listener => listener()) }
    resume() { return blockedResume ? new Promise((resolve, reject) => resumes.push({ resolve, reject })) : Promise.resolve() }
    async decodeAudioData(data) { return { duration: (data.byteLength - 44) / (44100 * 4) } }
    createBufferSource() {
      const source = { playbackRate: new Param(), stops: [],
        connect(gain) { this.gain = gain; return gain }, disconnect() {},
        start(when, offset) { this.startTime = when; this.offset = offset },
        stop(...args) { this.stops.push(args) } }
      sources.push(source); return source
    }
    createGain() {
      const gain = { gain: new Param(), connect() { return this }, disconnect() {} }
      gains.push(gain); return gain
    }
  }
  Object.assign(globalThis, { AudioContext: Audio, performance: { now: () => now },
    window: { setTimeout: callback => { timers.set(++timerId, callback); return timerId }, clearTimeout: id => timers.delete(id) }, fetch: async file => {
    if (delayVoice && file.endsWith('/terawang.wav')) await deferred
    return new Response(readFileSync(new URL('../public' + file, import.meta.url)))
  } })
  t.after(() => { Object.assign(globalThis, original) })
  const audio = await import(new URL(`../src/lib/phaseCueAudio.ts?test=${Math.random()}`, import.meta.url))
  const firstActivation = audio.unlockPhaseCueAudio()
  if (!blockedResume) await firstActivation
  return { audio, sources, gains, contexts, firstActivation, resumes,
    flushTimers: () => { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(task => task()) },
    setNow: value => { now = value }, releaseVoice }
}

test('queuing Terawang preserves the spin and closing gong until their scheduled end', async t => {
  const f = await fixture(t)
  await f.audio.playRandomizerSound('spin', .8, 120)
  await f.audio.playRandomizerSound('complete', .8, 5460)
  await f.audio.playPhaseCue('terawang', .8, 7460, { preserveRandomizer: true, alignVoice: true })
  assert.equal(f.sources.length, 3)
  const [spin, closing, phase] = f.sources
  assert.equal(spin.startTime, .12)
  assert.equal(closing.startTime, 5.46)
  assert.equal(phase.startTime, 6.98)
  assert(Math.abs(phase.startTime + .48 - 7.46) < 1e-9, 'the first words align with the phase boundary')
  assert.equal(phase.offset, 0)
  assert(closing.startTime + closing.buffer.duration < phase.startTime)
  assert(phase.startTime - (closing.startTime + closing.buffer.duration) < .15, 'the chime follows the closing gong smoothly')
  assert(f.sources.every(source => source.stops.length === 0))
})

test('all late phase voiceovers play from the beginning rather than cutting their first words', async t => {
  const f = await fixture(t)
  f.setNow(2800)
  for (const id of ['terawang', 'discussion', 'movement']) {
    assert.equal(await f.audio.playPhaseCue(id, .8, 2000), true)
    assert.equal(f.sources.at(-1).offset, 0)
    assert.equal(f.sources.at(-1).startTime, 2.8)
  }
})

test('replacing a playing sound fades its gain while cancelling a future voice immediately', async t => {
  const f = await fixture(t)
  await f.audio.playPhaseCue('terawang', .8)
  f.audio.stopPhaseCue()
  assert.deepEqual(f.sources[0].stops, [[.035]])
  assert.deepEqual(f.sources[0].gain.gain.events.at(-1), ['ramp', 0, .035])
  await f.audio.playPhaseCue('discussion', .8, 2000)
  f.audio.stopPhaseCue()
  assert.deepEqual(f.sources[1].stops, [[]])
})

test('cancelling an announcement during loading cannot let stale voice audio start later', async t => {
  const f = await fixture(t, { delayVoice: true })
  const playing = f.audio.playPhaseCue('terawang', .8, 2000, { preserveRandomizer: true })
  f.audio.stopPhaseCue()
  f.releaseVoice()
  assert.equal(await playing, false)
  assert.equal(f.sources.length, 0)
})

test('live volume changes affect both the queued announcement and randomizer sounds', async t => {
  const f = await fixture(t)
  await f.audio.playRandomizerSound('complete', .8, 5460)
  await f.audio.playPhaseCue('terawang', .8, 7460, { preserveRandomizer: true })
  f.audio.setCueVolume(.35)
  assert(f.gains.every(gain => gain.gain.events.at(-1)[0] === 'target' && gain.gain.value === .35))
})

test('browser suspension cancels frozen-clock audio instead of playing an old queue after resume', async t => {
  const f = await fixture(t)
  await f.audio.playRandomizerSound('complete', .8, 5460)
  await f.audio.playPhaseCue('terawang', .8, 7460, { preserveRandomizer: true })
  f.contexts[0].changeState('suspended')
  assert.equal(f.audio.getCueAudioStatus().state, 'locked')
  assert(f.sources.every(source => source.stops.length === 1))
  f.setNow(12_000)
  f.contexts[0].changeState('running')
  assert.equal(f.audio.getCueAudioStatus().state, 'ready')
  assert.equal(f.sources.length, 2, 'resuming cannot revive cancelled sources')
})

test('an older permission timeout cannot relock audio after a later activation succeeded', async t => {
  const f = await fixture(t, { blockedResume: true })
  f.contexts[0].changeState('running')
  assert.equal(await f.audio.unlockPhaseCueAudio(), true)
  f.flushTimers()
  assert.equal(await f.firstActivation, false, 'a superseded activation must not revive an older preview')
  assert.equal(f.audio.getCueAudioStatus().state, 'ready')
})

test('a delayed permission rejection cannot override the newest audio activation', async t => {
  const f = await fixture(t, { blockedResume: true })
  f.contexts[0].changeState('running')
  assert.equal(await f.audio.unlockPhaseCueAudio(), true)
  f.resumes[0].reject(new Error('permission response arrived late'))
  assert.equal(await f.firstActivation, false)
  assert.equal(f.audio.getCueAudioStatus().state, 'ready')
})

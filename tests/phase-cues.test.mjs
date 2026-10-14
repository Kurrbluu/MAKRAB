import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHASE_CUES, createPhaseCueTracker, observePhaseCue } from '../src/lib/phaseCues.ts'

test('the three cues map the supplied voice filenames to Terawang, discussion and Exchange', () => {
  assert.deepEqual(PHASE_CUES.map(cue => [cue.id, cue.file]), [
    ['terawang', 'audio/phase-cues/terawang.wav'],
    ['discussion', 'audio/phase-cues/discussion.wav'],
    ['movement', 'audio/phase-cues/exchange.wav'],
  ])
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/phase-cues/manifest.json', import.meta.url)))
  assert.deepEqual(manifest.cues.map(cue => cue.voiceSource), ['Fase Terawang.wav', 'Fase Diskusi.wav', 'Fase perpindahan.wav'])
  assert.deepEqual(PHASE_CUES.map(cue => cue.voiceStartMs), manifest.cues.map(cue => cue.voiceStartSeconds * 1000))
})

test('the phase announcement waits through roulette and its result hold until the first countdown actually starts', () => {
  let tracker = createPhaseCueTracker(0)
  for (let frame = 0; frame < 100; frame++) {
    const result = observePhaseCue(tracker, 0, false)
    assert.equal(result.play, false)
    tracker = result.tracker
  }
  const started = observePhaseCue(tracker, 0, true)
  assert.equal(started.play, true)
  assert.equal(observePhaseCue(started.tracker, 0, true).play, false)
})

test('pause, resume, resetting the same phase and roulette replay do not repeat the cue', () => {
  let tracker = observePhaseCue(createPhaseCueTracker(0), 0, true).tracker
  for (const running of [true, false, false, true, false, true]) {
    const result = observePhaseCue(tracker, 0, running)
    assert.equal(result.play, false)
    tracker = result.tracker
  }
})

test('a selected preview waits for Play while a started new phase cues exactly once', () => {
  const first = observePhaseCue(createPhaseCueTracker(0), 0, true).tracker
  const preview = observePhaseCue(first, 1, false)
  assert.equal(preview.play, false)
  assert.equal(observePhaseCue(preview.tracker, 1, true).play, true)
})

test('consecutive Gambler and ordinary Exchanges each announce despite sharing a timer type', () => {
  const gamblers = observePhaseCue(createPhaseCueTracker(5), 5, true)
  const ordinary = observePhaseCue(gamblers.tracker, 6, true)
  assert.equal(gamblers.play, true)
  assert.equal(ordinary.play, true)
  assert.equal(observePhaseCue(ordinary.tracker, 6, true).play, false)
})

test('a restored running clock stays silent; a new game can announce its first phase again', () => {
  const resumed = createPhaseCueTracker(0, true)
  assert.equal(observePhaseCue(resumed, 0, true).play, false)
  assert.equal(observePhaseCue(createPhaseCueTracker(0), 0, true).play, true)
})

test('each generated cue is short, stereo PCM16 WAV with no clipped samples', () => {
  for (const cue of PHASE_CUES) {
    const data = readFileSync(new URL('../public/' + cue.file, import.meta.url))
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WAVE')
    assert.equal(data.readUInt16LE(20), 1)
    assert.equal(data.readUInt16LE(22), 2)
    assert.equal(data.readUInt32LE(24), 44100)
    assert.equal(data.readUInt16LE(34), 16)
    const duration = (data.length - 44) / (44100 * 2 * 2)
    assert(duration >= 2 && duration <= 3.1)
    let peak = 0
    for (let offset = 44; offset < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)))
    assert(peak > 20_000 && peak < 25_000)
  }
})

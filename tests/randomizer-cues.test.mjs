import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EXCHANGE_PRESENTATION, EXCHANGE_REVEAL_ORDER, rouletteProgress } from '../src/lib/exchangePresentation.ts'
import { RANDOMIZER_CUES, randomizerPlaybackTiming } from '../src/lib/randomizerCues.ts'

const manifest = JSON.parse(readFileSync(new URL('../public/audio/randomizer/manifest.json', import.meta.url)))

test('roulette clicks follow the eased wheel speed and four result sounds match the reveal cadence', () => {
  const spin = EXCHANGE_PRESENTATION.spinDurationMs/1000
  assert.equal(manifest.spinDurationSeconds, spin)
  assert.equal(manifest.launchDelaySeconds, EXCHANGE_PRESENTATION.launchDelayMs/1000)
  manifest.spinTickSeconds.forEach((time, index) => assert(Math.abs(rouletteProgress(time/spin)-(index+.5)/48) < 1e-8))
  const ticks = manifest.spinTickSeconds
  assert(ticks[1]-ticks[0] > ticks[24]-ticks[23])
  assert(ticks[47]-ticks[46] > ticks[24]-ticks[23])
  assert.deepEqual(manifest.resultSeconds, EXCHANGE_REVEAL_ORDER.map((_, rank) => (EXCHANGE_PRESENTATION.launchDelayMs+EXCHANGE_PRESENTATION.spinDurationMs+rank*EXCHANGE_PRESENTATION.revealGapMs)/1000))
})

test('audio that loads late joins the current spin and an expired sound is skipped', () => {
  assert.deepEqual(randomizerPlaybackTiming(4.8, 1120, 1000), {delay: .12, offset: 0})
  assert.deepEqual(randomizerPlaybackTiming(4.8, 1120, 2370), {delay: 0, offset: 1.25})
  assert.equal(randomizerPlaybackTiming(4.8, 1120, 5920), null)
  assert.equal(randomizerPlaybackTiming(.42, 1120, 1600), null)
})

test('all roulette files are unclipped stereo WAVs and the closing sound ends before the phase timer cue', () => {
  const durations = {}
  for (const [id, file] of Object.entries(RANDOMIZER_CUES)) {
    const data = readFileSync(new URL('../public/'+file, import.meta.url))
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WAVE')
    assert.equal(data.readUInt16LE(20), 1)
    assert.equal(data.readUInt16LE(22), 2)
    assert.equal(data.readUInt32LE(24), 44100)
    assert.equal(data.readUInt16LE(34), 16)
    durations[id] = (data.length-44)/(44100*4)
    let peak = 0
    for (let offset = 44; offset < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)))
    assert(peak > 10000 && peak < 28000)
  }
  assert.equal(durations.spin, EXCHANGE_PRESENTATION.spinDurationMs/1000)
  assert(durations.complete < EXCHANGE_PRESENTATION.resultHoldMs/1000)
  const timerAt = manifest.resultSeconds.at(-1)+EXCHANGE_PRESENTATION.resultHoldMs/1000
  assert(durations.preview < timerAt)
})

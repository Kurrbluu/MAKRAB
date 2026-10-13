import test from 'node:test'
import assert from 'node:assert/strict'
import { rouletteCandidates, rouletteProgress, rouletteMotionFrames } from '../src/lib/exchangePresentation.ts'

const ids = ['azure-dragon', 'vermilion-bird', 'white-tiger', 'black-tortoise']

test('every faction reel shows eligible candidates and lands on its stored target', () => {
  for (const source of ids) for (const target of ids.filter(id => id !== source)) {
    const candidates = rouletteCandidates(ids, source, target)
    assert.equal(candidates.length, 10)
    assert(candidates.every(id => ids.includes(id) && id !== source))
    assert.equal(candidates.at(-1), target)
    assert.notEqual(candidates.at(-2), target)
    assert.deepEqual(rouletteCandidates(ids, source, target), candidates, 'Replay preserves the presentation of the saved target')
  }
})

test('reels reject self-targets and invalid faction sets', () => {
  assert.throws(() => rouletteCandidates(ids, ids[0], ids[0]))
  assert.throws(() => rouletteCandidates(ids, 'missing', ids[1]))
  assert.throws(() => rouletteCandidates(ids, ids[0], 'missing'))
  assert.throws(() => rouletteCandidates([ids[0], ids[0], ids[2], ids[3]], ids[0], ids[2]))
})

test('elapsed-time roulette advances smoothly and settles correctly after delayed frames', () => {
  assert.equal(rouletteProgress(0), 0)
  assert(rouletteProgress(.2) > rouletteProgress(.1))
  assert(rouletteProgress(.6) > rouletteProgress(.2))
  let previous = 0
  for (let sample = 0; sample <= 1000; sample++) {
    const progress = rouletteProgress(sample / 1000)
    assert(Number.isFinite(progress) && progress >= previous && progress <= 1)
    previous = progress
  }
  assert.equal(rouletteProgress(1), 1)
  assert.equal(rouletteProgress(5), 1)
})

test('roulette eases continuously into the stored result without a speed jump or early stop', () => {
  const step = .0001
  for (const point of [.12, .58, .965]) {
    const before = (rouletteProgress(point) - rouletteProgress(point - step)) / step
    const after = (rouletteProgress(point + step) - rouletteProgress(point)) / step
    assert(Math.abs(before - after) < .01, 'The scroll speed stays continuous')
  }
  assert(rouletteProgress(step) / step < .01, 'The reel starts gently')
  assert((1 - rouletteProgress(1 - step)) / step < .01, 'The reel stops gently')
  assert(rouletteProgress(.98) < 1, 'The result settles over the full spin duration')
})

test('native transform frames preserve the measured landing position and smooth timing', () => {
  for (const distance of [-2871.125, -1260, -810.5]) {
    const frames = rouletteMotionFrames('reel', distance)
    assert.equal(frames[0].offset, 0)
    assert.equal(frames[0].transform, 'translate3d(0, 0px, 0)')
    assert.equal(frames.at(-1).offset, 1)
    assert.equal(frames.at(-1).transform, `translate3d(0, ${distance}px, 0)`)
    for (let index = 1; index < frames.length; index++) assert(frames[index].offset > frames[index - 1].offset)
  }
  assert.equal(rouletteMotionFrames('ring', 720).at(-1).transform, 'translate3d(0, 0, 0) rotate(720deg)')
})

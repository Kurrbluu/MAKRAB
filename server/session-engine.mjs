import { createHash, randomUUID, randomInt } from 'node:crypto'
import { createSharedGame, advanceSharedGame, applySharedCommand, assertSharedGame, isSharedCommand } from '../src/lib/sharedGame.ts'
import { createScoring, syncScoring, publicResults, scoreTotals, applyScoringCommand, assertScoring, isScoringCommand, ScoreConflict } from '../src/lib/gameScoring.ts'
import { jsonEqual } from '../src/lib/jsonEqual.ts'
import { roundCountFor } from '../src/lib/gameRundown.ts'

export function createSessionDocument(now, id = randomUUID) {
  const state = createSharedGame(now, id)
  return { version: 1, state, scoring: createScoring(state.gameId), commands: [] }
}
export function assertSessionDocument(document) {
  if (!document || document.version !== 1) throw new Error('Sesi tersimpan tidak valid.')
  assertSharedGame(document.state)
  const privateKeys = new Set(['gmPin', 'scoring', 'entries', 'history', 'totals', 'points', 'role', 'actor', 'lastCleared'])
  const checkPublic = value => {
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value)) {
      if (privateKeys.has(key)) throw new Error('Data privat tidak boleh masuk ke layar publik.')
      checkPublic(nested)
    }
  }
  checkPublic(document.state)
  assertScoring(document.scoring, roundCountFor(document.state.rundown))
  if (document.scoring.gameId !== document.state.gameId || !Array.isArray(document.commands) || document.commands.length > 128
    || document.commands.some(entry => typeof entry.id !== 'string' || typeof entry.hash !== 'string')) throw new Error('Sesi tersimpan tidak valid.')
}
export function reconcileSession(document, previous = document) {
  const scoring = syncScoring(document.scoring, document.state)
  const results = publicResults(scoring, document.state)
  let state = document.state
  if ((results.enabled || state.results !== undefined) && !jsonEqual(results, state.results)) {
    state = { ...state, results, revision: Math.max(state.revision, previous.state.revision + 1) }
  }
  return state === document.state && scoring === document.scoring ? document : { ...document, state, scoring }
}
export function advanceSession(document, now, id = randomUUID) {
  const state = advanceSharedGame(document.state, now, id)
  return reconcileSession(state === document.state ? document : { ...document, state }, document)
}
export function publicSnapshot(document, now) { return { state: document.state, serverNow: now } }
export function privateSnapshot(document, actor, now) { return { scoring: document.scoring, totals: scoreTotals(document.scoring), roundCount: roundCountFor(document.state.rundown), actor, serverNow: now } }
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(id)
const hashCommand = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const remember = (document, id, hash) => ({ ...document, commands: [...document.commands, { id, hash }].slice(-128) })

export function coreTransition(original, body, now, choices = { id: randomUUID, chooseIndex: randomInt }) {
  let document = advanceSession(original, now, choices.id)
  const reply = (status, error) => ({ document, status, body: { ...publicSnapshot(document, now), ...(error ? { error } : {}) } })
  if (!body || !validId(body.commandId) || !Number.isInteger(body.expectedRevision) || !isSharedCommand(body.command)) return reply(400, 'Perintah tidak valid.')
  const hash = hashCommand(body.command), prior = document.commands.find(entry => entry.id === body.commandId)
  if (prior) return reply(prior.hash === hash ? 200 : 409, prior.hash === hash ? undefined : 'ID perintah sudah digunakan.')
  if (body.expectedRevision !== document.state.revision) return reply(409, 'Permainan sudah diperbarui oleh perangkat lain. Periksa layar lalu coba lagi.')
  try {
    let scoring = document.scoring, state
    if (document.state.results?.presentation && ['toggle', 'pause', 'reset', 'replay', 'duration'].includes(body.command.type)) throw new Error('Gunakan Lanjut untuk meninggalkan layar hasil.')
    if (body.command.type === 'resultsNext') {
      const result = document.state.results?.presentation
      if (result?.kind !== 'ranking') throw new Error('Ranking belum siap dilanjutkan.')
      scoring = { ...scoring, revision: scoring.revision + 1, dismissed: [...new Set([...scoring.dismissed, result.round])] }
      state = result.round < roundCountFor(document.state.rundown) ? applySharedCommand(document.state, { type: 'phase', index: document.state.rundown.phaseIndex + 1, start: true }, now, choices) : document.state
    } else state = applySharedCommand(document.state, body.command, now, choices)
    assertSharedGame(state)
    document = remember(reconcileSession({ ...document, state, scoring }, document), body.commandId, hash)
    return reply(200)
  } catch (error) { return reply(400, error.message) }
}
export function scoringTransition(original, body, actor, now, id = randomUUID) {
  let document = advanceSession(original, now, id)
  const reply = (status, error) => ({ document, status, body: { ...privateSnapshot(document, actor, now), ...(error ? { error } : {}) } })
  if (!body || !validId(body.commandId) || typeof body.gameId !== 'string' || !isScoringCommand(body.command)) return reply(400, 'Input GM tidak valid.')
  if (body.gameId !== document.state.gameId) return reply(409, 'Permainan sudah berganti. Periksa sesi terbaru sebelum menginput.')
  const hash = hashCommand({ gameId: body.gameId, gm: body.command }), prior = document.commands.find(entry => entry.id === body.commandId)
  if (prior) return reply(prior.hash === hash ? 200 : 409, prior.hash === hash ? undefined : 'ID perintah sudah digunakan.')
  try {
    const roundCount = roundCountFor(document.state.rundown)
    const scoring = applyScoringCommand(document.scoring, body.command, actor, now, id, roundCount)
    assertScoring(scoring, roundCount)
    document = remember(reconcileSession({ ...document, scoring }, document), body.commandId, hash)
    return reply(200)
  } catch (error) { return reply(error instanceof ScoreConflict ? 409 : 400, error.message) }
}

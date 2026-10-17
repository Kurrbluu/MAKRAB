import { FACTION_IDS } from '../data/factionIds.ts'
import { GAME_PHASES } from '../data/gamePhases.ts'
import type { ExchangeNumber } from '../data/gamePhases'
import { TIMER_CONFIG } from '../data/timers.ts'
import type { TimerId } from '../data/timers'
import { ensureExchangeTargets } from './exchangeFlow.ts'
import { EXCHANGE_PRESENTATION } from './exchangePresentation.ts'
import { addRundownRound, completeRundownDraw, createRundown, phaseCountFor, prepareRundownDraw, queueRundownRound, roundCountFor, selectRundownPhase, settleRundown, startRundownPhase } from './gameRundown.ts'
import type { GameRundown } from './gameRundown'
import { pauseAllTimers, pauseTimer, resetTimer, setTimerDuration, startTimer } from './gameTimer.ts'
import { emptySession, isValidTargets } from './randomizer.ts'
import type { RandomizerSession } from './randomizer'
import { createPhaseCueTracker, observePhaseCue } from './phaseCues.ts'
import type { PhaseCueTracker } from './phaseCues'
import { assertPublicResults } from './gameScoring.ts'
import type { PublicResults } from './gameScoring'
import { jsonEqual } from './jsonEqual.ts'

export const SHARED_START_LEAD_MS = 400
export const SHARED_DRAW_DURATION_MS = EXCHANGE_PRESENTATION.launchDelayMs + EXCHANGE_PRESENTATION.spinDurationMs
  + 3 * EXCHANGE_PRESENTATION.revealGapMs + EXCHANGE_PRESENTATION.resultHoldMs

export type SharedPresentation = { id: string; round: ExchangeNumber; startsAt: number; completesAt: number }
export type SharedCue = { id: string; phaseIndex: number; timerId: TimerId; startsAt: number }
export type SharedGame = {
  version: 1
  gameId: string
  revision: number
  active: boolean
  rundown: GameRundown
  draws: RandomizerSession
  presentation: SharedPresentation | null
  cueTracker: PhaseCueTracker
  cue: SharedCue | null
  updatedAt: number
  results?: PublicResults
}
export type SharedSnapshot = { state: SharedGame; serverNow: number; serverReceivedAt?: number }
export type SharedCommand =
  | { type: 'begin' | 'toggle' | 'pause' | 'reset' | 'replay' | 'home' | 'newGame' | 'resultsNext' | 'addRound' | 'queueRound' }
  | { type: 'phase'; index: number; start: boolean }
  | { type: 'duration'; durationMs: number }
type Choices = { id: () => string; chooseIndex?: (length: number) => number }

export function createSharedGame(now: number, id: () => string): SharedGame {
  return { version: 1, gameId: id(), revision: 0, active: false, rundown: createRundown(), draws: emptySession(),
    presentation: null, cueTracker: createPhaseCueTracker(0), cue: null, updatedAt: now }
}

function observeCue(state: SharedGame, id: () => string): SharedGame {
  const phase = GAME_PHASES[state.rundown.phaseIndex]
  const timer = state.rundown.bank.timers[phase.timerId]
  const result = observePhaseCue(state.cueTracker, state.rundown.phaseIndex, timer.deadline !== null)
  return { ...state, cueTracker: result.tracker, cue: result.play
    ? { id: id(), phaseIndex: state.rundown.phaseIndex, timerId: phase.timerId, startsAt: timer.deadline! - timer.remainingMs }
    : state.cue }
}

function stamp(previous: SharedGame, next: SharedGame, now: number): SharedGame {
  if (jsonEqual(previous, next)) return previous
  return { ...next, revision: previous.revision + 1, updatedAt: now }
}

export function advanceSharedGame(state: SharedGame, now: number, id: () => string): SharedGame {
  let next = state
  if (next.presentation && now >= next.presentation.completesAt) {
    next = { ...next, rundown: completeRundownDraw(next.rundown, next.presentation.completesAt), presentation: null }
    next = observeCue(next, id)
  }
  const rundown = settleRundown(next.rundown, now, false)
  if (rundown !== next.rundown) next = { ...next, rundown }
  return stamp(state, next, now)
}

function prepareDraw(state: SharedGame, now: number, choices: Choices): SharedGame {
  const phase = GAME_PHASES[state.rundown.phaseIndex]
  if (!phase.drawTargets || !phase.round) throw new Error('Fase ini tidak mempunyai undian.')
  const ready = ensureExchangeTargets(state.draws, phase.round, FACTION_IDS, choices.chooseIndex)
  const startsAt = now + SHARED_START_LEAD_MS
  return { ...state, active: true, draws: ready.session, rundown: prepareRundownDraw(state.rundown, now),
    presentation: { id: choices.id(), round: phase.round, startsAt, completesAt: startsAt + SHARED_DRAW_DURATION_MS } }
}

function cancelPendingCue(state: SharedGame, now: number): SharedGame {
  if (state.cue && state.cue.startsAt > now && state.cue.phaseIndex === state.rundown.phaseIndex) {
    return { ...state, cue: null, cueTracker: createPhaseCueTracker(state.rundown.phaseIndex) }
  }
  return state
}

export function applySharedCommand(state: SharedGame, command: SharedCommand, now: number, choices: Choices): SharedGame {
  let next = state
  const phase = GAME_PHASES[state.rundown.phaseIndex]
  const timer = state.rundown.bank.timers[phase.timerId]
  switch (command.type) {
    case 'begin':
      if (state.active) return state
      next = { ...state, active: true }
      if (state.rundown.phaseIndex === 0 && timer.deadline === null && timer.remainingMs === timer.durationMs) next = prepareDraw(next, now, choices)
      break
    case 'newGame':
      next = { ...createSharedGame(now, choices.id), revision: state.revision, active: true }
      next = prepareDraw(next, now, choices)
      break
    case 'home': {
      next = cancelPendingCue(state, now)
      const rundown = { ...next.rundown, bank: pauseAllTimers(next.rundown.bank, now) }
      delete rundown.startAfterDraw
      next = { ...next, active: false, presentation: null, rundown }
      break
    }
    case 'phase': {
      if (!Number.isInteger(command.index) || command.index < 0 || command.index >= phaseCountFor(state.rundown)) throw new Error('Fase tidak valid.')
      next = cancelPendingCue(state, now)
      const selected = selectRundownPhase(command.index, roundCountFor(state.rundown))
      next = { ...next, active: true, presentation: null, rundown: command.start ? startRundownPhase(selected, now + SHARED_START_LEAD_MS) : selected }
      const targetPhase = GAME_PHASES[command.index]
      if (targetPhase.drawTargets) next = prepareDraw(next, now, choices)
      else if (targetPhase.round && !targetPhase.hideExchangeTargets) {
        next = { ...next, draws: ensureExchangeTargets(next.draws, targetPhase.round, FACTION_IDS, choices.chooseIndex).session }
      }
      break
    }
    case 'addRound': {
      if (state.results?.presentation?.kind === 'waiting') throw new Error('Tunggu catatan kedua ruangan lengkap sebelum menambah ronde.')
      const selected = addRundownRound(state.rundown)
      next = prepareDraw({ ...cancelPendingCue(state, now), rundown: startRundownPhase(selected, now), presentation: null }, now, choices)
      break
    }
    case 'queueRound':
      next = { ...state, rundown: queueRundownRound(state.rundown) }
      break
    case 'replay':
      if (state.presentation) return state
      next = prepareDraw(state, now, choices)
      break
    case 'toggle':
      if (state.presentation) {
        if (state.rundown.startAfterDraw) return state
        next = { ...state, rundown: startRundownPhase(state.rundown, now) }
      } else if (timer.deadline !== null) {
        next = cancelPendingCue(state, now)
        next = { ...next, rundown: { ...next.rundown, bank: pauseTimer(next.rundown.bank, phase.timerId, now) } }
      } else if (phase.drawTargets && phase.round && !state.draws.rounds[phase.round]) {
        next = prepareDraw({ ...state, rundown: startRundownPhase(state.rundown, now) }, now, choices)
      } else {
        next = { ...state, active: true, rundown: { ...state.rundown, bank: startTimer(state.rundown.bank, phase.timerId, now + SHARED_START_LEAD_MS) } }
      }
      break
    case 'pause': {
      next = cancelPendingCue(state, now)
      const rundown = { ...next.rundown, bank: pauseAllTimers(next.rundown.bank, now) }
      delete rundown.startAfterDraw
      next = { ...next, rundown }
      break
    }
    case 'reset':
      if (state.presentation) throw new Error('Tunggu undian selesai sebelum mereset timer.')
      next = cancelPendingCue(state, now)
      next = { ...next, rundown: { ...next.rundown, bank: resetTimer(next.rundown.bank, phase.timerId) } }
      break
    case 'duration':
      if (state.presentation) throw new Error('Tunggu undian selesai sebelum mengedit timer.')
      next = cancelPendingCue(state, now)
      next = { ...next, rundown: { ...next.rundown, bank: setTimerDuration(next.rundown.bank, phase.timerId, command.durationMs) } }
      break
  }
  next = observeCue(next, choices.id)
  return stamp(state, next, now)
}

export function isSharedCommand(value: unknown): value is SharedCommand {
  if (!value || typeof value !== 'object' || !('type' in value)) return false
  if (['begin', 'toggle', 'pause', 'reset', 'replay', 'home', 'newGame', 'resultsNext', 'addRound', 'queueRound'].includes(String(value.type))) return true
  if (value.type === 'phase') return 'index' in value && Number.isInteger(value.index) && 'start' in value && typeof value.start === 'boolean'
  return value.type === 'duration' && 'durationMs' in value && Number.isInteger(value.durationMs)
}

export function assertSharedGame(value: unknown): asserts value is SharedGame {
  if (!value || typeof value !== 'object') throw new Error('Sesi tidak valid.')
  const state = value as SharedGame
  if (state.results !== undefined) assertPublicResults(state.results)
  if (state.version !== 1 || typeof state.gameId !== 'string' || !state.gameId || !Number.isInteger(state.revision) || state.revision < 0
    || typeof state.active !== 'boolean' || !Number.isFinite(state.updatedAt) || state.rundown?.version !== 4
    || (state.rundown.roundCount !== undefined && ![3, 4, 5].includes(state.rundown.roundCount))
    || !Number.isInteger(state.rundown.phaseIndex) || !GAME_PHASES[state.rundown.phaseIndex] || state.rundown.bank?.version !== 1
    || state.rundown.phaseIndex >= phaseCountFor(state.rundown)
    || !state.rundown.bank.timers || state.cueTracker?.phaseIndex !== state.rundown.phaseIndex || typeof state.cueTracker.started !== 'boolean'
    || (state.rundown.startAfterDraw !== undefined && state.rundown.startAfterDraw !== true)) throw new Error('Sesi tidak valid.')
  if (state.results?.presentation && state.results.presentation.round > roundCountFor(state.rundown)) throw new Error('Ranking ronde ini belum diaktifkan.')
  for (const config of TIMER_CONFIG) {
    const timer = state.rundown.bank.timers[config.id]
    if (!timer || !Number.isInteger(timer.durationMs) || timer.durationMs < 1000 || timer.durationMs > config.maxDurationMs
      || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0 || timer.remainingMs > timer.durationMs
      || (timer.deadline !== null && (!Number.isFinite(timer.deadline) || timer.deadline <= 0))
      || (config.id !== GAME_PHASES[state.rundown.phaseIndex].timerId && timer.deadline !== null)) throw new Error('Clock sesi tidak valid.')
  }
  if (state.draws?.version !== 1 || ![1, 2, 3, 4, 5].includes(state.draws.activeRound)
    || state.draws.activeRound > roundCountFor(state.rundown) || !state.draws.rounds) throw new Error('Undian sesi tidak valid.')
  for (const [round, result] of Object.entries(state.draws.rounds)) {
    if (!['1', '2', '3', '4', '5'].includes(round) || Number(round) > roundCountFor(state.rundown)
      || !result || result.confirmed !== true || !isValidTargets(FACTION_IDS, result.targets)) throw new Error('Target sesi tidak valid.')
  }
  if (state.presentation !== null) {
    const p = state.presentation
    const phase = GAME_PHASES[state.rundown.phaseIndex]
    if (!p || typeof p.id !== 'string' || !p.id || !phase.drawTargets || p.round !== phase.round || !state.active
      || !state.draws.rounds[p.round] || state.rundown.bank.timers[phase.timerId].deadline !== null || !Number.isFinite(p.startsAt) || p.startsAt <= 0
      || p.completesAt !== p.startsAt + SHARED_DRAW_DURATION_MS) throw new Error('Presentasi sesi tidak valid.')
  }
  if (state.rundown.startAfterDraw && !state.presentation) throw new Error('Antrean countdown tidak mempunyai presentasi.')
  if (state.cue !== null && (!state.cue || typeof state.cue.id !== 'string' || !GAME_PHASES[state.cue.phaseIndex]
    || state.cue.timerId !== GAME_PHASES[state.cue.phaseIndex].timerId || !Number.isFinite(state.cue.startsAt))) throw new Error('Cue sesi tidak valid.')
}

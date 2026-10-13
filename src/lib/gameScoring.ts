import { FACTION_IDS } from '../data/factionIds.ts'
import { GAME_PHASES } from '../data/gamePhases.ts'

export const ROLE_POINTS = { vip: 3, pretender: -3, civilian: -1, warden: 1 } as const
export const SCORE_ROLES = [
  { id: 'vip', label: 'VIP', points: 3 }, { id: 'pretender', label: 'Pretender', points: -3 },
  { id: 'civilian', label: 'Civilian', points: -1 }, { id: 'warden', label: 'Warden', points: 1 },
] as const
export type ScoreRole = keyof typeof ROLE_POINTS
export type ScoreRound = 1 | 2 | 3
export type ScoreRoom = 'a' | 'b'
export type ScoreEntry = { key: string; round: ScoreRound; room: ScoreRoom; factionId: string; role: ScoreRole; revision: number; actor: string; updatedAt: number }
export type ScoreHistory = { id: string; key: string; round: ScoreRound; room: ScoreRoom; factionId: string; before: ScoreRole | null; after: ScoreRole | null; actor: string; at: number }
export type ScoringState = { version: 1; gameId: string; revision: number; enabled: boolean; entries: ScoreEntry[]; history: ScoreHistory[]; completed: ScoreRound[]; dismissed: ScoreRound[]; lastCleared?: { revision: number; actor: string; at: number } }
export type RankingPlace = { factionId: string; rank: number }
export type ResultsPresentation = { kind: 'waiting'; round: ScoreRound } | { kind: 'ranking'; round: ScoreRound; places: RankingPlace[] }
export type PublicResults = { enabled: boolean; presentation: ResultsPresentation | null }
export type ScoringCommand = { type: 'scoresEnable'; enabled: boolean }
  | { type: 'scoresClear'; expectedRevision: number }
  | { type: 'scoreAdd'; expectedRound: ScoreRound; room: ScoreRoom; factionId: string; role: ScoreRole; expectedClearRevision?: number }
  | { type: 'scoreSet'; round: ScoreRound; room: ScoreRoom; factionId: string; role: ScoreRole; expectedEntryRevision: number | null; expectedClearRevision?: number }
  | { type: 'scoreDelete'; round: ScoreRound; room: ScoreRoom; factionId: string; expectedEntryRevision: number; expectedClearRevision?: number }
type GameLike = { gameId: string; active: boolean; rundown: { phaseIndex: number; bank: { timers: Record<string, { remainingMs: number; deadline: number | null }> } } }

export const EXCHANGE_END_PHASES = { 1: 2, 2: 6, 3: 9 } as const
export function scoreKey(round: ScoreRound, room: ScoreRoom, factionId: string) { return `${round}:${room}:${factionId}` }
export function createScoring(gameId: string, enabled = false): ScoringState {
  return { version: 1, gameId, revision: 0, enabled, entries: [], history: [], completed: [], dismissed: [] }
}
export function phaseScoreRound(phaseIndex: number): ScoreRound {
  return phaseIndex <= 2 ? 1 : phaseIndex <= 6 ? 2 : 3
}
export function completedExchange(game: GameLike): ScoreRound | null {
  const round = ([1, 2, 3] as const).find(value => EXCHANGE_END_PHASES[value] === game.rundown.phaseIndex)
  const timer = game.rundown.bank.timers.movement
  return round && timer.deadline === null && timer.remainingMs === 0 ? round : null
}
export function syncScoring(state: ScoringState, game: GameLike): ScoringState {
  if (state.gameId !== game.gameId) return createScoring(game.gameId, state.enabled)
  const round = completedExchange(game)
  if (!round || state.completed.includes(round)) return state
  return { ...state, revision: state.revision + 1, completed: [...state.completed, round] }
}
export function scoreTotals(state: ScoringState, throughRound: ScoreRound = 3): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(FACTION_IDS.map(id => [id, 0]))
  for (const entry of state.entries) if (entry.round <= throughRound) totals[entry.factionId] += ROLE_POINTS[entry.role]
  return totals
}
export function roundProgress(state: ScoringState, round: ScoreRound) {
  return { a: state.entries.filter(entry => entry.round === round && entry.room === 'a').length,
    b: state.entries.filter(entry => entry.round === round && entry.room === 'b').length }
}
export function roundComplete(state: ScoringState, round: ScoreRound) {
  const progress = roundProgress(state, round)
  return progress.a === FACTION_IDS.length && progress.b === FACTION_IDS.length
}
export function nextScoreRound(state: ScoringState): ScoreRound | undefined {
  return ([1, 2, 3] as const).find(round => !roundComplete(state, round))
}
export function rankingPlaces(state: ScoringState, round: ScoreRound): RankingPlace[] {
  const totals = scoreTotals(state, round)
  const sorted = [...FACTION_IDS].sort((left, right) => totals[right] - totals[left])
  return sorted.map(id => ({ factionId: id, rank: 1 + sorted.filter(other => totals[other] > totals[id]).length }))
}
export function publicResults(state: ScoringState, game: GameLike): PublicResults {
  if (!state.enabled || !game.active) return { enabled: state.enabled, presentation: null }
  const round = completedExchange(game)
  if (!round || state.dismissed.includes(round)) return { enabled: true, presentation: null }
  // Earlier-round records must also be complete before cumulative standings can be published.
  const ready = ([1, 2, 3] as const).filter(value => value <= round).every(value => roundComplete(state, value))
  return { enabled: true, presentation: ready ? { kind: 'ranking', round, places: rankingPlaces(state, round) } : { kind: 'waiting', round } }
}
export function isScoringCommand(value: unknown): value is ScoringCommand {
  if (!value || typeof value !== 'object' || !('type' in value)) return false
  if (value.type === 'scoresEnable') return 'enabled' in value && typeof value.enabled === 'boolean'
  if (value.type === 'scoresClear') return 'expectedRevision' in value && Number.isInteger(value.expectedRevision) && Number(value.expectedRevision) >= 0
  if (value.type !== 'scoreSet' && value.type !== 'scoreDelete' && value.type !== 'scoreAdd') return false
  const c = value as Record<string, unknown>
  if (c.expectedClearRevision !== undefined && (!Number.isInteger(c.expectedClearRevision) || Number(c.expectedClearRevision) < 0)) return false
  if (![1, 2, 3].includes((value.type === 'scoreAdd' ? c.expectedRound : c.round) as number) || !['a', 'b'].includes(c.room as string)
    || !(FACTION_IDS as readonly unknown[]).includes(c.factionId)) return false
  if (value.type === 'scoreAdd') return typeof c.role === 'string' && Object.hasOwn(ROLE_POINTS, c.role)
  if (value.type === 'scoreSet') return typeof c.role === 'string' && Object.hasOwn(ROLE_POINTS, c.role) && (c.expectedEntryRevision === null || (Number.isInteger(c.expectedEntryRevision) && Number(c.expectedEntryRevision) >= 1))
  return Number.isInteger(c.expectedEntryRevision) && Number(c.expectedEntryRevision) >= 1
}
export class ScoreConflict extends Error {}
export function applyScoringCommand(state: ScoringState, command: ScoringCommand, actor: string, now: number, id: () => string): ScoringState {
  if (!isScoringCommand(command)) throw new Error('Input hasil tidak valid.')
  if (command.type === 'scoresEnable') return state.enabled === command.enabled ? state : { ...state, enabled: command.enabled, revision: state.revision + 1 }
  if (command.type === 'scoresClear') {
    if (command.expectedRevision !== state.revision) throw new ScoreConflict('Catatan sudah diperbarui. Periksa hasil terbaru sebelum clear lagi.')
    if (!state.entries.length && !state.history.length) return state
    return { ...state, revision: state.revision + 1, entries: [], history: [], lastCleared: { revision: state.revision + 1, actor, at: now } }
  }
  if (!state.enabled) throw new Error('Aktifkan GM dan ranking sebelum mencatat hasil.')
  if ((command.expectedClearRevision ?? 0) !== (state.lastCleared?.revision ?? 0)) throw new ScoreConflict('Semua catatan sudah dibersihkan. Pilih kembali faction sebelum menyimpan hasil.')
  if (command.type === 'scoreAdd') {
    const round = nextScoreRound(state)
    if (!round) throw new ScoreConflict('Semua 24 catatan sudah lengkap. Gunakan catatan tersimpan untuk koreksi.')
    if (round !== command.expectedRound) throw new ScoreConflict('Kelompok catatan sudah berubah. Pilih kembali faction untuk menambah poin.')
    if (state.entries.some(entry => entry.key === scoreKey(round, command.room, command.factionId))) throw new ScoreConflict('Faction ini sudah dicatat di ruangan ini. Buka catatan tersimpan untuk koreksi.')
    return applyScoringCommand(state, { type: 'scoreSet', round, room: command.room, factionId: command.factionId, role: command.role,
      expectedEntryRevision: null, expectedClearRevision: command.expectedClearRevision }, actor, now, id)
  }
  const key = scoreKey(command.round, command.room, command.factionId)
  const existing = state.entries.find(entry => entry.key === key)
  if ((existing?.revision ?? null) !== command.expectedEntryRevision) throw new ScoreConflict('Hasil ini sudah diubah. Periksa catatan terbaru sebelum menyimpan lagi.')
  if (command.type === 'scoreSet' && existing?.role === command.role) return state
  const after = command.type === 'scoreSet' ? command.role : null
  const entry: ScoreEntry | null = after ? { key, round: command.round, room: command.room, factionId: command.factionId, role: after,
    revision: state.revision + 1, actor, updatedAt: now } : null
  return { ...state, revision: state.revision + 1,
    entries: [...state.entries.filter(value => value.key !== key), ...(entry ? [entry] : [])],
    history: [...state.history, { id: id(), key, round: command.round, room: command.room, factionId: command.factionId,
      before: existing?.role ?? null, after, actor, at: now }] }
}
export function assertScoring(value: unknown): asserts value is ScoringState {
  const s = value as ScoringState
  if (!s || s.version !== 1 || typeof s.gameId !== 'string' || !s.gameId || !Number.isInteger(s.revision) || s.revision < 0
    || typeof s.enabled !== 'boolean' || !Array.isArray(s.entries) || !Array.isArray(s.history)
    || !Array.isArray(s.completed) || !Array.isArray(s.dismissed)) throw new Error('Catatan poin tidak valid.')
  for (const rounds of [s.completed, s.dismissed]) if (new Set(rounds).size !== rounds.length || rounds.some(round => ![1, 2, 3].includes(round))) throw new Error('Exchange catatan tidak valid.')
  if (s.lastCleared !== undefined && (!s.lastCleared || !Number.isInteger(s.lastCleared.revision) || s.lastCleared.revision < 1 || s.lastCleared.revision > s.revision
    || typeof s.lastCleared.actor !== 'string' || s.lastCleared.actor.length > 40 || !Number.isFinite(s.lastCleared.at))) throw new Error('Catatan clear tidak valid.')
  if (new Set(s.entries.map(entry => entry.key)).size !== s.entries.length) throw new Error('Catatan faction terduplikasi.')
  for (const entry of s.entries) {
    if (!isScoringCommand({ type: 'scoreSet', ...entry, expectedEntryRevision: entry.revision })
      || entry.revision > s.revision
      || entry.key !== scoreKey(entry.round, entry.room, entry.factionId) || typeof entry.actor !== 'string' || entry.actor.length > 40
      || !Number.isFinite(entry.updatedAt)) throw new Error('Hasil faction tidak valid.')
  }
  for (const event of s.history) {
    if (!event || typeof event.id !== 'string' || !event.id || typeof event.actor !== 'string' || event.actor.length > 40
      || !Number.isFinite(event.at) || ![1, 2, 3].includes(event.round) || !['a', 'b'].includes(event.room)
      || !(FACTION_IDS as readonly string[]).includes(event.factionId) || event.key !== scoreKey(event.round, event.room, event.factionId)
      || (event.before !== null && !Object.hasOwn(ROLE_POINTS, event.before)) || (event.after !== null && !Object.hasOwn(ROLE_POINTS, event.after))) throw new Error('Riwayat poin tidak valid.')
  }
}
export function assertPublicResults(value: unknown): asserts value is PublicResults {
  const r = value as PublicResults
  if (!r || typeof r.enabled !== 'boolean') throw new Error('Hasil publik tidak valid.')
  if (r.presentation === null) return
  const p = r.presentation
  if (!r.enabled || !p || ![1, 2, 3].includes(p.round) || !['waiting', 'ranking'].includes(p.kind)) throw new Error('Presentasi ranking tidak valid.')
  if (p.kind === 'ranking' && (!Array.isArray(p.places) || p.places.length !== 4 || new Set(p.places.map(place => place.factionId)).size !== 4
    || p.places.some(place => !(FACTION_IDS as readonly string[]).includes(place.factionId) || !Number.isInteger(place.rank) || place.rank < 1 || place.rank > 4))) throw new Error('Peringkat tidak valid.')
}

export function exchangeTitle(round: ScoreRound) { return GAME_PHASES[EXCHANGE_END_PHASES[round]].title }

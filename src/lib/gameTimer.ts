import { TIMER_CONFIG } from '../data/timers.ts'
import type { TimerId } from '../data/timers'

export type Countdown = { durationMs: number; remainingMs: number; deadline: number | null }
export type TimerBank = { version: 1; timers: Record<TimerId, Countdown> }
export const timerStorageKey = 'makrab:three-timers:v1'

export function createTimerBank(): TimerBank {
  return { version: 1, timers: Object.fromEntries(TIMER_CONFIG.map((timer) => [timer.id, {
    durationMs: timer.durationMs, remainingMs: timer.durationMs, deadline: null,
  }])) as TimerBank['timers'] }
}

export function remainingTime(timer: Countdown, now: number): number {
  return timer.deadline === null ? timer.remainingMs : Math.min(timer.durationMs, Math.max(0, timer.deadline - now))
}

// Absolute deadlines keep time accurate across slow frames, background tabs,
// and refresh. Reaching zero never starts another timer automatically.
export function settleTimers(bank: TimerBank, now: number): TimerBank {
  let next = bank
  for (const { id } of TIMER_CONFIG) {
    const timer = next.timers[id]
    if (timer.deadline !== null && timer.deadline <= now) {
      next = { ...next, timers: { ...next.timers, [id]: { ...timer, remainingMs: 0, deadline: null } } }
    }
  }
  return next
}

export function pauseTimer(bank: TimerBank, id: TimerId, now: number): TimerBank {
  const current = settleTimers(bank, now)
  const timer = current.timers[id]
  if (timer.deadline === null) return current
  return { ...current, timers: { ...current.timers, [id]: { ...timer, remainingMs: remainingTime(timer, now), deadline: null } } }
}

export function pauseAllTimers(bank: TimerBank, now: number): TimerBank {
  return TIMER_CONFIG.reduce((current, { id }) => pauseTimer(current, id, now), bank)
}

export function startTimer(bank: TimerBank, id: TimerId, now: number): TimerBank {
  const current = pauseAllTimers(bank, now)
  const timer = current.timers[id]
  const remainingMs = timer.remainingMs || timer.durationMs
  return { ...current, timers: { ...current.timers, [id]: { ...timer, remainingMs, deadline: now + remainingMs } } }
}

export function resetTimer(bank: TimerBank, id: TimerId): TimerBank {
  const timer = bank.timers[id]
  return { ...bank, timers: { ...bank.timers, [id]: { ...timer, remainingMs: timer.durationMs, deadline: null } } }
}

export function setTimerDuration(bank: TimerBank, id: TimerId, durationMs: number): TimerBank {
  const config = TIMER_CONFIG.find((timer) => timer.id === id)!
  if (!Number.isInteger(durationMs) || durationMs < 1000 || durationMs > config.maxDurationMs) throw new Error('Invalid duration.')
  return { ...bank, timers: { ...bank.timers, [id]: { durationMs, remainingMs: durationMs, deadline: null } } }
}

export function restoreTimerBank(raw: string | null, now: number, settleExpired = true): TimerBank {
  const bank = createTimerBank()
  if (!raw) return bank
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1 || !value.timers || typeof value.timers !== 'object') return bank
    let hasRunningTimer = false
    for (const { id, maxDurationMs } of TIMER_CONFIG) {
      const timer = value.timers[id]
      if (!timer || !Number.isInteger(timer.durationMs) || timer.durationMs < 1000 || timer.durationMs > maxDurationMs
        || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0 || timer.remainingMs > timer.durationMs
        || (timer.deadline !== null && (!Number.isFinite(timer.deadline) || timer.deadline < 0 || timer.deadline > now + timer.durationMs))) continue
      const restored: Countdown = { durationMs: timer.durationMs, remainingMs: timer.remainingMs, deadline: timer.deadline }
      if (restored.deadline !== null && restored.deadline > now) {
        if (hasRunningTimer) { restored.remainingMs = remainingTime(restored, now); restored.deadline = null }
        else hasRunningTimer = true
      }
      bank.timers[id] = restored
    }
    return settleExpired ? settleTimers(bank, now) : bank
  } catch {
    return bank
  }
}

export function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

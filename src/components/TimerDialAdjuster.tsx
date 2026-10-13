import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { formatTime } from '../lib/gameTimer'
import { createDialCursor, moveDialCursor, pointerDialAngle } from '../lib/timerDial'
import type { DialCursor } from '../lib/timerDial'

export type TimerDialSave = (durationMs: number) => Promise<boolean>
type Props = { valueMs: number; maxMs: number; disabled: boolean; onBegin: () => Promise<TimerDialSave | null>; onPreview: (valueMs: number | null) => void }
type Gesture = { pointerId: number; target: HTMLDivElement; x: number; y: number; centerX: number; centerY: number; startValueMs: number; cursor: DialCursor; active: boolean; released: boolean; cancelled: boolean; save: Promise<TimerDialSave | null> | null }

export default function TimerDialAdjuster(props: Props) {
  const latest = useRef(props)
  latest.current = props
  const gesture = useRef<Gesture | null>(null)
  const mounted = useRef(true)
  const [preview, setPreview] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function release(current: Gesture) {
    if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
  }
  function clear(current: Gesture) {
    if (gesture.current !== current) return
    gesture.current = null
    if (mounted.current) { setPreview(null); setSaving(false); latest.current.onPreview(null) }
  }
  function cancel() {
    const current = gesture.current
    if (!current) return
    current.cancelled = true
    current.released = true
    release(current)
    clear(current)
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const current = gesture.current
      if (current) { current.cancelled = true; current.released = true; release(current); latest.current.onPreview(null) }
      gesture.current = null
    }
  }, [])

  function activate(current: Gesture) {
    current.active = true
    current.save = latest.current.onBegin().catch(() => null).then(save => {
      if (!save && gesture.current === current) cancel()
      return save
    })
  }
  function publish(current: Gesture) {
    setPreview(current.cursor.valueMs)
    latest.current.onPreview(current.cursor.valueMs)
  }
  async function save(current: Gesture) {
    setSaving(true)
    try {
      const commit = await current.save
      if (commit && !current.cancelled && mounted.current && gesture.current === current) await commit(current.cursor.valueMs)
    } finally { clear(current) }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (latest.current.disabled || saving || gesture.current || event.button !== 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const centerX = box.left + box.width / 2, centerY = box.top + box.height / 2
    const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY) / Math.min(box.width, box.height)
    if (distance < .34 || distance > .58) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { pointerId: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, centerX, centerY,
      startValueMs: Math.ceil(latest.current.valueMs / 1000) * 1000,
      cursor: createDialCursor(latest.current.valueMs, pointerDialAngle(event.clientX, event.clientY, centerX, centerY), latest.current.maxMs), active: false, released: false, cancelled: false, save: null }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId || current.released) return
    if (Math.hypot(event.clientX - current.centerX, event.clientY - current.centerY) < 8) return
    event.preventDefault()
    current.cursor = moveDialCursor(current.cursor, pointerDialAngle(event.clientX, event.clientY, current.centerX, current.centerY), latest.current.maxMs)
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 4 && current.cursor.valueMs !== current.startValueMs) activate(current)
    if (current.active) publish(current)
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId || current.released) return
    pointerMove(event)
    current.released = true
    release(current)
    if (current.active) void save(current)
    else clear(current)
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); return }
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const changes: Record<string, number> = { ArrowRight: 5000, ArrowUp: 5000, ArrowLeft: -5000, ArrowDown: -5000, PageUp: 60_000, PageDown: -60_000 }
    if (!(event.key in changes) && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault(); event.stopPropagation()
    if (latest.current.disabled || saving || gesture.current) return
    const valueMs = event.key === 'Home' ? 1000 : event.key === 'End' ? latest.current.maxMs
      : Math.max(1000, Math.min(latest.current.maxMs, Math.ceil(latest.current.valueMs / 1000) * 1000 + changes[event.key]))
    const current: Gesture = { pointerId: -1, target: event.currentTarget, x: 0, y: 0, centerX: 0, centerY: 0,
      startValueMs: valueMs,
      cursor: createDialCursor(valueMs, 0, latest.current.maxMs), active: false, released: true, cancelled: false, save: null }
    gesture.current = current
    activate(current); publish(current); void save(current)
  }

  const valueMs = preview ?? props.valueMs
  return <div className={`timer-dial-adjuster${preview !== null ? ' is-adjusting' : ''}`} role="slider" tabIndex={props.disabled ? -1 : 0}
    aria-label="Atur waktu timer" aria-valuemin={1} aria-valuemax={props.maxMs / 1000} aria-valuenow={Math.max(1, Math.ceil(valueMs / 1000))} aria-valuetext={formatTime(valueMs)} aria-disabled={props.disabled || saving} aria-busy={saving || undefined}
    title="Geser dial untuk atur waktu. Panah: 5 detik; Page Up/Down: 1 menit."
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
    onLostPointerCapture={() => { if (gesture.current && !gesture.current.released) cancel() }} onKeyDown={keyboard} />
}

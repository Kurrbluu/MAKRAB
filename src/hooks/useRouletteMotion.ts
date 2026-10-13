import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { EXCHANGE_PRESENTATION, rouletteMotionFrames, rouletteTransform } from '../lib/exchangePresentation'
import type { RouletteMotion } from '../lib/exchangePresentation'
import type { PresentationTimeline } from '../lib/presentationTimeline'

export default function useRouletteMotion(ref: RefObject<HTMLElement | null>, onStop?: () => void, delayMs = 0, motion: RouletteMotion = 'ring', timeline?: PresentationTimeline) {
  const stopRef = useRef(onStop)
  useLayoutEffect(() => { stopRef.current = onStop }, [onStop])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let cancelled = false
    let finished = false
    let frame: number | undefined
    let fallback: number | undefined
    let animation: Animation | undefined
    const measureDistance = () => {
      if (motion === 'ring') return 720
      const last = element.lastElementChild
      return last ? -(last.getBoundingClientRect().top - element.getBoundingClientRect().top) : 0
    }
    let distance = measureDistance()
    const setProgress = (progress: number) => { element.style.transform = rouletteTransform(progress, motion, distance) }
    const finish = () => {
      if (cancelled || finished) return
      finished = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
      setProgress(1)
      if (animation) {
        animation.onfinish = null
        animation.cancel()
        animation = undefined
      }
      stopRef.current?.()
    }
    setProgress(0)
    const launchDelay = EXCHANGE_PRESENTATION.launchDelayMs + delayMs
    const elapsedAtMount = timeline ? timeline.now() - timeline.startsAt : 0
    const startsAt = performance.now() - elapsedAtMount + launchDelay
    const tick = (timestamp: number) => {
      if (cancelled || finished) return
      const elapsed = (timestamp - startsAt) / EXCHANGE_PRESENTATION.spinDurationMs
      setProgress(elapsed)
      if (elapsed >= 1) finish()
      else frame = requestAnimationFrame(tick)
    }
    try {
      animation = element.animate(rouletteMotionFrames(motion, distance), {
        duration: EXCHANGE_PRESENTATION.spinDurationMs,
        delay: launchDelay + Math.max(0, -elapsedAtMount),
        easing: 'linear',
        fill: 'both',
      })
      if (elapsedAtMount > 0) animation.currentTime = elapsedAtMount
      animation.onfinish = finish
      element.dataset.motionDriver = 'native'
    } catch {
      element.dataset.motionDriver = 'raf'
      frame = requestAnimationFrame(tick)
    }
    fallback = window.setTimeout(finish, Math.max(0, EXCHANGE_PRESENTATION.spinDurationMs + launchDelay - elapsedAtMount) + 200)
    const resize = () => {
      const measured = measureDistance()
      if (measured === distance) return
      distance = measured
      const effect = animation?.effect as KeyframeEffect | null | undefined
      if (finished) setProgress(1)
      else effect?.setKeyframes?.(rouletteMotionFrames(motion, distance))
    }
    const observer = motion === 'reel' && typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined
    observer?.observe(element)
    window.addEventListener('resize', resize)
    return () => {
      cancelled = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      if (animation) {
        animation.onfinish = null
        animation.cancel()
      }
    }
  }, [ref, delayMs, motion, timeline])
}

import { EXCHANGE_PRESENTATION } from './exchangePresentation.ts'

export const cardTiming = {
  shuffleStart: 430,
  dealStart: 1490,
  dealStep: 110,
  dealDuration: 570,
  revealStart: 2490,
  revealStep: EXCHANGE_PRESENTATION.revealGapMs,
  revealDuration: 420,
  duration: 3500,
} as const

export type CardGatherOrigin = { x: number; y: number; maxReach: number; groupIndex: number; groupSize: number }
export type CardSlot = { x: number; y: number; width: number; height: number; origin?: CardGatherOrigin }
export type DrawLayout = { centerX: number; centerY: number; slots: CardSlot[] }

export function measureDrawLayout(stage: HTMLElement, slots: readonly (HTMLElement | null)[]): DrawLayout | null {
  if (slots.length !== 4 || slots.some((slot) => !slot)) return null
  const stageRect = stage.getBoundingClientRect()
  const positions = slots.map((slot) => {
    const rect = slot!.getBoundingClientRect()
    return {
      x: rect.left - stageRect.left + rect.width / 2,
      y: rect.top - stageRect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    }
  })
  if (positions.some((slot) => slot.width === 0 || slot.height === 0)) return null
  return {
    centerX: stageRect.width / 2,
    centerY: (positions[0].y + positions[1].y) / 2 - 12,
    slots: positions,
  }
}

export function cardMotionFrames(layout: DrawLayout, index: number): Keyframe[] {
  const slot = layout.slots[index]
  const centerX = slot.origin?.x ?? layout.centerX
  const centerY = slot.origin?.y ?? layout.centerY
  const targetX = slot.x - centerX
  const targetY = slot.y - centerY
  const groupIndex = slot.origin?.groupIndex ?? index
  const groupSize = slot.origin?.groupSize ?? layout.slots.length
  const stackOffset = groupIndex - (groupSize - 1) / 2
  const stackX = stackOffset * 5
  const stackY = stackOffset * 3
  const tilt = stackOffset * 5
  const direction = groupIndex % 2 === 0 ? -1 : 1
  const reach = slot.origin?.maxReach ?? Math.min(220, Math.max(0, centerX - slot.width * 0.65 - 18))
  const dealAt = cardTiming.dealStart + cardTiming.dealStep * index
  const pose = (time: number, x: number, y: number, rotation: number, scale: number, zIndex: number, easing = 'ease-in-out'): Keyframe => ({
    offset: time / cardTiming.duration,
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`,
    zIndex,
    easing,
  })

  return [
    pose(0, targetX, targetY, 0, 1, index + 1, 'cubic-bezier(.22,.7,.2,1)'),
    pose(370, stackX, stackY, tilt, 1.02, index + 1),
    pose(430, stackX, stackY + 3, tilt * 0.7, 1, index + 1),
    pose(650, direction * reach, -28 + index * 5, direction * 16, 1.04, 5 - index),
    pose(820, stackX * -1, stackY - 6, tilt * -1, 1.02, 5 - index),
    pose(1020, -direction * reach * 0.85, -38 + index * 8, -direction * 13, 1.06, index + 1),
    pose(1210, stackX, stackY - 3, tilt, 1.02, index + 1),
    pose(1390, stackX * 2.3, Math.abs(stackOffset) * 4 - 8, tilt * 1.5, 1.03, index + 1),
    pose(dealAt, stackX * 2.3, Math.abs(stackOffset) * 4 - 8, tilt * 1.5, 1.03, 10 + index, 'cubic-bezier(.22,.55,.25,1)'),
    pose(dealAt + 270, targetX * 0.72, targetY * 0.65 - 42, direction * 10, 1.07, 10 + index),
    pose(dealAt + 480, targetX, targetY + 3, -direction * 1.5, 1.015, 10 + index),
    pose(dealAt + cardTiming.dealDuration, targetX, targetY, 0, 1, index + 1),
    pose(cardTiming.duration, targetX, targetY, 0, 1, index + 1),
  ]
}

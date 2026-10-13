export function createServerClock(readLocal = () => performance.timeOrigin + performance.now()) {
  let offset = 0
  let bestRoundTrip = Infinity
  return {
    now: () => readLocal() + offset,
    offset: () => offset,
    restore(value: number) { if (Number.isFinite(value)) offset = value },
    observe(serverNow: number, requestStart: number, responseEnd: number, serverReceivedAt?: number) {
      const processing = Number.isFinite(serverReceivedAt) && serverReceivedAt! <= serverNow ? serverNow - serverReceivedAt! : 0
      const roundTrip = responseEnd - requestStart - processing
      if (!Number.isFinite(serverNow) || roundTrip < 0) return
      if (roundTrip <= bestRoundTrip + 20) {
        offset = serverNow - processing / 2 - (requestStart + responseEnd) / 2
        bestRoundTrip = Math.min(bestRoundTrip, roundTrip)
      }
    },
  }
}

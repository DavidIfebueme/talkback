import type { BatterySnapshot, BatteryThresholdEvent } from './types'

export class BatteryThresholdTracker {
  private readonly thresholds: number[]
  private readonly triggered = new Set<number>()
  private previousPercent: number | undefined

  constructor(thresholds: number[]) {
    this.thresholds = [...thresholds].sort((left, right) => right - left)
  }

  process(snapshot: BatterySnapshot, now = Date.now()): BatteryThresholdEvent[] {
    if (!snapshot.hasBattery) {
      return []
    }

    const currentPercent = snapshot.percent

    if (this.previousPercent === undefined) {
      this.previousPercent = currentPercent
      return []
    }

    if (currentPercent > this.previousPercent) {
      for (const threshold of this.thresholds) {
        if (currentPercent > threshold) {
          this.triggered.delete(threshold)
        }
      }
    }

    const events: BatteryThresholdEvent[] = []

    for (const threshold of this.thresholds) {
      const crossed = this.previousPercent > threshold && currentPercent <= threshold

      if (crossed && !this.triggered.has(threshold)) {
        this.triggered.add(threshold)
        events.push({
          threshold,
          percent: currentPercent,
          timestamp: now
        })
      }
    }

    this.previousPercent = currentPercent
    return events
  }
}

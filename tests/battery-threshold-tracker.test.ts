import { describe, expect, it } from 'vitest'

import { BatteryThresholdTracker } from '../src/main/battery-detection/threshold-tracker'

describe('BatteryThresholdTracker', () => {
  it('emits threshold events only on downward crossings', () => {
    const tracker = new BatteryThresholdTracker([20, 10, 5])

    expect(
      tracker.process(
        {
          hasBattery: true,
          isCharging: false,
          percent: 25
        },
        1000
      )
    ).toEqual([])

    const first = tracker.process(
      {
        hasBattery: true,
        isCharging: false,
        percent: 19
      },
      2000
    )

    expect(first.map((entry) => entry.threshold)).toEqual([20])

    const second = tracker.process(
      {
        hasBattery: true,
        isCharging: false,
        percent: 9
      },
      3000
    )

    expect(second.map((entry) => entry.threshold)).toEqual([10])
  })

  it('triggers each threshold once per discharge cycle and resets after recharge above threshold', () => {
    const tracker = new BatteryThresholdTracker([20])

    tracker.process({ hasBattery: true, isCharging: false, percent: 25 }, 1000)
    const firstCross = tracker.process({ hasBattery: true, isCharging: false, percent: 19 }, 2000)
    const repeatedLow = tracker.process({ hasBattery: true, isCharging: false, percent: 18 }, 3000)
    const recharge = tracker.process({ hasBattery: true, isCharging: true, percent: 23 }, 4000)
    const secondCross = tracker.process({ hasBattery: true, isCharging: false, percent: 19 }, 5000)

    expect(firstCross.map((entry) => entry.threshold)).toEqual([20])
    expect(repeatedLow).toEqual([])
    expect(recharge).toEqual([])
    expect(secondCross.map((entry) => entry.threshold)).toEqual([20])
  })
})

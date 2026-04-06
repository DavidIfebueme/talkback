import type { BatteryProvider, BatterySnapshot } from './types'

type SiBatteryResult = {
  hasBattery: boolean
  isCharging: boolean
  percent: number
}

export class SystemInformationBatteryProvider implements BatteryProvider {
  async read(): Promise<BatterySnapshot> {
    const si = await import('systeminformation')
    const battery = (await si.battery()) as SiBatteryResult

    return {
      hasBattery: battery.hasBattery,
      isCharging: battery.isCharging,
      percent: battery.percent
    }
  }
}

export interface BatterySnapshot {
  hasBattery: boolean
  isCharging: boolean
  percent: number
}

export interface BatteryProvider {
  read(): Promise<BatterySnapshot>
}

export interface BatteryThresholdEvent {
  threshold: number
  percent: number
  timestamp: number
}

export interface BatteryPersonalityConfig {
  thresholds: number[]
  pollIntervalMs: number
  pregenSourceThreshold: number
  pregenTargetThreshold: number
  voiceId: string
  modelId: string
}

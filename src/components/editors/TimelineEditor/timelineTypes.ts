export type TimelinePresetId =
  | 'fade'
  | 'float'
  | 'slide'
  | 'zoom'
  | 'spin'
  | 'bounce'
  | 'pop'
  | 'wipe'
  | 'heartbeat'
  | 'jiggle'

export type TimelineStartMode = 'afterPrevious' | 'withPrevious' | 'custom'

export interface TimelineLayerOption {
  id: string
  elementId: string
  name: string
  type?: string
}

export interface TimelineAnimationStep {
  id: string
  layerId: string
  elementId: string
  layerName: string
  presetId: TimelinePresetId
  startMode: TimelineStartMode
  startTime: number
  duration: number
  pauseAfter: number
}

export interface TimelineValidationResult {
  isValid: boolean
  errors: string[]
}

import type { TimelinePresetId } from './timelineTypes'

export interface TimelinePreset {
  id: TimelinePresetId
  name: string
  description: string
  icon: string
  fromVars: Record<string, string | number | boolean>
  toVars: Record<string, string | number | boolean>
}

export const TIMELINE_PRESETS: TimelinePreset[] = [
  {
    id: 'fade',
    name: 'Fade',
    description: 'Soft opacity entrance.',
    icon: 'F',
    fromVars: { opacity: 0 },
    toVars: { opacity: 1 }
  },
  {
    id: 'float',
    name: 'Float',
    description: 'Rise into place.',
    icon: '↑',
    fromVars: { opacity: 0, y: 48 },
    toVars: { opacity: 1, y: 0 }
  },
  {
    id: 'slide',
    name: 'Slide',
    description: 'Move from the side.',
    icon: '→',
    fromVars: { opacity: 0, x: -64 },
    toVars: { opacity: 1, x: 0 }
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Scale up cleanly.',
    icon: 'Z',
    fromVars: { opacity: 0, scale: 0.72 },
    toVars: { opacity: 1, scale: 1 }
  },
  {
    id: 'spin',
    name: 'Spin',
    description: 'Rotate into frame.',
    icon: '↻',
    fromVars: { opacity: 0, rotation: -22 },
    toVars: { opacity: 1, rotation: 0 }
  },
  {
    id: 'bounce',
    name: 'Bounce',
    description: 'Playful vertical pop.',
    icon: '↧',
    fromVars: { opacity: 0, y: -42, scale: 0.92 },
    toVars: { opacity: 1, y: 0, scale: 1, ease: 'bounce.out' }
  },
  {
    id: 'pop',
    name: 'Pop',
    description: 'Quick scale emphasis.',
    icon: 'P',
    fromVars: { opacity: 0, scale: 0.5 },
    toVars: { opacity: 1, scale: 1, ease: 'back.out(1.7)' }
  },
  {
    id: 'wipe',
    name: 'Wipe',
    description: 'Horizontal reveal motion.',
    icon: 'W',
    fromVars: { opacity: 0, x: -28, scaleX: 0.75 },
    toVars: { opacity: 1, x: 0, scaleX: 1 }
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    description: 'Short pulse loop feel.',
    icon: 'H',
    fromVars: { opacity: 1, scale: 0.92 },
    toVars: { opacity: 1, scale: 1.08, yoyo: true, repeat: 1 }
  },
  {
    id: 'jiggle',
    name: 'Jiggle',
    description: 'Small attention shake.',
    icon: 'J',
    fromVars: { opacity: 1, rotation: -4 },
    toVars: { opacity: 1, rotation: 4, yoyo: true, repeat: 3 }
  }
]

export const DEFAULT_TIMELINE_PRESET_ID: TimelinePresetId = 'fade'

/**
 * Finds a supported timeline preset by id.
 *
 * @param presetId - Preset identifier selected in the visual editor.
 * @returns The matching preset definition.
 *
 * @example
 * const preset = getTimelinePreset('fade')
 */
export const getTimelinePreset = (presetId: TimelinePresetId): TimelinePreset => {
  try {
    const preset = TIMELINE_PRESETS.find((candidatePreset) => candidatePreset.id === presetId)

    if (!preset) {
      throw new Error(`Unsupported timeline preset: ${presetId}`)
    }

    return preset
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to resolve timeline preset.')
  }
}

/**
 * Checks whether a value is a known preset id.
 *
 * @param presetId - Unknown preset id candidate.
 * @returns True when the preset exists.
 *
 * @example
 * const isSupported = isTimelinePresetId('slide')
 */
export const isTimelinePresetId = (presetId: string): presetId is TimelinePresetId => {
  try {
    return TIMELINE_PRESETS.some((preset) => preset.id === presetId)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to validate timeline preset id.')
  }
}

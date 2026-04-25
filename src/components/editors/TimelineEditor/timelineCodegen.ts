import { DEFAULT_TIMELINE_PRESET_ID, getTimelinePreset, isTimelinePresetId } from './timelinePresets'
import type { TimelineAnimationStep, TimelineLayerOption, TimelineStartMode, TimelineValidationResult } from './timelineTypes'

const VISUAL_TIMELINE_METADATA_PREFIX = 'VISUAL_TIMELINE_STEPS:'
const VISUAL_TIMELINE_METADATA_PATTERN = /\/\*\s*VISUAL_TIMELINE_STEPS:([\s\S]*?)\s*\*\//
const DEFAULT_DURATION_SECONDS = 0.8

const roundTimelineValue = (value: number): number => {
  try {
    return Number(value.toFixed(2))
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to round timeline value.')
  }
}

const escapeJavaScriptString = (value: string): string => {
  try {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to escape timeline selector.')
  }
}

const serializeGsapValue = (value: string | number | boolean): string => {
  try {
    return typeof value === 'string' ? `'${escapeJavaScriptString(value)}'` : String(value)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to serialize GSAP value.')
  }
}

const serializeGsapVars = (vars: Record<string, string | number | boolean>): string => {
  try {
    const entries = Object.entries(vars).map(([key, value]) => `${key}: ${serializeGsapValue(value)}`)
    return `{ ${entries.join(', ')} }`
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to serialize GSAP vars.')
  }
}

const normalizeTimelineNumber = (value: unknown, fallback: number): number => {
  try {
    const numericValue = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numericValue) ? roundTimelineValue(numericValue) : fallback
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to normalize timeline number.')
  }
}

const normalizeStartMode = (startMode: unknown): TimelineStartMode => {
  try {
    return startMode === 'withPrevious' || startMode === 'custom' ? startMode : 'afterPrevious'
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to normalize timeline start mode.')
  }
}

const encodeTimelineMetadata = (steps: TimelineAnimationStep[]): string => {
  try {
    return `/* ${VISUAL_TIMELINE_METADATA_PREFIX}${encodeURIComponent(JSON.stringify(steps))} */`
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to encode timeline metadata.')
  }
}

/**
 * Creates a default visual animation step for a layer.
 *
 * @param layer - Layer selected in the studio.
 * @param index - Step order in the timeline.
 * @returns A timeline animation step ready for editing.
 *
 * @example
 * const step = createDefaultTimelineStep(layer, 0)
 */
export const createDefaultTimelineStep = (layer: TimelineLayerOption, index = 0): TimelineAnimationStep => {
  try {
    return {
      id: `timeline-step-${Date.now()}-${index}`,
      layerId: layer.id,
      elementId: layer.elementId,
      layerName: layer.name,
      presetId: DEFAULT_TIMELINE_PRESET_ID,
      startMode: index === 0 ? 'custom' : 'afterPrevious',
      startTime: index === 0 ? 0 : roundTimelineValue(index * DEFAULT_DURATION_SECONDS),
      duration: DEFAULT_DURATION_SECONDS,
      pauseAfter: 0.2
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to create timeline step.')
  }
}

/**
 * Validates visual timeline steps before GSAP code generation.
 *
 * @param steps - Timeline steps from the visual editor.
 * @param layers - Current studio layers available for animation.
 * @returns Validation result with user-facing errors.
 *
 * @example
 * const result = validateTimelineSteps(steps, layers)
 */
export const validateTimelineSteps = (
  steps: TimelineAnimationStep[],
  layers: TimelineLayerOption[]
): TimelineValidationResult => {
  try {
    const layerIds = new Set(layers.map((layer) => layer.id))
    const errors: string[] = []

    steps.forEach((step, index) => {
      if (!layerIds.has(step.layerId)) {
        errors.push(`Step ${index + 1}: selected layer is no longer available.`)
      }

      if (!isTimelinePresetId(step.presetId)) {
        errors.push(`Step ${index + 1}: selected animation preset is not supported.`)
      }

      if (!Number.isFinite(step.duration) || step.duration <= 0) {
        errors.push(`Step ${index + 1}: duration must be greater than 0 seconds.`)
      }

      if (!Number.isFinite(step.pauseAfter) || step.pauseAfter < 0) {
        errors.push(`Step ${index + 1}: pause after playback cannot be negative.`)
      }

      if (step.startMode === 'custom' && (!Number.isFinite(step.startTime) || step.startTime < 0)) {
        errors.push(`Step ${index + 1}: custom start time cannot be negative.`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to validate timeline steps.')
  }
}

/**
 * Converts visual timeline steps to a GSAP chain string used by the existing project runtime.
 *
 * @param steps - Valid visual timeline steps.
 * @param layers - Current studio layers.
 * @returns GSAP chain string with embedded visual metadata.
 *
 * @example
 * const code = generateTimelineCode(steps, layers)
 */
export const generateTimelineCode = (steps: TimelineAnimationStep[], layers: TimelineLayerOption[]): string => {
  try {
    const validation = validateTimelineSteps(steps, layers)

    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '))
    }

    if (steps.length === 0) {
      return ''
    }

    let cursorTime = 0
    let previousStartTime = 0
    let visualEndTime = 0
    let totalEndTime = 0
    const lines = [encodeTimelineMetadata(steps)]

    steps.forEach((step, index) => {
      const preset = getTimelinePreset(step.presetId)
      const startTime = (() => {
        if (step.startMode === 'custom') {
          return roundTimelineValue(step.startTime)
        }

        if (step.startMode === 'withPrevious' && index > 0) {
          return previousStartTime
        }

        return cursorTime
      })()
      const duration = roundTimelineValue(step.duration)
      const pauseAfter = roundTimelineValue(step.pauseAfter)
      const selector = `#${escapeJavaScriptString(step.elementId)}`
      const toVars = {
        ...preset.toVars,
        duration
      }

      lines.push(
        `.fromTo('${selector}', ${serializeGsapVars(preset.fromVars)}, ${serializeGsapVars(toVars)}, ${startTime})`
      )

      const stepEndTime = roundTimelineValue(startTime + duration)
      const stepEndWithPause = roundTimelineValue(stepEndTime + pauseAfter)
      previousStartTime = startTime
      visualEndTime = Math.max(visualEndTime, stepEndTime)
      totalEndTime = Math.max(totalEndTime, stepEndWithPause)
      cursorTime = Math.max(cursorTime, stepEndWithPause)
    })

    if (totalEndTime > visualEndTime) {
      lines.push(`.to({}, { duration: ${roundTimelineValue(totalEndTime - visualEndTime)} }, ${roundTimelineValue(visualEndTime)})`)
    }

    return lines.join('\n')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to generate visual timeline code.')
  }
}

/**
 * Reads visual timeline metadata from previously generated GSAP code.
 *
 * @param code - Existing project animation code.
 * @param layers - Current studio layers used to refresh layer names and element ids.
 * @returns Restored visual timeline steps, or an empty array when no metadata exists.
 *
 * @example
 * const steps = parseTimelineStepsFromCode(code, layers)
 */
export const parseTimelineStepsFromCode = (code: string, layers: TimelineLayerOption[]): TimelineAnimationStep[] => {
  try {
    const match = code.match(VISUAL_TIMELINE_METADATA_PATTERN)

    if (!match?.[1]) {
      return []
    }

    const parsedSteps = JSON.parse(decodeURIComponent(match[1])) as TimelineAnimationStep[]
    const layersById = new Map(layers.map((layer) => [layer.id, layer]))

    return parsedSteps
      .filter((step) => layersById.has(step.layerId))
      .map((step, index) => {
        const layer = layersById.get(step.layerId)

        if (!layer) {
          throw new Error(`Timeline layer is missing for step ${index + 1}.`)
        }

        return {
          ...step,
          id: step.id || `timeline-step-${Date.now()}-${index}`,
          layerName: layer.name,
          elementId: layer.elementId,
          presetId: isTimelinePresetId(step.presetId) ? step.presetId : DEFAULT_TIMELINE_PRESET_ID,
          startMode: normalizeStartMode(step.startMode),
          startTime: normalizeTimelineNumber(step.startTime, 0),
          duration: Math.max(0.1, normalizeTimelineNumber(step.duration, DEFAULT_DURATION_SECONDS)),
          pauseAfter: Math.max(0, normalizeTimelineNumber(step.pauseAfter, 0))
        }
      })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to parse visual timeline metadata.')
  }
}

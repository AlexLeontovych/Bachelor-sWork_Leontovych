import { describe, expect, it } from 'vitest'
import {
  createDefaultTimelineStep,
  generateTimelineCode,
  parseTimelineStepsFromCode,
  validateTimelineSteps
} from '../timelineCodegen'
import type { TimelineAnimationStep, TimelineLayerOption } from '../timelineTypes'

const layers: TimelineLayerOption[] = [
  {
    id: 'layer-1',
    elementId: 'element-id-1',
    name: 'Hero'
  },
  {
    id: 'layer-2',
    elementId: 'element-id-2',
    name: 'CTA'
  }
]

const createStep = (overrides: Partial<TimelineAnimationStep> = {}): TimelineAnimationStep => ({
  id: 'step-1',
  layerId: 'layer-1',
  elementId: 'element-id-1',
  layerName: 'Hero',
  presetId: 'fade',
  startMode: 'custom',
  startTime: 0,
  duration: 0.8,
  pauseAfter: 0.2,
  ...overrides
})

describe('timelineCodegen', () => {
  it('creates a default step for a selected layer', () => {
    const step = createDefaultTimelineStep(layers[0], 0)

    expect(step.layerId).toBe('layer-1')
    expect(step.elementId).toBe('element-id-1')
    expect(step.startMode).toBe('custom')
    expect(step.duration).toBe(0.8)
  })

  it('generates readable GSAP code for sequential steps with pause timing', () => {
    const code = generateTimelineCode([
      createStep(),
      createStep({
        id: 'step-2',
        layerId: 'layer-2',
        elementId: 'element-id-2',
        layerName: 'CTA',
        presetId: 'slide',
        startMode: 'afterPrevious',
        duration: 1,
        pauseAfter: 0.3
      })
    ], layers)

    expect(code).toContain('VISUAL_TIMELINE_STEPS')
    expect(code).toContain(".fromTo('#element-id-1'")
    expect(code).toContain(".fromTo('#element-id-2'")
    expect(code).toContain('{ opacity: 1, x: 0, duration: 1 }')
    expect(code).toContain(', 1)')
    expect(code).toContain('.to({}, { duration: 0.3 }, 2)')
  })

  it('generates together animations using the previous start time', () => {
    const code = generateTimelineCode([
      createStep({ duration: 1.2, pauseAfter: 0 }),
      createStep({
        id: 'step-2',
        layerId: 'layer-2',
        elementId: 'element-id-2',
        layerName: 'CTA',
        presetId: 'zoom',
        startMode: 'withPrevious',
        duration: 0.6,
        pauseAfter: 0
      })
    ], layers)

    expect(code).toContain(".fromTo('#element-id-2'")
    expect(code).toContain(', 0)')
  })

  it('preserves custom start time', () => {
    const code = generateTimelineCode([
      createStep({
        startMode: 'custom',
        startTime: 1.5
      })
    ], layers)

    expect(code).toContain(', 1.5)')
  })

  it('parses visual timeline metadata from generated code', () => {
    const steps = [
      createStep(),
      createStep({
        id: 'step-2',
        layerId: 'layer-2',
        elementId: 'element-id-2',
        layerName: 'Old CTA',
        presetId: 'pop',
        startMode: 'afterPrevious'
      })
    ]
    const code = generateTimelineCode(steps, layers)
    const parsedSteps = parseTimelineStepsFromCode(code, layers)

    expect(parsedSteps).toHaveLength(2)
    expect(parsedSteps[1].layerName).toBe('CTA')
    expect(parsedSteps[1].presetId).toBe('pop')
  })

  it('returns validation errors for invalid steps', () => {
    const validation = validateTimelineSteps([
      createStep({
        layerId: 'missing-layer',
        duration: 0,
        pauseAfter: -1
      })
    ], layers)

    expect(validation.isValid).toBe(false)
    expect(validation.errors).toHaveLength(3)
  })
})

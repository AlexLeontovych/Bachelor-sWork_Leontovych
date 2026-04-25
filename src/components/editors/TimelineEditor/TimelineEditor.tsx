import { useMemo, useState } from 'react'
import { Clock3, Layers, Play, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { TIMELINE_PRESETS } from './timelinePresets'
import {
  createDefaultTimelineStep,
  generateTimelineCode,
  parseTimelineStepsFromCode,
  validateTimelineSteps
} from './timelineCodegen'
import type { TimelineAnimationStep, TimelineLayerOption, TimelinePresetId, TimelineStartMode } from './timelineTypes'
import './TimelineEditor.css'

interface StudioLayerInput {
  id: string
  elementId?: string
  name?: string
  type?: string
}

interface TimelineEditorProps {
  code: string
  images: StudioLayerInput[]
  onApplyCode: (nextCode: string) => void
  onPreviewCode: (nextCode: string) => void
  onClose: () => void
}

interface TimelinePosition {
  id: string
  start: number
  end: number
}

const getLayerOptions = (images: StudioLayerInput[]): TimelineLayerOption[] => {
  try {
    return images.map((image, index) => ({
      id: image.id,
      elementId: image.elementId || image.id,
      name: image.name || `Layer ${index + 1}`,
      type: image.type
    }))
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to prepare timeline layers.')
  }
}

const calculateStepPositions = (steps: TimelineAnimationStep[]): TimelinePosition[] => {
  try {
    let cursorTime = 0
    let previousStartTime = 0

    return steps.map((step, index) => {
      const start = (() => {
        if (step.startMode === 'custom') {
          return step.startTime
        }

        if (step.startMode === 'withPrevious' && index > 0) {
          return previousStartTime
        }

        return cursorTime
      })()
      const end = start + step.duration

      previousStartTime = start
      cursorTime = Math.max(cursorTime, end + step.pauseAfter)

      return {
        id: step.id,
        start,
        end
      }
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to calculate timeline positions.')
  }
}

const formatSeconds = (value: number): string => {
  try {
    return `${value.toFixed(1)}s`
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to format timeline seconds.')
  }
}

const normalizeNumberInput = (value: string, fallback: number): number => {
  try {
    const nextValue = Number(value)
    return Number.isFinite(nextValue) ? nextValue : fallback
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to normalize timeline input.')
  }
}

const TimelineEditor = ({
  code,
  images,
  onApplyCode,
  onPreviewCode,
  onClose
}: TimelineEditorProps) => {
  const layers = useMemo(() => getLayerOptions(images), [images])
  const restoredSteps = useMemo(() => {
    try {
      return parseTimelineStepsFromCode(code, layers)
    } catch {
      return []
    }
  }, [code, layers])
  const [steps, setSteps] = useState<TimelineAnimationStep[]>(restoredSteps)
  const [selectedLayerId, setSelectedLayerId] = useState(layers[0]?.id || '')
  const [selectedStepId, setSelectedStepId] = useState(restoredSteps[0]?.id || '')
  const [editorError, setEditorError] = useState('')

  const selectedStep = steps.find((step) => step.id === selectedStepId) || steps[0] || null
  const selectedPreset = TIMELINE_PRESETS.find((preset) => preset.id === selectedStep?.presetId) || TIMELINE_PRESETS[0]
  const positions = useMemo(() => calculateStepPositions(steps), [steps])
  const timelineDuration = Math.max(
    1,
    ...positions.map((position) => position.end),
    ...steps.map((step) => step.startTime + step.duration + step.pauseAfter)
  )
  const validation = validateTimelineSteps(steps, layers)

  const updateStep = (stepId: string, patch: Partial<TimelineAnimationStep>) => {
    try {
      setEditorError('')
      setSteps((currentSteps) => currentSteps.map((step) => (
        step.id === stepId ? { ...step, ...patch } : step
      )))
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to update animation step.')
    }
  }

  const handleAddStep = () => {
    try {
      setEditorError('')
      const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) || layers[0]

      if (!selectedLayer) {
        setEditorError('Add at least one layer before creating an animation.')
        return
      }

      const nextStep = createDefaultTimelineStep(selectedLayer, steps.length)
      setSteps((currentSteps) => [...currentSteps, nextStep])
      setSelectedStepId(nextStep.id)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to add animation step.')
    }
  }

  const handleRemoveStep = (stepId: string) => {
    try {
      setEditorError('')
      setSteps((currentSteps) => {
        const nextSteps = currentSteps.filter((step) => step.id !== stepId)
        setSelectedStepId(nextSteps[0]?.id || '')
        return nextSteps
      })
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to remove animation step.')
    }
  }

  const handleGenerateCode = (): string | null => {
    try {
      setEditorError('')
      const nextCode = generateTimelineCode(steps, layers)
      return nextCode
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to generate animation code.')
      return null
    }
  }

  const handlePreview = () => {
    try {
      const nextCode = handleGenerateCode()

      if (nextCode === null) {
        return
      }

      onPreviewCode(nextCode)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to preview timeline.')
    }
  }

  const handleApply = () => {
    try {
      const nextCode = handleGenerateCode()

      if (nextCode === null) {
        return
      }

      onApplyCode(nextCode)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to apply timeline.')
    }
  }

  return (
    <div className="timeline-editor-overlay" onClick={onClose}>
      <div className="timeline-editor-modal" onClick={(event) => event.stopPropagation()}>
        <header className="timeline-editor-header">
          <div>
            <span className="timeline-editor-eyebrow">
              <Sparkles size={14} />
              Visual timeline
            </span>
            <h2>Motion builder</h2>
            <p>Choose an element, pick an animation, set duration and pause, then combine motions without code.</p>
          </div>
          <button type="button" className="timeline-editor-close" onClick={onClose} aria-label="Close timeline editor">
            <X size={18} />
          </button>
        </header>

        <div className="timeline-editor-body">
          <aside className="timeline-editor-layers">
            <div className="timeline-editor-panel-title">
              <Layers size={14} />
              Elements
            </div>

            <div className="timeline-editor-layer-list">
              {layers.length > 0 ? layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={`timeline-editor-layer ${selectedLayerId === layer.id ? 'active' : ''}`}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  <span>{layer.name}</span>
                  <small>#{layer.elementId}</small>
                </button>
              )) : (
                <div className="timeline-editor-empty">Add image or text layers before building a timeline.</div>
              )}
            </div>

            <button type="button" className="timeline-editor-add" onClick={handleAddStep} disabled={layers.length === 0}>
              <Plus size={15} />
              Add animation
            </button>
          </aside>

          <main className="timeline-editor-stage">
            <section className="timeline-editor-track-panel">
              <div className="timeline-editor-track-header">
                <span>Timeline</span>
                <strong>0.0s - {formatSeconds(timelineDuration)}</strong>
              </div>

              <div className="timeline-editor-step-list">
                {steps.length > 0 ? steps.map((step) => {
                  const position = positions.find((candidatePosition) => candidatePosition.id === step.id)
                  const left = position ? (position.start / timelineDuration) * 100 : 0
                  const width = position ? Math.max(4, ((position.end - position.start) / timelineDuration) * 100) : 8

                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={`timeline-editor-row ${selectedStepId === step.id ? 'active' : ''}`}
                      onClick={() => setSelectedStepId(step.id)}
                    >
                      <span className="timeline-editor-row-name">{step.layerName}</span>
                      <span className="timeline-editor-track">
                        <span className="timeline-editor-segment" style={{ left: `${left}%`, width: `${width}%` }} />
                      </span>
                      <span className="timeline-editor-row-meta">
                        {step.presetId} · {formatSeconds(step.duration)}
                      </span>
                    </button>
                  )
                }) : (
                  <div className="timeline-editor-empty large">Select an element and add the first animation step.</div>
                )}
              </div>
            </section>
          </main>

          <aside className="timeline-editor-settings">
            <div className="timeline-editor-panel-title">
              <Clock3 size={14} />
              Animation setup
            </div>

            {selectedStep ? (
              <>
                <label className="timeline-editor-field">
                  <span>Element</span>
                  <select
                    value={selectedStep.layerId}
                    onChange={(event) => {
                      const nextLayer = layers.find((layer) => layer.id === event.target.value)

                      if (nextLayer) {
                        updateStep(selectedStep.id, {
                          layerId: nextLayer.id,
                          elementId: nextLayer.elementId,
                          layerName: nextLayer.name
                        })
                      }
                    }}
                  >
                    {layers.map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                </label>

                <div className="timeline-editor-preset-grid">
                  {TIMELINE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`timeline-editor-preset ${selectedStep.presetId === preset.id ? 'active' : ''}`}
                      onClick={() => updateStep(selectedStep.id, { presetId: preset.id as TimelinePresetId })}
                      title={preset.description}
                    >
                      <span>{preset.icon}</span>
                      <strong>{preset.name}</strong>
                    </button>
                  ))}
                </div>

                <label className="timeline-editor-field">
                  <span>Start mode</span>
                  <select
                    value={selectedStep.startMode}
                    onChange={(event) => updateStep(selectedStep.id, { startMode: event.target.value as TimelineStartMode })}
                  >
                    <option value="afterPrevious">After previous</option>
                    <option value="withPrevious">With previous</option>
                    <option value="custom">Custom time</option>
                  </select>
                </label>

                <div className="timeline-editor-field-grid">
                  <label className="timeline-editor-field">
                    <span>Start, s</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedStep.startTime}
                      disabled={selectedStep.startMode !== 'custom'}
                      onChange={(event) => updateStep(selectedStep.id, {
                        startTime: normalizeNumberInput(event.target.value, selectedStep.startTime)
                      })}
                    />
                  </label>

                  <label className="timeline-editor-field">
                    <span>Duration, s</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={selectedStep.duration}
                      onChange={(event) => updateStep(selectedStep.id, {
                        duration: normalizeNumberInput(event.target.value, selectedStep.duration)
                      })}
                    />
                  </label>
                </div>

                <label className="timeline-editor-field">
                  <span>Pause after playback, s</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selectedStep.pauseAfter}
                    onChange={(event) => updateStep(selectedStep.id, {
                      pauseAfter: normalizeNumberInput(event.target.value, selectedStep.pauseAfter)
                    })}
                  />
                </label>

                <div className="timeline-editor-selected-summary">
                  <strong>{selectedPreset.name}</strong>
                  <span>{selectedPreset.description}</span>
                </div>

                <button type="button" className="timeline-editor-delete" onClick={() => handleRemoveStep(selectedStep.id)}>
                  <Trash2 size={14} />
                  Remove selected animation
                </button>
              </>
            ) : (
              <div className="timeline-editor-empty">Add an animation step to unlock timing controls.</div>
            )}
          </aside>
        </div>

        {(editorError || validation.errors.length > 0) && (
          <div className="timeline-editor-error">
            {editorError || validation.errors[0]}
          </div>
        )}

        <footer className="timeline-editor-footer">
          <button type="button" className="timeline-editor-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="timeline-editor-secondary" onClick={handlePreview} disabled={steps.length === 0}>
            <Play size={14} />
            Preview
          </button>
          <button type="button" className="timeline-editor-primary" onClick={handleApply} disabled={steps.length === 0 || !validation.isValid}>
            Apply timeline
          </button>
        </footer>
      </div>
    </div>
  )
}

export default TimelineEditor

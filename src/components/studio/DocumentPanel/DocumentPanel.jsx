import { useEffect, useState } from 'react'
import { Brush, Clock3, Eye, EyeOff, Image as ImageIcon, Lock, LockOpen, Sparkles, Trash2, Type } from 'lucide-react'
import { CANVAS_DIMENSIONS } from '../../shared/utils/constants'
import { formatFileSize } from '../../shared/utils/helpers'
import './DocumentPanel.css'

const DocumentPanel = ({
  totalCreativeSize,
  onShowJSEditor,
  onShowTimelineEditor,
  onShowCSSEditor,
  selectedImageId,
  sceneBackground,
  sceneBorderStyle,
  sceneBorderColor,
  onSceneBackgroundChange,
  onSceneBorderStyleChange,
  onSceneBorderColorChange,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onDeleteLayer,
  onLayerDragStart,
  onLayerDragOver,
  onLayerDragEnd,
  draggedLayerIndex,
  screenFormat = 'landscape',
  images = []
}) => {
  const [backgroundInputValue, setBackgroundInputValue] = useState(sceneBackground || '#ffffff')
  const [borderColorInputValue, setBorderColorInputValue] = useState(sceneBorderColor || '#000000')
  const canvasDimensions = CANVAS_DIMENSIONS[screenFormat] || CANVAS_DIMENSIONS.landscape

  const buildAspectRatio = (width, height) => {
    const getGreatestCommonDivisor = (left, right) => {
      if (!right) {
        return left
      }

      return getGreatestCommonDivisor(right, left % right)
    }

    const divisor = getGreatestCommonDivisor(width, height)
    return `${width / divisor} : ${height / divisor}`
  }

  useEffect(() => {
    setBackgroundInputValue(sceneBackground || '#ffffff')
  }, [sceneBackground])

  useEffect(() => {
    setBorderColorInputValue(sceneBorderColor || '#000000')
  }, [sceneBorderColor])

  const orderedLayers = [...images].sort((leftLayer, rightLayer) => (rightLayer.zIndex || 0) - (leftLayer.zIndex || 0))

  return (
    <aside className="studio-sidebar studio-document-shell">
      <div className="studio-tab-content">
        <div className="studio-document-panel">
          <section className="studio-document-section">
            <div className="document-section-heading">
              <span className="studio-section-title">Scene layers</span>
              <span className="studio-section-value">{images.length}</span>
            </div>

            {orderedLayers.length > 0 ? (
              <div className="document-layer-list document-layer-list--compact">
                {orderedLayers.map((layer, index) => {
                  const LayerIcon = layer.type === 'text' ? Type : ImageIcon
                  const isSelected = selectedImageId === layer.id
                  const isVisible = layer.visible !== false
                  const isLocked = Boolean(layer.locked)

                  return (
                    <div
                      key={layer.id}
                      className={`document-layer-item ${isSelected ? 'active' : ''} ${layer.visible === false ? 'muted' : ''} ${draggedLayerIndex === layer.zIndex ? 'dragging' : ''}`}
                      draggable={!isLocked}
                      onDragStart={(event) => onLayerDragStart?.(event, layer.zIndex)}
                      onDragOver={(event) => onLayerDragOver?.(event, layer.zIndex)}
                      onDragEnd={onLayerDragEnd}
                      onClick={() => onSelectLayer?.(layer.id)}
                    >
                      <span className="document-layer-index">{index + 1}</span>
                      <span className="document-layer-icon">
                        <LayerIcon size={13} />
                      </span>
                      <span className="document-layer-copy">
                        <strong>{layer.name || 'Untitled layer'}</strong>
                        <small>
                          {layer.type === 'text' ? 'Text' : 'Image'}
                          {layer.locked ? ' · locked' : ''}
                          {layer.visible === false ? ' · hidden' : ''}
                        </small>
                      </span>
                      <span className="document-layer-actions">
                        <button
                          type="button"
                          className={`document-layer-action ${!isVisible ? 'muted' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onToggleLayerVisibility?.(layer.id)
                          }}
                          title={isVisible ? 'Hide layer' : 'Show layer'}
                          aria-label={isVisible ? 'Hide layer' : 'Show layer'}
                        >
                          {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          type="button"
                          className={`document-layer-action ${isLocked ? 'locked' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onToggleLayerLock?.(layer.id)
                          }}
                          title={isLocked ? 'Unlock layer' : 'Lock layer'}
                          aria-label={isLocked ? 'Unlock layer' : 'Lock layer'}
                        >
                          {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                        </button>
                        <button
                          type="button"
                          className="document-layer-action danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDeleteLayer?.(layer.id)
                          }}
                          title="Delete layer"
                          aria-label="Delete layer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="document-empty-state">No layers on the canvas yet.</div>
            )}
          </section>

          <section className="studio-document-section">
            <div className="document-section-heading">
              <span className="studio-section-title">Scene background</span>
            </div>

            <div className="document-control-stack">
              <label className="document-control-row">
                <span>Fill</span>
                <div className="studio-property-controls">
                  <input
                    type="color"
                    className="studio-color-picker"
                    value={(sceneBackground && sceneBackground.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(sceneBackground)) ? sceneBackground : '#ffffff'}
                    onChange={(event) => onSceneBackgroundChange(event.target.value)}
                  />
                  <input
                    type="text"
                    className="studio-color-input"
                    value={backgroundInputValue}
                    onChange={(event) => setBackgroundInputValue(event.target.value)}
                    onBlur={(event) => {
                      let value = event.target.value.trim()

                      if (!value || value === '#') {
                        setBackgroundInputValue(sceneBackground || '#ffffff')
                        return
                      }

                      if (!value.startsWith('#')) {
                        value = `#${value}`
                      }

                      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                        onSceneBackgroundChange(value)
                        setBackgroundInputValue(value)
                      } else if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
                        const [r, g, b] = [value[1], value[2], value[3]]
                        const expandedValue = `#${r}${r}${g}${g}${b}${b}`
                        onSceneBackgroundChange(expandedValue)
                        setBackgroundInputValue(expandedValue)
                      } else {
                        setBackgroundInputValue(sceneBackground || '#ffffff')
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur()
                      }
                    }}
                    placeholder="#ffffff"
                  />
                </div>
              </label>

              <label className="document-control-row">
                <span>Border</span>
                <div className="studio-property-controls">
                  <select
                    className="studio-select"
                    value={sceneBorderStyle}
                    onChange={(event) => onSceneBorderStyleChange(event.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>

                  {sceneBorderStyle !== 'none' && (
                    <>
                      <input
                        type="color"
                        className="studio-color-picker"
                        value={(sceneBorderColor && sceneBorderColor.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(sceneBorderColor)) ? sceneBorderColor : '#000000'}
                        onChange={(event) => onSceneBorderColorChange(event.target.value)}
                      />
                      <input
                        type="text"
                        className="studio-color-input"
                        value={borderColorInputValue}
                        onChange={(event) => setBorderColorInputValue(event.target.value)}
                        onBlur={(event) => {
                          let value = event.target.value.trim()

                          if (!value || value === '#') {
                            setBorderColorInputValue(sceneBorderColor || '#000000')
                            return
                          }

                          if (!value.startsWith('#')) {
                            value = `#${value}`
                          }

                          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                            onSceneBorderColorChange(value)
                            setBorderColorInputValue(value)
                          } else if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
                            const [r, g, b] = [value[1], value[2], value[3]]
                            const expandedValue = `#${r}${r}${g}${g}${b}${b}`
                            onSceneBorderColorChange(expandedValue)
                            setBorderColorInputValue(expandedValue)
                          } else {
                            setBorderColorInputValue(sceneBorderColor || '#000000')
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                        placeholder="#000000"
                      />
                    </>
                  )}
                </div>
              </label>
            </div>
          </section>

          <section className="studio-document-section">
            <div className="document-section-heading">
              <span className="studio-section-title">Creative size</span>
              <span className="studio-section-value">{formatFileSize(totalCreativeSize)}</span>
            </div>

            <div className="document-size-list">
              <div className="document-size-row">
                <span>Width x Height</span>
                <strong>{canvasDimensions.width} x {canvasDimensions.height}</strong>
              </div>

              <div className="document-size-row">
                <span>Aspect ratio</span>
                <strong>{buildAspectRatio(canvasDimensions.width, canvasDimensions.height)}</strong>
              </div>

              <div className="document-size-row">
                <span>Layer count</span>
                <strong>{images.length}</strong>
              </div>
            </div>
          </section>

          <section className="studio-document-section">
            <div className="document-section-heading">
              <span className="studio-section-title">Shortcuts</span>
            </div>

            <div className="document-shortcuts">
              <button type="button" className="document-shortcut-card" onClick={onShowTimelineEditor}>
                <span className="document-shortcut-icon">
                  <Clock3 size={16} />
                </span>
                <span className="document-shortcut-copy">
                  <strong>Visual timeline</strong>
                  <small>Elements, presets, timing</small>
                </span>
              </button>

              <button type="button" className="document-shortcut-card" onClick={onShowJSEditor}>
                <span className="document-shortcut-icon">
                  <Sparkles size={16} />
                </span>
                <span className="document-shortcut-copy">
                  <strong>Motion logic</strong>
                  <small>Keyframes, easing, triggers</small>
                </span>
              </button>

              <button type="button" className="document-shortcut-card" onClick={onShowCSSEditor}>
                <span className="document-shortcut-icon">
                  <Brush size={16} />
                </span>
                <span className="document-shortcut-copy">
                  <strong>Style rules</strong>
                  <small>Presentation tokens and overrides</small>
                </span>
              </button>

            </div>
          </section>
        </div>
      </div>
    </aside>
  )
}

export default DocumentPanel

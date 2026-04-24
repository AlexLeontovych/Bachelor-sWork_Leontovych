import { useEffect, useState } from 'react'
import { Blocks, Brush, Layers3, Sparkles } from 'lucide-react'
import { CANVAS_DIMENSIONS } from '../../shared/utils/constants'
import { formatFileSize } from '../../shared/utils/helpers'
import './DocumentPanel.css'

const DocumentPanel = ({
  totalCreativeSize,
  onShowLayers,
  onShowJSEditor,
  onShowCSSEditor,
  selectedImageId,
  sceneBackground,
  sceneBorderStyle,
  sceneBorderColor,
  onSceneBackgroundChange,
  onSceneBorderStyleChange,
  onSceneBorderColorChange,
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

  return (
    <aside className="studio-sidebar studio-document-shell">
      <div className="studio-tab-content">
        <div className="studio-document-panel">
          <section className="studio-document-section">
            <div className="document-section-heading">
              <span className="studio-section-title">Scene background</span>
            </div>

            <div className="document-metric-grid">
              <div className="document-metric-card">
                <span>Fill</span>
                <strong>{backgroundInputValue || '#ffffff'}</strong>
              </div>

              <div className="document-metric-card">
                <span>Border</span>
                <strong>{sceneBorderStyle === 'none' ? 'Off' : sceneBorderStyle}</strong>
              </div>

              <div className="document-metric-card">
                <span>Border color</span>
                <strong>{sceneBorderStyle === 'none' ? 'None' : borderColorInputValue}</strong>
              </div>

              <div className="document-metric-card">
                <span>Radius</span>
                <strong>18px</strong>
              </div>
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
              <button type="button" className="document-shortcut-card" onClick={onShowLayers}>
                <span className="document-shortcut-icon">
                  <Layers3 size={16} />
                </span>
                <span className="document-shortcut-copy">
                  <strong>Layers</strong>
                  <small>Manage stacking and naming</small>
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

              <div className="document-shortcut-card passive">
                <span className="document-shortcut-icon">
                  <Blocks size={16} />
                </span>
                <span className="document-shortcut-copy">
                  <strong>Current selection</strong>
                  <small>{selectedImageId ? 'Layer is selected' : 'No layer selected'}</small>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </aside>
  )
}

export default DocumentPanel

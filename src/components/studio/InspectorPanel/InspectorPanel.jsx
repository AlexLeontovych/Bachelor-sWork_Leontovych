import { Image as ImageIcon, Type } from 'lucide-react'
import './InspectorPanel.css'

const InspectorPanel = ({ selectedImage, selectedImageId, onUpdateProperty, onScaleImage }) => {
  if (!selectedImage) {
    return (
      <div className="studio-inspector">
        <div className="inspector-header">
          <span className="inspector-kicker">Layer inspector</span>
          <h2 className="inspector-title">Nothing selected</h2>
          <p className="inspector-subtitle">
            Select a layer on the canvas to unlock layout, appearance, and identity controls.
          </p>
        </div>

        <div className="inspector-content">
          <div className="inspector-empty">
            <p>Choose a layer to reveal position, scale, typography, and selector controls.</p>
          </div>
        </div>
      </div>
    )
  }

  const isTextLayer = selectedImage.type === 'text'
  const LayerIcon = isTextLayer ? Type : ImageIcon
  const widthLabel = selectedImage.width || 'auto'
  const heightLabel = selectedImage.height || 'auto'
  const opacityValue = selectedImage.opacity !== undefined ? Math.round((selectedImage.opacity || 0) * 100) : 100

  return (
    <div className="studio-inspector">
      <div className="inspector-header">
        <span className="inspector-kicker">Layer inspector</span>

        <div className="inspector-layer-summary">
          <div className="inspector-layer-icon">
            <LayerIcon size={16} />
          </div>

          <div className="inspector-layer-copy">
            <h2 className="inspector-title">{selectedImage.name || 'Untitled layer'}</h2>
            <p className="inspector-subtitle">
              {isTextLayer ? 'Text layer' : 'Image layer'} · {widthLabel} x {heightLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="inspector-content">
        <section className="inspector-section">
          <div className="inspector-section-heading">Position & size</div>

          <div className="inspector-position-grid">
            <label className="inspector-field">
              <span>X</span>
              <input
                type="number"
                value={selectedImage.x || 0}
                onChange={(event) => onUpdateProperty(selectedImageId, 'x', parseInt(event.target.value, 10) || 0)}
                className="inspector-input"
              />
            </label>

            <label className="inspector-field">
              <span>Y</span>
              <input
                type="number"
                value={selectedImage.y || 0}
                onChange={(event) => onUpdateProperty(selectedImageId, 'y', parseInt(event.target.value, 10) || 0)}
                className="inspector-input"
              />
            </label>

            <label className="inspector-field">
              <span>W</span>
              <input
                type="number"
                value={selectedImage.width || ''}
                onChange={(event) => onUpdateProperty(
                  selectedImageId,
                  'width',
                  event.target.value ? parseInt(event.target.value, 10) : null
                )}
                className="inspector-input"
                placeholder="auto"
              />
            </label>

            <label className="inspector-field">
              <span>H</span>
              <input
                type="number"
                value={selectedImage.height || ''}
                onChange={(event) => onUpdateProperty(
                  selectedImageId,
                  'height',
                  event.target.value ? parseInt(event.target.value, 10) : null
                )}
                className="inspector-input"
                placeholder="auto"
              />
            </label>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-heading">Scale</div>

          <div className="inspector-scale-buttons">
            <button type="button" className="inspector-scale-btn" onClick={() => onScaleImage(0.5)} title="Reduce by half">
              50%
            </button>
            <button type="button" className="inspector-scale-btn" onClick={() => onScaleImage(2)} title="Double size">
              200%
            </button>
          </div>

          <p className="inspector-note">Quick scale actions update the currently selected layer proportionally.</p>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-heading">Appearance</div>

          <div className="inspector-range-row">
            <div className="inspector-range-copy">
              <span>Opacity</span>
              <strong>{opacityValue}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacityValue}
              onChange={(event) => {
                const value = Math.max(0, Math.min(100, parseInt(event.target.value, 10) || 0))
                onUpdateProperty(selectedImageId, 'opacity', value / 100)
              }}
              className="inspector-range"
            />
          </div>

          <div className="inspector-inline-grid">
            <label className="inspector-field">
              <span>Rotation</span>
              <input
                type="number"
                min="-360"
                max="360"
                value={selectedImage.rotation || 0}
                onChange={(event) => {
                  const value = Math.max(-360, Math.min(360, parseInt(event.target.value, 10) || 0))
                  onUpdateProperty(selectedImageId, 'rotation', value)
                }}
                className="inspector-input"
              />
            </label>

            <label className="inspector-field">
              <span>Blend</span>
              <input type="text" value="Normal" className="inspector-input" readOnly />
            </label>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-heading">Identity</div>

          <label className="inspector-field inspector-field-full">
            <span>Layer name</span>
            <input
              type="text"
              value={selectedImage.name || ''}
              onChange={(event) => onUpdateProperty(selectedImageId, 'name', event.target.value)}
              className="inspector-input"
            />
          </label>

          <label className="inspector-field inspector-field-full">
            <span>Element ID</span>
            <input
              type="text"
              value={selectedImage.elementId || ''}
              onChange={(event) => onUpdateProperty(selectedImageId, 'elementId', event.target.value)}
              className="inspector-input"
            />
          </label>

          <label className="inspector-field inspector-field-full">
            <span>Selector</span>
            <input
              type="text"
              value={selectedImage.className || ''}
              onChange={(event) => onUpdateProperty(selectedImageId, 'className', event.target.value)}
              className="inspector-input"
              placeholder=".headline-primary"
            />
          </label>

          <label className="inspector-field inspector-field-full">
            <span>Tracking tag</span>
            <input
              type="text"
              value={selectedImage.trackingId || ''}
              onChange={(event) => onUpdateProperty(selectedImageId, 'trackingId', event.target.value)}
              className="inspector-input"
              placeholder="event:hero_view"
            />
          </label>
        </section>

        {isTextLayer && (
          <section className="inspector-section">
            <div className="inspector-section-heading">Typography</div>

            <label className="inspector-field inspector-field-full">
              <span>Family</span>
              <input
                type="text"
                value={selectedImage.fontFamily || 'Arial'}
                onChange={(event) => onUpdateProperty(selectedImageId, 'fontFamily', event.target.value)}
                className="inspector-input"
              />
            </label>

            <div className="inspector-inline-grid">
              <label className="inspector-field">
                <span>Size</span>
                <input
                  type="number"
                  min="8"
                  max="240"
                  value={selectedImage.fontSize || 16}
                  onChange={(event) => onUpdateProperty(selectedImageId, 'fontSize', parseInt(event.target.value, 10) || 16)}
                  className="inspector-input"
                />
              </label>

              <label className="inspector-field">
                <span>Weight</span>
                <select
                  value={selectedImage.fontWeight || 'normal'}
                  onChange={(event) => onUpdateProperty(selectedImageId, 'fontWeight', event.target.value)}
                  className="inspector-input inspector-select"
                >
                  <option value="normal">Normal</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                </select>
              </label>
            </div>

            <div className="inspector-inline-grid">
              <label className="inspector-field">
                <span>Align</span>
                <select
                  value={selectedImage.textAlign || 'left'}
                  onChange={(event) => onUpdateProperty(selectedImageId, 'textAlign', event.target.value)}
                  className="inspector-input inspector-select"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="inspector-field">
                <span>Color</span>
                <input
                  type="color"
                  value={selectedImage.color || '#ffffff'}
                  onChange={(event) => onUpdateProperty(selectedImageId, 'color', event.target.value)}
                  className="inspector-color"
                />
              </label>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default InspectorPanel


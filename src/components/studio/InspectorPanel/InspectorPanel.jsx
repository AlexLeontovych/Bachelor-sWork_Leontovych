import './InspectorPanel.css'

const InspectorPanel = ({ selectedImage, selectedImageId, onUpdateProperty, onScaleImage }) => {
  if (!selectedImage) {
    return (
      <div className="studio-inspector">
        <div className="inspector-header">
          <h2 className="inspector-title">Inspector</h2>
        </div>
        <div className="inspector-content">
          <div className="inspector-empty">
            Select an element to edit
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="studio-inspector">
      <div className="inspector-header">
        <h2 className="inspector-title">Inspector</h2>
      </div>
      <div className="inspector-content">
        <div className="inspector-section">
          <div className="inspector-position-size">
            <div className="inspector-input-group">
              <label>X:</label>
              <input
                type="number"
                value={selectedImage.x || 0}
                onChange={(e) => onUpdateProperty(selectedImageId, 'x', parseInt(e.target.value) || 0)}
                className="inspector-input"
              />
            </div>
            <div className="inspector-input-group">
              <label>Y:</label>
              <input
                type="number"
                value={selectedImage.y || 0}
                onChange={(e) => onUpdateProperty(selectedImageId, 'y', parseInt(e.target.value) || 0)}
                className="inspector-input"
              />
            </div>
            <div className="inspector-input-group">
              <label>W:</label>
              <input
                type="number"
                value={selectedImage.width || ''}
                onChange={(e) => onUpdateProperty(selectedImageId, 'width', e.target.value ? parseInt(e.target.value) : null)}
                className="inspector-input"
                placeholder="auto"
              />
            </div>
            <div className="inspector-input-group">
              <label>H:</label>
              <input
                type="number"
                value={selectedImage.height || ''}
                onChange={(e) => onUpdateProperty(selectedImageId, 'height', e.target.value ? parseInt(e.target.value) : null)}
                className="inspector-input"
                placeholder="auto"
              />
            </div>
          </div>
          <div className="inspector-scale-buttons">
            <button 
              className="inspector-scale-btn"
              onClick={() => onScaleImage(0.5)}
              title="Reduce by half"
            >
              ×0.5
            </button>
            <button 
              className="inspector-scale-btn"
              onClick={() => onScaleImage(2)}
              title="Double size"
            >
              ×2
            </button>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-transform-controls">
            <div className="inspector-transform-row">
              <div className="inspector-transform-icon">⊞</div>
              <div className="inspector-transform-input-group">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedImage.opacity !== undefined ? Math.round((selectedImage.opacity || 0) * 100) : 100}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                    onUpdateProperty(selectedImageId, 'opacity', value / 100)
                  }}
                  className="inspector-transform-input"
                />
                <span className="inspector-transform-unit">%</span>
              </div>
              <div className="inspector-transform-icon-small">▲</div>
              <div className="inspector-transform-input-group">
                <input
                  type="number"
                  min="-360"
                  max="360"
                  value={selectedImage.rotation || 0}
                  onChange={(e) => {
                    const value = Math.max(-360, Math.min(360, parseInt(e.target.value) || 0))
                    onUpdateProperty(selectedImageId, 'rotation', value)
                  }}
                  className="inspector-transform-input"
                />
                <span className="inspector-transform-unit">°</span>
              </div>
            </div>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-input-group-full">
            <label>Element ID:</label>
            <input
              type="text"
              value={selectedImage.elementId || ''}
              onChange={(e) => onUpdateProperty(selectedImageId, 'elementId', e.target.value)}
              className="inspector-input-full"
            />
          </div>
          <div className="inspector-input-group-full">
            <label>Class:</label>
            <input
              type="text"
              value={selectedImage.className || ''}
              onChange={(e) => onUpdateProperty(selectedImageId, 'className', e.target.value)}
              className="inspector-input-full"
              placeholder="Class names"
            />
          </div>
          <div className="inspector-input-group-full">
            <label>Tracking ID:</label>
            <input
              type="text"
              value={selectedImage.trackingId || ''}
              onChange={(e) => onUpdateProperty(selectedImageId, 'trackingId', e.target.value)}
              className="inspector-input-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default InspectorPanel


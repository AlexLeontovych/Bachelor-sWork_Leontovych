import './LayersWindow.css'

const LayersWindow = ({
  images,
  selectedImageId,
  editingLayerId,
  draggedLayerIndex,
  layersWindowPosition,
  draggingLayersWindow,
  onClose,
  onSelectImage,
  onRenameLayer,
  onDeleteLayer,
  onLayerDragStart,
  onLayerDragOver,
  onLayerDragEnd,
  onWindowDragStart,
  onSetEditingId,
  onUpdateImageName
}) => {
  return (
    <div 
      className="layers-window"
      style={{
        left: `${layersWindowPosition.x}px`,
        top: `${layersWindowPosition.y}px`
      }}
    >
      <div 
        className="layers-window-header"
        onMouseDown={onWindowDragStart}
        style={{ cursor: draggingLayersWindow ? 'grabbing' : 'move' }}
      >
        <h2 className="layers-window-title">Layers</h2>
        <button className="layers-window-close" onClick={onClose}>×</button>
      </div>
      <div className="layers-window-filter">
        <input
          type="text"
          placeholder="Filter by..."
          className="layers-window-filter-input"
        />
        <button className="layers-window-filter-clear">×</button>
        <button className="layers-window-filter-gear">⚙️</button>
      </div>
      <div className="layers-window-content">
        {images.length === 0 ? (
          <div className="layers-window-empty">No layers</div>
        ) : (
          <div className="layers-window-list">
            {images
              .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
              .map((image) => (
                <div
                  key={image.id}
                  className={`layers-window-item ${draggedLayerIndex === image.zIndex ? 'dragging' : ''} ${selectedImageId === image.id ? 'selected' : ''}`}
                  draggable
                  onDragStart={(e) => onLayerDragStart(e, image.zIndex)}
                  onDragOver={(e) => onLayerDragOver(e, image.zIndex)}
                  onDragEnd={onLayerDragEnd}
                  onClick={() => onSelectImage(image.id)}
                >
                  <span className="layers-window-item-icon">🖼️</span>
                  {editingLayerId === image.id ? (
                    <input
                      type="text"
                      className="layers-window-item-input"
                      value={image.name}
                      onChange={(e) => {
                        if (onUpdateImageName) {
                          onUpdateImageName(image.id, e.target.value)
                        }
                      }}
                      onBlur={(e) => {
                        const newName = e.target.value.trim()
                        if (newName) {
                          onRenameLayer(image.id, newName)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newName = e.target.value.trim()
                          if (newName) {
                            onRenameLayer(image.id, newName)
                          }
                        } else if (e.key === 'Escape') {
                          onSetEditingId(null)
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="layers-window-item-name"
                      onDoubleClick={() => onSetEditingId(image.id)}
                    >
                      {image.name}
                    </span>
                  )}
                  <button
                    className="layers-window-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteLayer(image.id)
                    }}
                    title="Delete layer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LayersWindow

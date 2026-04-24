import { useMemo, useState } from 'react'
import { Eye, GripVertical, Image as ImageIcon, Lock, LockOpen, Search, Trash2, Type, X } from 'lucide-react'
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
  onUpdateImageName,
  projectName
}) => {
  const [filterQuery, setFilterQuery] = useState('')

  const filteredImages = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase()

    return [...images]
      .sort((leftImage, rightImage) => (rightImage.zIndex || 0) - (leftImage.zIndex || 0))
      .filter((image) => {
        if (!normalizedQuery) {
          return true
        }

        const searchableText = `${image.name || ''} ${image.elementId || ''} ${image.type || ''}`.toLowerCase()
        return searchableText.includes(normalizedQuery)
      })
  }, [filterQuery, images])

  return (
    <div
      className="layers-window glass-elevated"
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
        <div className="layers-window-header-copy">
          <div className="layers-window-kicker">{projectName || 'Current scene'}</div>
          <h2 className="layers-window-title">Layers</h2>
          <p className="layers-window-subtitle">Filter, rename, reorder, and inspect everything currently on the canvas.</p>
        </div>
        <button type="button" className="layers-window-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="layers-window-filter">
        <div className="layers-window-filter-field">
          <Search size={14} />
          <input
            type="text"
            placeholder="Filter layers"
            className="layers-window-filter-input"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="layers-window-filter-clear"
          onClick={() => setFilterQuery('')}
          disabled={!filterQuery}
        >
          Clear
        </button>
      </div>

      <div className="layers-window-content">
        {images.length === 0 ? (
          <div className="layers-window-empty">No layers on the canvas yet.</div>
        ) : filteredImages.length === 0 ? (
          <div className="layers-window-empty">No layers match your filter.</div>
        ) : (
          <div className="layers-window-list">
            {filteredImages.map((image) => {
              const LayerIcon = image.type === 'text' ? Type : ImageIcon
              const isEditing = editingLayerId === image.id
              const isLocked = Boolean(image.locked)

              return (
                <div
                  key={image.id}
                  className={`layers-window-item ${draggedLayerIndex === image.zIndex ? 'dragging' : ''} ${selectedImageId === image.id ? 'selected' : ''}`}
                  draggable
                  onDragStart={(event) => onLayerDragStart(event, image.zIndex)}
                  onDragOver={(event) => onLayerDragOver(event, image.zIndex)}
                  onDragEnd={onLayerDragEnd}
                  onClick={() => onSelectImage(image.id)}
                >
                  <div className="layers-window-item-grip">
                    <GripVertical size={14} />
                  </div>

                  <div className="layers-window-item-icon">
                    <LayerIcon size={14} />
                  </div>

                  <div className="layers-window-item-copy">
                    {isEditing ? (
                      <input
                        type="text"
                        className="layers-window-item-input"
                        value={image.name}
                        onChange={(event) => {
                          onUpdateImageName?.(image.id, event.target.value)
                        }}
                        onBlur={(event) => {
                          const newName = event.target.value.trim()
                          if (newName) {
                            onRenameLayer(image.id, newName)
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            const newName = event.target.value.trim()
                            if (newName) {
                              onRenameLayer(image.id, newName)
                            }
                          } else if (event.key === 'Escape') {
                            onSetEditingId(null)
                          }
                        }}
                        autoFocus
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span
                          className="layers-window-item-name"
                          onDoubleClick={() => onSetEditingId(image.id)}
                        >
                          {image.name}
                        </span>
                        <span className="layers-window-item-meta">
                          {image.type === 'text' ? 'Text' : 'Image'} · {image.width || 'auto'} x {image.height || 'auto'}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="layers-window-item-status">
                    <span className="layers-window-item-status-icon">
                      <Eye size={14} />
                    </span>
                    <span className={`layers-window-item-status-icon ${isLocked ? 'locked' : ''}`}>
                      {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="layers-window-item-delete"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteLayer(image.id)
                    }}
                    title="Delete layer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="layers-window-footer">
        <span>{images.length} layers</span>
        <span>{selectedImageId ? '1 selected' : 'No selection'}</span>
      </div>
    </div>
  )
}

export default LayersWindow

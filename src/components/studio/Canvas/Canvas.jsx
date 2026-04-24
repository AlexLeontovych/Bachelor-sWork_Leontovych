import { CANVAS_DIMENSIONS } from '../../shared/utils/constants'
import './Canvas.css'

const Canvas = ({
  previewRef,
  images,
  selectedImageId,
  draggingImageId,
  onDrop,
  onDragOver,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onClick,
  onImageClick,
  onImageDragStart,
  onResizeStart,
  sceneBackground,
  sceneBorderStyle,
  sceneBorderColor,
  editingTextId,
  onTextEdit,
  onTextChange,
  onTextBlur,
  screenFormat
}) => {
  const canvasDimensions = CANVAS_DIMENSIONS[screenFormat] || CANVAS_DIMENSIONS.landscape
  const horizontalMarks = Array.from({ length: 16 }, (_, index) => index * 100)
  const verticalMarks = Array.from({ length: 8 }, (_, index) => index * 100)
  const orderedImages = [...images].sort((leftImage, rightImage) => (leftImage.zIndex || 0) - (rightImage.zIndex || 0))

  return (
    <div className="studio-canvas-container">
      <div className="canvas-ambient-gradient" aria-hidden="true" />
      <div className="canvas-ruler canvas-ruler-top">
        {horizontalMarks.map((mark) => (
          <span key={`x-${mark}`}>{mark}</span>
        ))}
      </div>

      <div className="canvas-ruler canvas-ruler-left">
        {verticalMarks.map((mark) => (
          <span key={`y-${mark}`}>{mark}</span>
        ))}
      </div>

      <div className="canvas-stage-shell">
        <div className="canvas-workspace">
          <div className="studio-canvas-wrapper">
            <div
              className="studio-canvas"
              ref={previewRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
              style={{
                width: `${canvasDimensions.width}px`,
                height: `${canvasDimensions.height}px`,
                backgroundColor: sceneBackground,
                border: sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none'
              }}
            >
              <div className="canvas-grid">
                <div className="canvas-grid-lines" />
                <div className="canvas-alignment-guides" aria-hidden="true">
                  <span className="canvas-guide canvas-guide-horizontal" />
                  <span className="canvas-guide canvas-guide-vertical" />
                </div>

                {orderedImages.map((image, index) => (
                  <div
                    key={image.id}
                    className={`canvas-image-wrapper ${selectedImageId === image.id ? 'selected' : ''} ${draggingImageId === image.id ? 'dragging' : ''}`}
                    style={{
                      position: 'absolute',
                      left: `${image.x || 0}px`,
                      top: `${image.y || 0}px`,
                      zIndex: image.zIndex || index
                    }}
                  >
                    {image.type === 'text' ? (
                      <div
                        id={image.elementId || image.id}
                        className="canvas-text"
                        data-image-index={index}
                        contentEditable={editingTextId === image.id}
                        suppressContentEditableWarning={true}
                        draggable={false}
                        style={{
                          width: image.width ? `${image.width}px` : 'auto',
                          cursor: editingTextId === image.id ? 'text' : (draggingImageId === image.id ? 'grabbing' : 'move'),
                          display: 'block',
                          opacity: image.opacity !== undefined ? image.opacity : 1,
                          transform: image.rotation ? `rotate(${image.rotation}deg)` : 'none',
                          transformOrigin: 'center center',
                          fontSize: image.fontSize || 16,
                          fontFamily: image.fontFamily || 'Arial',
                          color: image.color || '#000000',
                          fontWeight: image.fontWeight || 'normal',
                          textAlign: image.textAlign || 'left',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          outline: editingTextId === image.id ? '2px solid #60a5fa' : 'none',
                          minHeight: '20px'
                        }}
                        onClick={() => {
                          if (editingTextId !== image.id) {
                            onImageClick(image.id)
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          onTextEdit(image.id)
                        }}
                        onMouseDown={(event) => {
                          if (!event.target.closest('.resize-handle') && editingTextId !== image.id) {
                            onImageDragStart(event, image.id)
                          }
                        }}
                        onInput={(event) => {
                          onTextChange(image.id, event.target.textContent || event.target.innerText)
                        }}
                        onBlur={(event) => {
                          onTextBlur(image.id, event.target.textContent || event.target.innerText)
                        }}
                      >
                        {image.text || 'New text'}
                      </div>
                    ) : (
                      <img
                        id={image.elementId || image.id}
                        src={image.base64 || image.url || ''}
                        alt={image.name}
                        className="canvas-image"
                        data-image-index={index}
                        draggable={false}
                        style={{
                          width: image.width ? `${image.width}px` : 'auto',
                          height: image.height ? `${image.height}px` : 'auto',
                          cursor: draggingImageId === image.id ? 'grabbing' : 'move',
                          display: 'block',
                          opacity: image.opacity !== undefined ? image.opacity : 1,
                          transform: image.rotation ? `rotate(${image.rotation}deg)` : 'none',
                          transformOrigin: 'center center'
                        }}
                        onClick={() => onImageClick(image.id)}
                        onMouseDown={(event) => {
                          if (!event.target.closest('.resize-handle')) {
                            onImageDragStart(event, image.id)
                          }
                        }}
                      />
                    )}

                    {selectedImageId === image.id && (
                      <>
                        <div className="resize-handle resize-handle-nw" onMouseDown={(event) => onResizeStart(event, image.id, 'nw')} />
                        <div className="resize-handle resize-handle-ne" onMouseDown={(event) => onResizeStart(event, image.id, 'ne')} />
                        <div className="resize-handle resize-handle-sw" onMouseDown={(event) => onResizeStart(event, image.id, 'sw')} />
                        <div className="resize-handle resize-handle-se" onMouseDown={(event) => onResizeStart(event, image.id, 'se')} />
                        <div className="resize-handle resize-handle-n" onMouseDown={(event) => onResizeStart(event, image.id, 'n')} />
                        <div className="resize-handle resize-handle-s" onMouseDown={(event) => onResizeStart(event, image.id, 's')} />
                        <div className="resize-handle resize-handle-w" onMouseDown={(event) => onResizeStart(event, image.id, 'w')} />
                        <div className="resize-handle resize-handle-e" onMouseDown={(event) => onResizeStart(event, image.id, 'e')} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="canvas-zoom-chip">
          <button type="button" aria-label="Zoom out">−</button>
          <span>100%</span>
          <button type="button" aria-label="Zoom in">+</button>
          <span className="canvas-zoom-divider" />
          <span>{canvasDimensions.width} × {canvasDimensions.height}</span>
        </div>
      </div>
    </div>
  )
}

export default Canvas

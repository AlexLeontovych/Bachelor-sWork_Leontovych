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
  onSelectImage,
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
  return (
    <div className="studio-canvas-container">
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
            {images
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((image, index) => (
                <div
                  key={image.id}
                  className={`canvas-image-wrapper ${selectedImageId === image.id ? 'selected' : ''} ${draggingImageId === image.id ? 'dragging' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${image.x || 0}px`,
                    top: `${image.y || 0}px`,
                    zIndex: image.zIndex || index,
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
                      onClick={(e) => {
                        if (editingTextId !== image.id) {
                          onImageClick(image.id)
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onTextEdit(image.id)
                      }}
                      onMouseDown={(e) => {
                        if (!e.target.closest('.resize-handle') && editingTextId !== image.id) {
                          onImageDragStart(e, image.id)
                        }
                      }}
                      onInput={(e) => {
                        onTextChange(image.id, e.target.textContent || e.target.innerText)
                      }}
                      onBlur={(e) => {
                        onTextBlur(image.id, e.target.textContent || e.target.innerText)
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
                      onMouseDown={(e) => {
                        if (!e.target.closest('.resize-handle')) {
                          onImageDragStart(e, image.id)
                        }
                      }}
                    />
                  )}
                  {selectedImageId === image.id && (
                    <>
                      <div 
                        className="resize-handle resize-handle-nw"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'nw')}
                      />
                      <div 
                        className="resize-handle resize-handle-ne"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'ne')}
                      />
                      <div 
                        className="resize-handle resize-handle-sw"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'sw')}
                      />
                      <div 
                        className="resize-handle resize-handle-se"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'se')}
                      />
                      <div 
                        className="resize-handle resize-handle-n"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'n')}
                      />
                      <div 
                        className="resize-handle resize-handle-s"
                        onMouseDown={(e) => onResizeStart(e, image.id, 's')}
                      />
                      <div 
                        className="resize-handle resize-handle-w"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'w')}
                      />
                      <div 
                        className="resize-handle resize-handle-e"
                        onMouseDown={(e) => onResizeStart(e, image.id, 'e')}
                      />
                    </>
                  )}
                </div>
              ))}
          </div>
          <div className="canvas-dimensions">
            <span className="canvas-dimension-top">{canvasDimensions.width}</span>
            <span className="canvas-dimension-right">{canvasDimensions.height}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Canvas

import './MenuBar.css'

const MenuBar = ({ showDocumentMenu, onToggleDocumentMenu, onLandscapePreview, onPortraitPreview, screenFormat, onExport, onSave, onSaveAndQuit }) => {
  const isLandscape = screenFormat === 'landscape'
  const isPortrait = screenFormat === 'portrait'
  
  return (
    <div className="studio-menu-bar">
      <div 
        className={`studio-menu-item ${showDocumentMenu ? 'active' : ''}`}
        onClick={onToggleDocumentMenu}
      >
        Document
        {showDocumentMenu && (
          <div className="studio-menu-dropdown">
            <div 
              className={`studio-menu-dropdown-item ${isLandscape ? '' : 'disabled'}`}
              onClick={isLandscape ? onLandscapePreview : undefined}
              title={isLandscape ? 'Landscape Preview (1024×600)' : 'Available only for Landscape projects'}
            >
              <span>Landscape Preview</span>
              <span className="studio-menu-shortcut">Ctrl+P</span>
            </div>
            <div 
              className={`studio-menu-dropdown-item ${isPortrait ? '' : 'disabled'}`}
              onClick={isPortrait ? onPortraitPreview : undefined}
              title={isPortrait ? 'Portrait Preview (390×884)' : 'Available only for Portrait projects'}
            >
              <span>Portrait Preview</span>
              <span className="studio-menu-shortcut">Ctrl+Shift+P</span>
            </div>
            <div className="studio-menu-dropdown-item" onClick={onExport}>
              <span>Export</span>
              <span className="studio-menu-shortcut">Ctrl+E</span>
            </div>
            <div className="studio-menu-dropdown-item" onClick={onSave}>
              <span>Save</span>
              <span className="studio-menu-shortcut">Ctrl+S</span>
            </div>
            <div className="studio-menu-dropdown-item" onClick={onSaveAndQuit}>
              <span>Save and Quit</span>
              <span className="studio-menu-shortcut">Ctrl+Shift+Enter</span>
            </div>
          </div>
        )}
      </div>
      <div className="studio-menu-item">Edit</div>
      <div className="studio-menu-item">Widgets</div>
      <div className="studio-menu-item">View</div>
      <div className="studio-menu-item">Help</div>
    </div>
  )
}

export default MenuBar


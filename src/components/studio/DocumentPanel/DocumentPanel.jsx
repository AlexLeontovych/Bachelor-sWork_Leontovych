import { useState, useEffect } from 'react'
import { formatFileSize } from '../../shared/utils/helpers'
import './DocumentPanel.css'

const DocumentPanel = ({
  activeTab,
  onTabChange,
  expandedSections,
  onToggleSection,
  totalCreativeSize,
  onShowLayers,
  onShowJSEditor,
  onShowCSSEditor,
  onDeleteLayer,
  selectedImageId,
  sceneBackground,
  sceneBorderStyle,
  sceneBorderColor,
  onSceneBackgroundChange,
  onSceneBorderStyleChange,
  onSceneBorderColorChange
}) => {
  const [backgroundInputValue, setBackgroundInputValue] = useState(sceneBackground || '#ffffff')
  const [borderColorInputValue, setBorderColorInputValue] = useState(sceneBorderColor || '#000000')

  // Синхронизируем значения полей ввода при изменении пропсов
  useEffect(() => {
    setBackgroundInputValue(sceneBackground || '#ffffff')
  }, [sceneBackground])

  useEffect(() => {
    setBorderColorInputValue(sceneBorderColor || '#000000')
  }, [sceneBorderColor])

  return (
    <div className="studio-sidebar">
      <div className="studio-tabs">
        <button
          className={`studio-tab ${activeTab === 'Document' ? 'active' : ''}`}
          onClick={() => onTabChange('Document')}
        >
          Document
        </button>
      </div>

      <div className="studio-tab-content">
        {activeTab === 'Document' && (
          <div className="studio-document-panel">
            <div className="studio-document-section">
              <div className="studio-section-header" onClick={() => onToggleSection('scenes')}>
                <span className="studio-section-title">Scenes</span>
                <span className="studio-section-toggle">{expandedSections.scenes ? '▼' : '▶'}</span>
              </div>
              {expandedSections.scenes && (
                <div className="studio-section-content">
                  <div className="studio-scene-item active">
                    <span>Scene 1</span>
                    <div className="studio-scene-actions">
                      <button 
                        className="studio-scene-action-btn"
                        onClick={onShowLayers}
                        title="Layers"
                      >
                        📄
                      </button>
                      <button 
                        className="studio-scene-action-btn"
                        onClick={onShowJSEditor}
                        title="Code Editor"
                      >
                        &lt;/&gt;
                      </button>
                      <button 
                        className="studio-scene-action-btn"
                        onClick={onShowCSSEditor}
                        title="CSS Editor"
                      >
                        🎨
                      </button>
                      <button 
                        className="studio-scene-action-btn"
                        onClick={() => {
                          if (selectedImageId) {
                            onDeleteLayer(selectedImageId)
                          }
                        }}
                        disabled={!selectedImageId}
                        title="Delete Layer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="studio-document-section">
              <div className="studio-section-header" onClick={() => onToggleSection('sceneProperties')}>
                <span className="studio-section-title">Scene Properties</span>
                <span className="studio-section-toggle">{expandedSections.sceneProperties ? '▼' : '▶'}</span>
              </div>
              {expandedSections.sceneProperties && (
                <div className="studio-section-content">
                  <div className="studio-property-group">
                    <div className="studio-property-label">Background</div>
                    <div className="studio-property-controls">
                      <input 
                        type="color" 
                        className="studio-color-picker" 
                        value={(sceneBackground && sceneBackground.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(sceneBackground)) ? sceneBackground : '#ffffff'}
                        onChange={(e) => onSceneBackgroundChange(e.target.value)}
                      />
                      <input
                        type="text"
                        className="studio-color-input"
                        value={backgroundInputValue}
                        onChange={(e) => {
                          // Разрешаем любой ввод, включая пустое поле
                          setBackgroundInputValue(e.target.value)
                        }}
                        onBlur={(e) => {
                          // При потере фокуса валидируем и применяем значение
                          let value = e.target.value.trim()
                          
                          // Если поле пустое, возвращаем предыдущее значение
                          if (!value || value === '#') {
                            setBackgroundInputValue(sceneBackground || '#ffffff')
                            return
                          }
                          
                          // Добавляем # если его нет
                          if (!value.startsWith('#')) {
                            value = '#' + value
                          }
                          
                          // Проверяем валидность hex цвета
                          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                            onSceneBackgroundChange(value)
                            setBackgroundInputValue(value)
                          } else if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
                            // Расширяем короткий формат #RGB в #RRGGBB
                            const r = value[1]
                            const g = value[2]
                            const b = value[3]
                            const expandedValue = `#${r}${r}${g}${g}${b}${b}`
                            onSceneBackgroundChange(expandedValue)
                            setBackgroundInputValue(expandedValue)
                          } else {
                            // Если невалидный формат, возвращаем предыдущее значение
                            setBackgroundInputValue(sceneBackground || '#ffffff')
                          }
                        }}
                        onKeyDown={(e) => {
                          // При нажатии Enter применяем значение
                          if (e.key === 'Enter') {
                            e.target.blur()
                          }
                        }}
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                  <div className="studio-property-group">
                    <div className="studio-property-label">Border style: {sceneBorderStyle}</div>
                    <div className="studio-property-controls">
                      <select
                        value={sceneBorderStyle}
                        onChange={(e) => onSceneBorderStyleChange(e.target.value)}
                        style={{
                          background: '#1a1a1a',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '4px',
                          color: '#e5e7eb',
                          padding: '4px 8px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
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
                            onChange={(e) => onSceneBorderColorChange(e.target.value)}
                          />
                          <input
                            type="text"
                            className="studio-color-input"
                            value={borderColorInputValue}
                            onChange={(e) => {
                              // Разрешаем любой ввод, включая пустое поле
                              setBorderColorInputValue(e.target.value)
                            }}
                            onBlur={(e) => {
                              // При потере фокуса валидируем и применяем значение
                              let value = e.target.value.trim()
                              
                              // Если поле пустое, возвращаем предыдущее значение
                              if (!value || value === '#') {
                                setBorderColorInputValue(sceneBorderColor || '#000000')
                                return
                              }
                              
                              // Добавляем # если его нет
                              if (!value.startsWith('#')) {
                                value = '#' + value
                              }
                              
                              // Проверяем валидность hex цвета
                              if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                                onSceneBorderColorChange(value)
                                setBorderColorInputValue(value)
                              } else if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
                                // Расширяем короткий формат #RGB в #RRGGBB
                                const r = value[1]
                                const g = value[2]
                                const b = value[3]
                                const expandedValue = `#${r}${r}${g}${g}${b}${b}`
                                onSceneBorderColorChange(expandedValue)
                                setBorderColorInputValue(expandedValue)
                              } else {
                                // Если невалидный формат, возвращаем предыдущее значение
                                setBorderColorInputValue(sceneBorderColor || '#000000')
                              }
                            }}
                            onKeyDown={(e) => {
                              // При нажатии Enter применяем значение
                              if (e.key === 'Enter') {
                                e.target.blur()
                              }
                            }}
                            placeholder="#000000"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="studio-document-section">
              <div className="studio-section-header">
                <span className="studio-section-title">Creative Size</span>
                <span className="studio-section-value">{formatFileSize(totalCreativeSize)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentPanel

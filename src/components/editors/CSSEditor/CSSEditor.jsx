import Editor from '@monaco-editor/react'
import './CSSEditor.css'

const CSSEditor = ({ cssCode, onCssChange, onApply, onClose }) => {
  const handleApply = () => {
    // CSS применяется только в превью, не на сцене
    // Просто сохраняем изменения и закрываем редактор
    onApply()
  }

  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-modal-header">
          <h2 className="editor-modal-title">CSS Editor</h2>
          <button className="editor-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="editor-modal-content">
          <Editor
            height="400px"
            language="css"
            value={cssCode}
            onChange={(value) => onCssChange(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              suggestSelection: 'first',
              tabCompletion: 'on',
              wordBasedSuggestions: 'allDocuments',
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showClasses: true,
                showFunctions: true,
                showVariables: true,
                showProperties: true,
                showMethods: true,
              }
            }}
          />
        </div>
        <div className="editor-modal-footer">
          <button className="editor-modal-btn" onClick={handleApply}>
            Apply
          </button>
          <button className="editor-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default CSSEditor

import Editor from '@monaco-editor/react'
import './JSEditor.css'

const JSEditor = ({ code, images, onCodeChange, onApply, onClose }) => {
  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-modal-header">
          <h2 className="editor-modal-title">JavaScript Editor</h2>
          <button className="editor-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="editor-modal-content">
          <Editor
            height="400px"
            language="javascript"
            value={code}
            onChange={(value) => onCodeChange(value || '')}
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
            beforeMount={(monaco) => {
              // Отключаем валидацию синтаксиса, чтобы не показывать ошибки для кода, начинающегося с точки
              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSyntaxValidation: true,
                noSemanticValidation: false,
                noSuggestionDiagnostics: false
              })

              // Добавляем автодополнение для GSAP методов
              monaco.languages.registerCompletionItemProvider('javascript', {
                provideCompletionItems: (model, position) => {
                  const word = model.getWordUntilPosition(position)
                  const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                  }
                  
                  const gsapMethods = [
                    { 
                      label: 'fromTo', 
                      kind: monaco.languages.CompletionItemKind.Method, 
                      insertText: 'fromTo(${1:selector}, ${2:{fromVars}}, ${3:{toVars}}, ${4:position})',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'GSAP: Animate from one set of properties to another',
                      range
                    },
                    { 
                      label: 'to', 
                      kind: monaco.languages.CompletionItemKind.Method, 
                      insertText: 'to(${1:selector}, ${2:{vars}}, ${3:position})',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'GSAP: Animate to a set of properties',
                      range
                    },
                    { 
                      label: 'from', 
                      kind: monaco.languages.CompletionItemKind.Method, 
                      insertText: 'from(${1:selector}, ${2:{vars}}, ${3:position})',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'GSAP: Animate from a set of properties',
                      range
                    },
                    { 
                      label: 'set', 
                      kind: monaco.languages.CompletionItemKind.Method, 
                      insertText: 'set(${1:selector}, ${2:{vars}})',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'GSAP: Set properties immediately',
                      range
                    },
                    { 
                      label: 'stagger', 
                      kind: monaco.languages.CompletionItemKind.Method, 
                      insertText: 'stagger(${1:{vars}}, ${2:amount})',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'GSAP: Animate multiple elements with a delay',
                      range
                    },
                  ]
                  
                  // Добавляем предложения для ID элементов
                  const elementIds = images.map(img => ({
                    label: `#${img.elementId || img.id}`,
                    kind: monaco.languages.CompletionItemKind.Value,
                    insertText: `'#${img.elementId || img.id}'`,
                    documentation: `Element ID: ${img.name}`,
                    range
                  }))
                  
                  return {
                    suggestions: [...gsapMethods, ...elementIds]
                  }
                },
                triggerCharacters: ['.', '#', "'", '"']
              })
            }}
          />
        </div>
        <div className="editor-modal-footer">
          <button className="editor-modal-btn" onClick={onApply}>
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

export default JSEditor

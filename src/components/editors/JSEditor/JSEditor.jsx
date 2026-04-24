import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Sparkles, X } from 'lucide-react'
import './JSEditor.css'

const JSEditor = ({ code, images, onCodeChange, onApply, onClose, sceneBackground = '#0b1226', screenFormat = 'landscape' }) => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('logic')
  const motionStats = useMemo(() => {
    const keyframeMatches = code.match(/\b(fromTo|to|from|set|stagger)\b/g) || []
    const triggerMatches = code.match(/\b(addEventListener|ScrollTrigger|IntersectionObserver|onComplete|onStart|onUpdate)\b/g) || []
    const durationMatches = [...code.matchAll(/duration\s*:\s*([0-9.]+)/g)]
    const durationTotal = durationMatches.reduce((total, match) => total + Number(match[1] || 0), 0)

    return {
      keyframes: keyframeMatches.length,
      triggers: triggerMatches.length,
      duration: durationTotal > 0 ? `${durationTotal.toFixed(1)} s` : 'n/a',
      fpsTarget: 60
    }
  }, [code])

  const motionLayers = useMemo(() => {
    return images
      .filter((image) => Boolean(image?.name))
      .slice(0, 4)
      .map((image, index) => ({
        id: image.id,
        name: image.name,
        start: index * 18,
        width: 28 + Math.max(12, Math.min(36, (image.width || image.fontSize || 120) / 10)),
        tone: ['blue', 'violet', 'gold', 'green'][index % 4]
      }))
  }, [images])

  const previewLabel = screenFormat === 'portrait' ? 'Portrait scene' : 'Landscape scene'

  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <div className="editor-modal motion-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="editor-modal-header">
          <div className="editor-modal-header-copy">
            <span className="editor-modal-eyebrow">
              <Sparkles size={14} />
              Motion workspace
            </span>
            <h2 className="editor-modal-title">Animation & behavior rules</h2>
            <p className="editor-modal-description">
              Author motion logic, timing, and interaction rules that power the creative's behavior.
            </p>
          </div>
          <button type="button" className="editor-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="editor-modal-content motion-editor-content">
          <div className="motion-editor-layout">
            <div className="motion-editor-main">
              <div className="motion-editor-window">
                <div className="motion-editor-window-bar">
                  <div className="motion-editor-window-dots">
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="motion-editor-window-file">motion.scene.rules</span>

                  <div className="motion-editor-window-tabs">
                    <button
                      type="button"
                      className={`motion-editor-window-tab ${activeWorkspaceTab === 'logic' ? 'active' : ''}`}
                      onClick={() => setActiveWorkspaceTab('logic')}
                    >
                      Logic
                    </button>
                    <button
                      type="button"
                      className={`motion-editor-window-tab ${activeWorkspaceTab === 'timeline' ? 'active' : ''}`}
                      onClick={() => setActiveWorkspaceTab('timeline')}
                    >
                      Timeline
                    </button>
                  </div>
                </div>

                {activeWorkspaceTab === 'logic' ? (
                  <div className="editor-modal-workspace motion-editor-workspace">
                    <Editor
                      height="420px"
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
                          showMethods: true
                        }
                      }}
                      beforeMount={(monaco) => {
                        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                          noSyntaxValidation: true,
                          noSemanticValidation: false,
                          noSuggestionDiagnostics: false
                        })

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
                              }
                            ]

                            const elementIds = images.map((image) => ({
                              label: `#${image.elementId || image.id}`,
                              kind: monaco.languages.CompletionItemKind.Value,
                              insertText: `'#${image.elementId || image.id}'`,
                              documentation: `Element ID: ${image.name}`,
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
                ) : (
                  <div className="motion-editor-timeline-board">
                    {motionLayers.length > 0 ? (
                      motionLayers.map((layer) => (
                        <div key={layer.id} className="motion-editor-timeline-row">
                          <span>{layer.name}</span>
                          <div className="motion-editor-timeline-track">
                            <div
                              className={`motion-editor-timeline-segment ${layer.tone}`}
                              style={{
                                left: `${layer.start}%`,
                                width: `${layer.width}%`
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="motion-editor-empty-state">Add layers to generate a timing map for the motion workspace.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="motion-editor-timeline">
                <div className="motion-editor-timeline-header">
                  <span>Timeline</span>
                  <strong>0.0 s - {motionStats.duration}</strong>
                </div>

                {motionLayers.length > 0 ? (
                  motionLayers.map((layer) => (
                    <div key={`timeline-${layer.id}`} className="motion-editor-timeline-row">
                      <span>{layer.name}</span>
                      <div className="motion-editor-timeline-track">
                        <div
                          className={`motion-editor-timeline-segment ${layer.tone}`}
                          style={{
                            left: `${layer.start}%`,
                            width: `${layer.width}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="motion-editor-empty-state compact">Add layers to visualize the timing sequence.</div>
                )}
              </div>
            </div>

            <aside className="motion-editor-sidebar">
              <div className="motion-editor-preview-panel">
                <span className="motion-editor-sidebar-label">Preview</span>

                <div
                  className="motion-editor-preview-card"
                  style={{
                    background: `linear-gradient(135deg, ${sceneBackground}, rgba(108, 76, 201, 0.92) 58%, rgba(108, 158, 255, 0.82))`
                  }}
                >
                  <span>{previewLabel}</span>
                  <strong>{motionLayers[0]?.name || 'Scene preview'}</strong>
                </div>
              </div>

              <div className="motion-editor-stat-list">
                <div className="motion-editor-stat-card">
                  <span>Keyframes</span>
                  <strong>{motionStats.keyframes}</strong>
                </div>
                <div className="motion-editor-stat-card">
                  <span>Triggers</span>
                  <strong>{motionStats.triggers}</strong>
                </div>
                <div className="motion-editor-stat-card">
                  <span>Duration</span>
                  <strong>{motionStats.duration}</strong>
                </div>
                <div className="motion-editor-stat-card">
                  <span>FPS target</span>
                  <strong>{motionStats.fpsTarget}</strong>
                </div>
              </div>

              <div className="motion-editor-sidebar-note">
                <Play size={14} />
                <span>{images.length} layer references are available in autocomplete.</span>
              </div>
            </aside>
          </div>
        </div>

        <div className="motion-editor-footnote">Changes are applied to the current project logic after validation.</div>

        <div className="editor-modal-footer">
          <button type="button" className="editor-modal-btn-cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="editor-modal-btn glow-blue" onClick={onApply}>
            Apply changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default JSEditor

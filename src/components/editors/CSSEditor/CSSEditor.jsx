import { useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { Brush, Eye, X } from 'lucide-react'
import './CSSEditor.css'

const CSSEditor = ({ cssCode, onCssChange, onApply, onClose, images = [], sceneBackground = '#0b1226' }) => {
  const handleApply = () => {
    onApply()
  }

  const textLayers = useMemo(() => {
    return images.filter((image) => image.type === 'text')
  }, [images])

  const tokenCards = useMemo(() => {
    return [
      { label: 'surface/navy-deep', value: sceneBackground || '#0B1226' },
      { label: 'brand/violet', value: '#6C49C9' },
      { label: 'brand/blue-glow', value: '#6C9EFF' },
      { label: 'brand/gold', value: '#D4AF7A' },
      { label: 'surface/stage', value: '#1A2450' },
      { label: 'accent/rose', value: '#F472B6' }
    ]
  }, [sceneBackground])

  const typographyRamp = useMemo(() => {
    const primaryText = textLayers[0]?.text || 'Precision crafted'
    const secondaryText = textLayers[1]?.text || 'Elegant and engineered'
    const bodyText = textLayers[2]?.text || 'Clear, considered supporting copy.'

    return [
      {
        label: 'display/xl',
        size: `${textLayers[0]?.fontSize || 64}px`,
        sample: primaryText
      },
      {
        label: 'display/md',
        size: `${textLayers[1]?.fontSize || 40}px`,
        sample: secondaryText
      },
      {
        label: 'body/lg',
        size: `${textLayers[2]?.fontSize || 18}px`,
        sample: bodyText
      },
      {
        label: 'body/md',
        size: '14px',
        sample: 'Tight operational interface text used at default size.'
      }
    ]
  }, [textLayers])

  const cssPreview = useMemo(() => {
    const trimmedLines = cssCode
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)
      .slice(0, 8)

    if (trimmedLines.length === 0) {
      return [
        '// Add style overrides for the current creative.',
        '.hero {',
        "  color: var(--text-primary);",
        '  border-radius: 12px;',
        '}'
      ].join('\n')
    }

    return trimmedLines.join('\n')
  }, [cssCode])

  return (
    <div className="editor-modal-overlay" onClick={onClose}>
      <div className="editor-modal css-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="editor-modal-header">
          <div className="editor-modal-header-copy">
            <span className="editor-modal-eyebrow">
              <Brush size={14} />
              Presentation layer
            </span>
            <h2 className="editor-modal-title">Visual presentation rules</h2>
            <p className="editor-modal-description">
              Design tokens, typography ramps, and state rules that shape how every layer renders.
            </p>
          </div>
          <button type="button" className="editor-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="editor-modal-content css-editor-content">
          <div className="css-editor-layout">
            <div className="css-editor-main">
              <section className="css-editor-section">
                <div className="css-editor-section-heading">Design tokens</div>
                <div className="css-token-grid">
                  {tokenCards.map((token) => (
                    <div key={token.label} className="css-token-card">
                      <div className="css-token-swatch" style={{ background: token.value }} />
                      <strong>{token.label}</strong>
                      <span>{token.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="css-editor-section">
                <div className="css-editor-section-heading">Typography ramp</div>
                <div className="css-typography-ramp">
                  {typographyRamp.map((row) => (
                    <div key={`${row.label}-${row.size}`} className="css-typography-row">
                      <div className="css-typography-meta">
                        <span>{row.label}</span>
                        <small>{row.size}</small>
                      </div>
                      <div className="css-typography-sample">{row.sample}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="css-editor-section">
                <div className="css-editor-section-heading">Style overrides</div>
                <div className="editor-modal-workspace css-editor-workspace">
                  <Editor
                    height="300px"
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
                        showMethods: true
                      }
                    }}
                  />
                </div>
              </section>
            </div>

            <aside className="css-editor-sidebar">
              <div className="css-editor-rule-preview">
                <span className="css-editor-sidebar-label">Rule preview</span>
                <div className="css-editor-rule-card">
                  <Eye size={14} />
                  <pre>{cssPreview}</pre>
                </div>
              </div>

              <div className="css-editor-sidebar-nav">
                <span>Tokens</span>
                <span>Typography</span>
                <span>Overrides</span>
              </div>
            </aside>
          </div>
        </div>

        <div className="css-editor-footnote">Styles apply to the generated preview output without leaving the studio workflow.</div>

        <div className="editor-modal-footer">
          <button type="button" className="editor-modal-btn-cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="editor-modal-btn glow-blue" onClick={handleApply}>
            Apply changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default CSSEditor

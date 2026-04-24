import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileStack,
  Monitor,
  Save,
  Smartphone,
  Sparkles
} from 'lucide-react'
import './MenuBar.css'

const MenuBar = ({
  showDocumentMenu,
  onToggleDocumentMenu,
  onLandscapePreview,
  onPortraitPreview,
  screenFormat,
  onExport,
  onSave,
  onSaveAndQuit,
  onLogoClick,
  isSaved = true,
  project = null
}) => {
  const isPortrait = screenFormat === 'portrait'
  const previewHandler = isPortrait ? onPortraitPreview : onLandscapePreview
  const projectName = project?.name || 'Untitled creative'
  const projectId = project?.id ? String(project.id).slice(0, 8).toUpperCase() : 'DRAFT'
  const projectFormat = project?.format || 'Creative'
  const OrientationIcon = isPortrait ? Smartphone : Monitor
  const projectMeta = `LPM-${projectId} · ${projectFormat.toLowerCase()} · ${screenFormat}`

  const menuItems = [
    {
      label: 'Open landscape preview',
      shortcut: 'Ctrl+P',
      icon: Eye,
      disabled: screenFormat !== 'landscape',
      title: screenFormat === 'landscape' ? 'Landscape preview (1024 x 600)' : 'Available only for landscape projects',
      onClick: onLandscapePreview
    },
    {
      label: 'Open portrait preview',
      shortcut: 'Ctrl+Shift+P',
      icon: Smartphone,
      disabled: !isPortrait,
      title: isPortrait ? 'Portrait preview (390 x 884)' : 'Available only for portrait projects',
      onClick: onPortraitPreview
    },
    {
      label: 'Export project',
      shortcut: 'Ctrl+E',
      icon: Download,
      onClick: onExport
    },
    {
      label: 'Save changes',
      shortcut: 'Ctrl+S',
      icon: Save,
      onClick: onSave
    },
    {
      label: 'Save and leave',
      shortcut: 'Ctrl+Shift+Enter',
      icon: FileStack,
      onClick: onSaveAndQuit
    }
  ]

  return (
    <div className="studio-menu-bar glass-panel">
      <div className="studio-menu-row studio-menu-row--top">
        <div className="studio-menu-nav-cluster">
          <button
            type="button"
            className="studio-menu-logo"
            onClick={onLogoClick}
            aria-label="Open projects page"
          >
            N
          </button>

          <div className="studio-menu-nav">
            <div className={`studio-menu-item-group ${showDocumentMenu ? 'active' : ''}`}>
              <button
                type="button"
                className={`studio-menu-item ${showDocumentMenu ? 'active' : ''}`}
                onClick={onToggleDocumentMenu}
              >
                File
                <ChevronDown size={14} />
              </button>

              {showDocumentMenu && (
                <div className="studio-menu-dropdown">
                  {menuItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`studio-menu-dropdown-item ${item.disabled ? 'disabled' : ''}`}
                        onClick={() => {
                          if (item.disabled) {
                            return
                          }

                          item.onClick?.()
                          onToggleDocumentMenu?.()
                        }}
                        title={item.title}
                        disabled={item.disabled}
                      >
                        <span className="studio-menu-dropdown-item__left">
                          <Icon size={14} />
                          <span>{item.label}</span>
                        </span>
                        <span className="studio-menu-shortcut">{item.shortcut}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {['Edit', 'View', 'Preview', 'Export', 'Help'].map((label) => (
              <button key={label} type="button" className="studio-menu-link studio-menu-link-button">
                {label}
                <ChevronDown size={12} />
              </button>
            ))}
          </div>
        </div>

        <div className="studio-menu-actions">
          <span className={`studio-menu-state ${isSaved ? 'saved' : 'unsaved'}`}>
            {isSaved ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
            {isSaved ? 'Saved' : 'Unsaved changes'}
          </span>
          <button type="button" className="studio-toolbar-button studio-toolbar-button-ghost" onClick={previewHandler}>
            <Eye size={14} />
            Preview
          </button>
          <button type="button" className="studio-toolbar-button studio-toolbar-button-ghost" onClick={onExport}>
            <Download size={14} />
            Export
          </button>
          <button type="button" className="studio-toolbar-button studio-toolbar-button-secondary" onClick={onSave}>
          <Save size={14} />
          Save
        </button>
          <button type="button" className="studio-toolbar-button studio-toolbar-button-primary glow-blue" onClick={onSaveAndQuit}>
          <FileStack size={14} />
          Save & Exit
        </button>
        </div>
      </div>

      <div className="studio-menu-row studio-menu-row--project">
        <div className="studio-project-summary">
          <button type="button" className="studio-project-back" onClick={onLogoClick} aria-label="Back to projects">
            <ArrowLeft size={15} />
          </button>

          <div className="studio-project-device" aria-hidden="true">
            <OrientationIcon size={15} />
          </div>

          <div className="studio-project-copy">
            <div className="studio-project-title-row">
              <strong className="studio-project-title">{projectName}</strong>
              <span className="studio-project-chip">{projectFormat}</span>
              <span className="studio-project-chip">{screenFormat}</span>
            </div>
            <span className="studio-project-meta">{projectMeta}</span>
          </div>
        </div>

        <div className="studio-project-status">
          <span>{isSaved ? 'Last saved just now' : 'Changes not saved'}</span>
          <span className="studio-project-live">
            <span aria-hidden="true" />
            Live collaboration on
          </span>
        </div>
      </div>
    </div>
  )
}

export default MenuBar

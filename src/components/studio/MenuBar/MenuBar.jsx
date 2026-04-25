import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  CornerDownLeft,
  Download,
  Eye,
  ExternalLink,
  FileStack,
  Monitor,
  Palette,
  Save,
  ShieldCheck,
  ShieldPlus,
  Smartphone,
  Sparkles,
  X
} from 'lucide-react'
import Logo from '../../shared/ui/Logo'
import {
  canApproveProjectToProduction,
  canReopenProjectFromProduction,
  canReturnProjectToDevelopment,
  canSendProjectToQa,
  getProjectQaId,
  getProjectStatusLabel,
  normalizeProjectStatus
} from '../../shared/utils/projectWorkflow'
import './MenuBar.css'

const MenuBar = ({
  showDocumentMenu,
  onToggleDocumentMenu,
  onLandscapePreview,
  onPortraitPreview,
  onExternalPreview,
  screenFormat,
  onExport,
  onExportMp4,
  onExportGif,
  onSave,
  onSaveAndQuit,
  onShowJSEditor,
  onShowCSSEditor,
  onShowTimelineEditor,
  profile = null,
  isWorkflowBusy = false,
  onWorkflowAction,
  onLogoClick,
  isSaved = true,
  project = null
}) => {
  const isPortrait = screenFormat === 'portrait'
  const previewHandler = isPortrait ? onPortraitPreview : onLandscapePreview
  const activeMenu = showDocumentMenu || null
  const menuButtonRefs = useRef({})
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [workflowDialogAction, setWorkflowDialogAction] = useState(null)
  const [workflowNote, setWorkflowNote] = useState('')
  const projectName = project?.name || 'Untitled creative'
  const projectId = project?.id ? String(project.id).slice(0, 8).toUpperCase() : 'DRAFT'
  const projectFormat = project?.format || 'Creative'
  const OrientationIcon = isPortrait ? Smartphone : Monitor
  const projectMeta = `LPM-${projectId} · ${projectFormat.toLowerCase()} · ${screenFormat}`
  const projectStatus = normalizeProjectStatus(project?.status)
  const projectStatusLabel = getProjectStatusLabel(projectStatus)
  const canChangeWorkflow = Boolean(project?.id && profile && typeof onWorkflowAction === 'function')
  const canSendToQa = canChangeWorkflow && canSendProjectToQa(project, profile, { isSaved })
  const canReturnToDevelopment = canChangeWorkflow && canReturnProjectToDevelopment(project, profile) && isSaved
  const canApproveToProduction = canChangeWorkflow && canApproveProjectToProduction(project, profile) && isSaved
  const canReopenProduction = canChangeWorkflow && canReopenProjectFromProduction(project, profile) && isSaved
  const statusItems = [
    {
      label: 'Send to QA',
      icon: ShieldPlus,
      action: 'send_to_qa',
      disabled: !canSendToQa || isWorkflowBusy,
      title: !getProjectQaId(project)
        ? 'Assign a QA reviewer before sending to QA.'
        : !isSaved
          ? 'Save the project before sending it to QA.'
          : 'Send this project to QA review.'
    },
    {
      label: 'Back to development',
      icon: CornerDownLeft,
      action: projectStatus === 'production' ? 'reopen_to_development' : 'return_to_development',
      disabled: projectStatus === 'production'
        ? (!canReopenProduction || isWorkflowBusy)
        : (!canReturnToDevelopment || isWorkflowBusy),
      title: !isSaved
        ? 'Save the project before changing the status.'
        : 'Move this project back to development.'
    },
    {
      label: 'Move to production',
      icon: ShieldCheck,
      action: 'approve_to_production',
      disabled: !canApproveToProduction || isWorkflowBusy,
      title: !isSaved
        ? 'Save the project before moving it to production.'
        : 'Approve this project for production.'
    }
  ]

  const menuGroups = [
    {
      id: 'file',
      label: 'File',
      items: [
        {
          label: 'Save',
          shortcut: 'Ctrl+S',
          icon: Save,
          onClick: onSave
        },
        {
          label: 'Save and exit',
          shortcut: 'Ctrl+Shift+Enter',
          icon: FileStack,
          onClick: onSaveAndQuit
        }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        {
          label: 'Edit JS',
          icon: Code2,
          onClick: onShowJSEditor
        },
        {
          label: 'Edit CSS',
          icon: Palette,
          onClick: onShowCSSEditor
        },
        {
          label: 'Edit timeline',
          icon: Clock3,
          onClick: onShowTimelineEditor || onShowJSEditor
        }
      ]
    },
    {
      id: 'preview',
      label: 'Preview',
      items: [
        {
          label: 'Preview in studio',
          shortcut: isPortrait ? 'Ctrl+Shift+P' : 'Ctrl+P',
          icon: Eye,
          onClick: previewHandler
        },
        {
          label: 'Preview outside studio',
          icon: ExternalLink,
          onClick: onExternalPreview
        }
      ]
    },
    {
      id: 'export',
      label: 'Export',
      items: [
        {
          label: 'Export HTML',
          shortcut: 'Ctrl+E',
          icon: Download,
          onClick: onExport
        },
        {
          label: 'Export MP4',
          icon: Download,
          onClick: onExportMp4
        },
        {
          label: 'Export GIF',
          icon: Download,
          onClick: onExportGif
        }
      ]
    },
    {
      id: 'status',
      label: projectStatusLabel,
      items: statusItems
    }
  ]

  const handleMenuItemClick = (item) => {
    if (item.disabled) {
      return
    }

    if (item.action) {
      handleWorkflowItemClick(item.action)
    } else {
      item.onClick?.()
    }
    onToggleDocumentMenu?.(null)
  }

  const handleWorkflowItemClick = (action) => {
    if (action === 'return_to_development') {
      setWorkflowDialogAction(action)
      setWorkflowNote('')
      return
    }

    void handleWorkflowConfirm(action)
  }

  const handleWorkflowConfirm = async (action = workflowDialogAction) => {
    if (!project?.id || !action || isWorkflowBusy) {
      return
    }

    const payload = {}

    if (action === 'return_to_development') {
      if (!workflowNote.trim()) {
        return
      }

      payload.note = workflowNote.trim()
    }

    if (action === 'reopen_to_development') {
      await onWorkflowAction(project.id, 'reopen_from_production', { targetStatus: 'development' })
      return
    }

    const isSuccessful = await onWorkflowAction(project.id, action, payload)
    if (isSuccessful) {
      setWorkflowDialogAction(null)
      setWorkflowNote('')
    }
  }

  useEffect(() => {
    const updateDropdownPosition = () => {
      const activeButton = activeMenu ? menuButtonRefs.current[activeMenu] : null

      if (!activeButton) {
        return
      }

      const rect = activeButton.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 6,
        left: rect.left
      })
    }

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)

    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [activeMenu])

  const activeMenuGroup = menuGroups.find((group) => group.id === activeMenu)
  const dropdownElement = activeMenuGroup ? createPortal(
    <div
      className="studio-menu-dropdown studio-menu-dropdown--portal"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`
      }}
    >
      {activeMenuGroup.items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            className={`studio-menu-dropdown-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => handleMenuItemClick(item)}
            title={item.title}
            disabled={item.disabled}
          >
            <Icon size={14} />
            <span>{item.label}</span>
            {item.shortcut && <span className="studio-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>,
    document.body
  ) : null
  const workflowDialogElement = workflowDialogAction ? createPortal(
    <div className="studio-status-modal-overlay" onClick={() => setWorkflowDialogAction(null)}>
      <div className="studio-status-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="studio-status-modal-close"
          onClick={() => setWorkflowDialogAction(null)}
          aria-label="Close status modal"
        >
          <X size={16} />
        </button>
        <div className="studio-status-modal-icon">
          <CornerDownLeft size={18} />
        </div>
        <span className="studio-status-modal-eyebrow">Project status</span>
        <h2>Back to development</h2>
        <p>Add QA feedback so the developer understands what should be fixed before the next review.</p>
        <textarea
          className="studio-status-modal-textarea"
          value={workflowNote}
          onChange={(event) => setWorkflowNote(event.target.value)}
          placeholder="Describe what should be changed..."
          rows={5}
          autoFocus
        />
        <div className="studio-status-modal-actions">
          <button type="button" className="studio-status-modal-secondary" onClick={() => setWorkflowDialogAction(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="studio-status-modal-primary"
            disabled={!workflowNote.trim() || isWorkflowBusy}
            onClick={() => handleWorkflowConfirm()}
          >
            {isWorkflowBusy ? 'Updating...' : 'Return to development'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
    <div className="studio-menu-bar glass-panel">
      <div className="studio-menu-row studio-menu-row--top">
        <div className="studio-menu-nav-cluster">
          <button
            type="button"
            className="studio-menu-logo"
            onClick={onLogoClick}
            aria-label="Open projects page"
          >
            <Logo size="sm" withText={false} />
          </button>

          <div className="studio-menu-nav">
            {menuGroups.map((group) => (
              <div key={group.id} className={`studio-menu-item-group ${activeMenu === group.id ? 'active' : ''}`}>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) {
                      menuButtonRefs.current[group.id] = node
                    }
                  }}
                  className={`studio-menu-item ${activeMenu === group.id ? 'active' : ''}`}
                  onClick={() => onToggleDocumentMenu?.(group.id)}
                >
                  {group.label}
                  <ChevronDown size={14} />
                </button>

              </div>
            ))}
          </div>
        </div>

        <div className="studio-menu-actions">
          <span className={`studio-menu-state ${isSaved ? 'saved' : 'unsaved'}`}>
            {isSaved ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
            {isSaved ? 'Saved' : 'Unsaved changes'}
          </span>
          <div className="studio-top-project-summary">
            <div className="studio-project-device" aria-hidden="true">
              <OrientationIcon size={15} />
            </div>

            <div className="studio-project-copy">
              <div className="studio-project-title-row">
                <strong className="studio-project-title">{projectName}</strong>
              </div>
              <span className="studio-project-meta">{projectMeta}</span>
            </div>
          </div>
          <button
            type="button"
            className="studio-back-projects-button"
            onClick={onLogoClick}
          >
            <ArrowLeft size={13} />
            Back to projects
          </button>
        </div>
      </div>

    </div>
    {dropdownElement}
    {workflowDialogElement}
    </>
  )
}

export default MenuBar

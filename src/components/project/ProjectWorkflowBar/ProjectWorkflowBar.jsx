import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Boxes,
  CornerDownLeft,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  X
} from 'lucide-react'
import {
  canApproveProjectToProduction,
  canArchiveProject,
  canReopenProjectFromProduction,
  canReturnProjectToDevelopment,
  canSendProjectToQa,
  canUnarchiveProject,
  getProjectDeveloperId,
  getProjectQaFeedbackNote,
  getProjectQaHandoffNote,
  getProjectQaId,
  getProjectStatusLabel,
  getWorkflowTeamRole,
  hasAssignedQa,
  isProjectArchived,
  normalizeProjectStatus
} from '../../shared/utils/projectWorkflow'
import StatusChip from '../../shared/ui/StatusChip'
import './ProjectWorkflowBar.css'

const ACTION_CONFIG = {
  send_to_qa: {
    title: 'Send to QA review',
    confirmLabel: 'Send to QA',
    description: 'Hand this creative off to the QA stage. Your assigned reviewer will be notified immediately.',
    commentLabel: 'Handoff note for the reviewer (optional)',
    commentPlaceholder: 'Add structured notes...',
    icon: ShieldPlus,
    tone: 'primary'
  },
  return_to_development: {
    title: 'Return with feedback',
    confirmLabel: 'Return to Development',
    description: 'Return this creative to development and explain what should be fixed before the next pass.',
    commentLabel: 'Reviewer feedback',
    commentPlaceholder: 'Describe what should be fixed...',
    commentRequired: true,
    icon: CornerDownLeft,
    tone: 'warning'
  },
  approve_to_production: {
    title: 'Approve to production',
    confirmLabel: 'Approve to Production',
    description: 'Approve the creative and move it to the production stage.',
    icon: ShieldCheck,
    tone: 'success'
  },
  reopen_from_production: {
    title: 'Reopen project',
    confirmLabel: 'Reopen project',
    description: 'Move this production creative back into development or QA for another pass.',
    showTargetSelect: true,
    icon: RefreshCw,
    tone: 'secondary'
  },
  archive_project: {
    title: 'Archive project',
    confirmLabel: 'Archive project',
    description: 'The project will be hidden from the main operations view but preserved with full history.',
    icon: Archive,
    tone: 'subtle'
  },
  unarchive_project: {
    title: 'Restore archived project',
    confirmLabel: 'Restore project',
    description: 'Restore the archived creative to the active production set while preserving its history.',
    icon: Boxes,
    tone: 'subtle'
  }
}

const WORKFLOW_DESCRIPTION_MAP = {
  development: 'Developers work here. The project can move to QA only after it is saved and a QA is assigned.',
  qa: 'QA can return the project with feedback or approve it for Production.',
  production: 'Production is locked for regular users. The team lead can edit, archive, or reopen the project.'
}

const WORKFLOW_STAGE_ITEMS = [
  {
    key: 'development',
    label: 'Development'
  },
  {
    key: 'qa',
    label: 'QA Review'
  },
  {
    key: 'production',
    label: 'Production'
  },
  {
    key: 'archived',
    label: 'Archive'
  }
]

/**
 * Displays workflow actions for the currently opened project.
 *
 * @param {{
 *   project: Object | null,
 *   profile: { id?: string, role?: string, team_role?: string, teamRole?: string } | null,
 *   isSaved?: boolean,
 *   isBusy?: boolean,
 *   onAction: (projectId: string, action: string, payload?: Record<string, unknown>) => Promise<boolean> | boolean
 * }} props
 * @returns {JSX.Element | null}
 */
const ProjectWorkflowBar = ({ project, profile, isSaved = true, isBusy = false, onAction }) => {
  const [dialogAction, setDialogAction] = useState(null)
  const [comment, setComment] = useState('')
  const [reopenTarget, setReopenTarget] = useState('development')

  const currentStatus = useMemo(() => normalizeProjectStatus(project?.status), [project])
  const workflowRole = useMemo(() => getWorkflowTeamRole(profile), [profile])
  const isLead = profile?.role === 'admin'
  const isAssignedDeveloper = Boolean(project && profile?.id && getProjectDeveloperId(project) === profile.id && workflowRole === 'developer')
  const isAssignedQa = Boolean(project && profile?.id && getProjectQaId(project) === profile.id && workflowRole === 'qa')
  const isArchived = isProjectArchived(project)
  const qaAssigned = hasAssignedQa(project)
  const qaHandoffNote = getProjectQaHandoffNote(project)
  const qaFeedbackNote = getProjectQaFeedbackNote(project)
  const activeStage = isArchived ? 'archived' : currentStatus

  const showSendToQa = currentStatus === 'development' && (isLead || isAssignedDeveloper)
  const showQaActions = currentStatus === 'qa' && (isLead || isAssignedQa)
  const showProductionActions = currentStatus === 'production' && isLead

  const canSend = canSendProjectToQa(project, profile, { isSaved })
  const canReturn = canReturnProjectToDevelopment(project, profile) && isSaved
  const canApprove = canApproveProjectToProduction(project, profile) && isSaved
  const canReopen = canReopenProjectFromProduction(project, profile) && isSaved
  const canArchive = canArchiveProject(project, profile) && isSaved
  const canUnarchive = canUnarchiveProject(project, profile) && isSaved

  useEffect(() => {
    if (!dialogAction) {
      return undefined
    }

    const handleKeyDown = (event) => {
      try {
        if (event.key === 'Escape' && !isBusy) {
          setDialogAction(null)
          setComment('')
          setReopenTarget('development')
        }
      } catch (error) {
        console.error('Error handling workflow dialog keyboard shortcut:', error)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dialogAction, isBusy])

  if (!project || !profile || typeof onAction !== 'function') {
    return null
  }

  const dialogConfig = dialogAction ? ACTION_CONFIG[dialogAction] : null
  const DialogIcon = dialogConfig?.icon || Sparkles

  const getSendToQaHint = () => {
    try {
      if (canSend) {
        return 'Send the project to QA'
      }

      if (!qaAssigned) {
        return 'Assign a QA before sending the project to QA.'
      }

      if (!isSaved) {
        return 'Save the project before sending it to QA.'
      }

      return 'Only the assigned developer or team lead can send this project to QA.'
    } catch (error) {
      console.error('Error getting Send to QA hint:', error)
      return 'Unable to check Send to QA access.'
    }
  }

  const getQaActionHint = (type) => {
    try {
      if (!isSaved) {
        return 'Save the project before changing the workflow stage.'
      }

      if (type === 'return') {
        return canReturn
          ? 'Return the project to Development with QA feedback'
          : 'Only the assigned QA or team lead can return this project to Development.'
      }

      return canApprove
        ? 'Approve the project for Production'
        : 'Only the assigned QA or team lead can approve this project for Production.'
    } catch (error) {
      console.error('Error getting QA action hint:', error)
      return 'Unable to check QA workflow access.'
    }
  }

  const getProductionActionHint = (type) => {
    try {
      if (!isSaved) {
        return 'Save the project before changing the workflow stage.'
      }

      if (type === 'reopen') {
        return canReopen
          ? 'Reopen this production project back to Development or QA'
          : 'Only the team lead can reopen a production project.'
      }

      if (type === 'archive') {
        return canArchive
          ? 'Archive this production project'
          : 'Only the team lead can archive a production project.'
      }

      return canUnarchive
        ? 'Restore this archived project'
        : 'Only the team lead can restore an archived project.'
    } catch (error) {
      console.error('Error getting Production workflow hint:', error)
      return 'Unable to check Production workflow access.'
    }
  }

  const handleOpenDialog = (action) => {
    try {
      if (isBusy) {
        return
      }

      setDialogAction(action)
      setComment(
        action === 'send_to_qa'
          ? qaHandoffNote
          : action === 'return_to_development'
            ? qaFeedbackNote
            : ''
      )
      setReopenTarget('development')
    } catch (error) {
      console.error('Error opening workflow dialog:', error)
    }
  }

  const handleCloseDialog = () => {
    try {
      if (isBusy) {
        return
      }

      setDialogAction(null)
      setComment('')
      setReopenTarget('development')
    } catch (error) {
      console.error('Error closing workflow dialog:', error)
    }
  }

  const handleConfirmDialog = async () => {
    try {
      if (!dialogAction || isBusy) {
        return
      }

      const payload = {}

      if (dialogConfig?.commentLabel) {
        payload.note = comment
      }

      if (dialogConfig?.showTargetSelect) {
        payload.targetStatus = reopenTarget
      }

      const isSuccessful = await onAction(project.id, dialogAction, payload)
      if (isSuccessful) {
        handleCloseDialog()
      }
    } catch (error) {
      console.error('Error confirming workflow action:', error)
    }
  }

  const hasVisibleActions = showSendToQa || showQaActions || showProductionActions || (isArchived && isLead)
  const stageNote = WORKFLOW_DESCRIPTION_MAP[currentStatus]
  const reviewerNote = qaFeedbackNote || qaHandoffNote || 'Everything looks clean. Contextual reviewer notes will appear here after the next handoff or QA pass.'

  return (
    <>
      <div className="project-workflow-bar glass-panel">
        <div className="project-workflow-topline">
          <div className="project-workflow-state-chips">
            <StatusChip status={normalizeProjectStatus(project.status)} label={getProjectStatusLabel(project.status)} size="sm" />
            <StatusChip status={isSaved ? 'saved' : 'unsaved'} label={isSaved ? 'Saved' : 'Unsaved changes'} size="sm" pulse={!isSaved} />
            <StatusChip status={qaAssigned ? 'assigned' : 'missing'} label={qaAssigned ? 'QA assigned' : 'QA missing'} size="sm" pulse={!qaAssigned} />
            {isArchived && <StatusChip status="archived" size="sm" />}
          </div>

          <div className="project-workflow-stages">
            {WORKFLOW_STAGE_ITEMS.map((stageItem) => (
              <span
                key={stageItem.key}
                className={`project-workflow-stage-pill ${activeStage === stageItem.key ? 'active' : ''}`}
              >
                {stageItem.label}
              </span>
            ))}
          </div>

          {hasVisibleActions && (
            <div className="project-workflow-actions">
              {showSendToQa && (
                <WorkflowActionButton
                  icon={ShieldPlus}
                  label="Send to QA"
                  tone="primary"
                  disabled={!canSend || isBusy}
                  title={getSendToQaHint()}
                  onClick={() => handleOpenDialog('send_to_qa')}
                />
              )}

              {showQaActions && (
                <>
                  <WorkflowActionButton
                    icon={CornerDownLeft}
                    label="Return with feedback"
                    tone="warning"
                    disabled={!canReturn || isBusy}
                    title={getQaActionHint('return')}
                    onClick={() => handleOpenDialog('return_to_development')}
                  />
                  <WorkflowActionButton
                    icon={ShieldCheck}
                    label="Approve to production"
                    tone="success"
                    disabled={!canApprove || isBusy}
                    title={getQaActionHint('approve')}
                    onClick={() => handleOpenDialog('approve_to_production')}
                  />
                </>
              )}

              {showProductionActions && (
                <>
                  <WorkflowActionButton
                    icon={RefreshCw}
                    label="Reopen"
                    tone="secondary"
                    disabled={!canReopen || isBusy}
                    title={getProductionActionHint('reopen')}
                    onClick={() => handleOpenDialog('reopen_from_production')}
                  />
                  {!isArchived && (
                    <WorkflowActionButton
                      icon={Archive}
                      label="Archive"
                      tone="subtle"
                      disabled={!canArchive || isBusy}
                      title={getProductionActionHint('archive')}
                      onClick={() => handleOpenDialog('archive_project')}
                    />
                  )}
                </>
              )}

              {isArchived && isLead && (
                <WorkflowActionButton
                  icon={Boxes}
                  label="Restore archived"
                  tone="subtle"
                  disabled={!canUnarchive || isBusy}
                  title={getProductionActionHint('restore')}
                  onClick={() => handleOpenDialog('unarchive_project')}
                />
              )}
            </div>
          )}
        </div>

        <div className="project-workflow-note-row">
          <div className="project-workflow-note">
            <div className="project-workflow-note-label">Current stage</div>
            <div className="project-workflow-note-text">{stageNote}</div>
          </div>

          <div className="project-workflow-note">
            <div className="project-workflow-note-label">
              {qaFeedbackNote ? 'QA reviewer feedback' : qaHandoffNote ? 'Developer handoff note' : 'Review feedback'}
            </div>
            <div className="project-workflow-note-text">{reviewerNote}</div>
          </div>
        </div>
      </div>

      {dialogConfig && (
        <div className="project-workflow-dialog-overlay" onClick={handleCloseDialog}>
          <div
            className="project-workflow-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-workflow-dialog-title"
          >
            <div className="project-workflow-dialog-header">
              <div className={`project-workflow-dialog-icon ${dialogConfig.tone}`}>
                <DialogIcon size={18} />
              </div>

              <div className="project-workflow-dialog-header-copy">
                <div className="project-workflow-dialog-kicker">
                  Workflow action
                </div>
                <h3 id="project-workflow-dialog-title">{dialogConfig.title}</h3>
                <p className="project-workflow-dialog-description">{dialogConfig.description}</p>
              </div>

              <button
                type="button"
                className="project-workflow-dialog-close"
                onClick={handleCloseDialog}
                disabled={isBusy}
                aria-label="Close workflow dialog"
              >
                <X size={16} />
              </button>
            </div>

            {(dialogConfig.showTargetSelect || dialogConfig.commentLabel) && (
              <div className="project-workflow-dialog-body">
                {dialogConfig.showTargetSelect && (
                  <label className="project-workflow-field">
                    <span className="project-workflow-field-label">Reopen target</span>
                    <select
                      className="project-workflow-select"
                      value={reopenTarget}
                      onChange={(event) => setReopenTarget(event.target.value)}
                      disabled={isBusy}
                    >
                      <option value="development">Development</option>
                      <option value="qa" disabled={!qaAssigned}>
                        QA{qaAssigned ? '' : ' (QA is not assigned)'}
                      </option>
                    </select>
                  </label>
                )}

                {dialogConfig.commentLabel && (
                  <label className="project-workflow-field">
                    <span className="project-workflow-field-label">
                      {dialogConfig.commentLabel}
                      {dialogConfig.commentRequired ? ' *' : ''}
                    </span>
                    <textarea
                      className="project-workflow-textarea"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={dialogConfig.commentPlaceholder}
                      disabled={isBusy}
                      rows={5}
                    />
                  </label>
                )}

                {dialogConfig.commentRequired && !comment.trim() && (
                  <div className="project-workflow-validation">
                    Feedback is required for this transition.
                  </div>
                )}
              </div>
            )}

            <div className="project-workflow-dialog-actions">
              <button
                type="button"
                className="project-workflow-button ghost"
                onClick={handleCloseDialog}
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`project-workflow-button ${dialogConfig.tone}`}
                onClick={handleConfirmDialog}
                disabled={isBusy || (dialogConfig.commentRequired && !comment.trim())}
              >
                {isBusy ? (
                  <>
                    <Save size={14} />
                    Processing...
                  </>
                ) : (
                  <>
                    <DialogIcon size={14} />
                    {dialogConfig.confirmLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const WorkflowActionButton = ({
  icon: Icon,
  label,
  tone,
  disabled,
  title,
  onClick
}) => {
  return (
    <button
      type="button"
      className={`project-workflow-button ${tone}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

export default ProjectWorkflowBar

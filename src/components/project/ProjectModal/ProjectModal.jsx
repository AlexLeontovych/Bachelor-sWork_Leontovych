import { useEffect, useMemo } from 'react'
import { ArrowRight, Check, ChevronDown, Monitor, Smartphone, Sparkles, X } from 'lucide-react'
import { DEFAULT_PROJECT_STATUS } from '../../shared/utils/constants'
import { getWorkflowTeamRole, getWorkflowTeamRoleLabel } from '../../shared/utils/projectWorkflow'
import './ProjectModal.css'

const PROJECT_STATUS_OPTIONS = [
  { value: 'development', label: 'Development' },
  { value: 'qa', label: 'QA Review' },
  { value: 'production', label: 'Production' },
  { value: 'archived', label: 'Archived' }
]

const ORIENTATION_OPTIONS = [
  {
    value: 'landscape',
    label: 'Landscape',
    description: '16:9 · Desktop, video, banners',
    icon: Monitor
  },
  {
    value: 'portrait',
    label: 'Portrait',
    description: '9:16 · Mobile, stories, social',
    icon: Smartphone
  }
]

const PROJECT_FORMATS_BY_ORIENTATION = {
  landscape: ['Banner', 'Video', 'Display'],
  portrait: ['Interstitial', 'Social', 'Video']
}

const ProjectModal = ({
  projectName,
  projectStatus,
  projectFormat,
  screenFormat,
  developerId,
  qaId,
  assignableUsers = [],
  canAssignProjectMembers = false,
  onNameChange,
  onStatusChange,
  onFormatChange,
  onScreenFormatChange,
  onDeveloperChange,
  onQaChange,
  onClose,
  onSave,
  onSaveAndOpen
}) => {
  const isValid = Boolean(projectName.trim() && projectStatus && projectFormat)
  const lockedStatusLabel =
    PROJECT_STATUS_OPTIONS.find((option) => option.value === DEFAULT_PROJECT_STATUS)?.label || 'Development'
  const developerUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => getWorkflowTeamRole(toWorkflowProfile(workflowUser)) === 'developer')
  ), [assignableUsers])
  const qaUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => getWorkflowTeamRole(toWorkflowProfile(workflowUser)) === 'qa')
  ), [assignableUsers])
  const availableProjectFormats = PROJECT_FORMATS_BY_ORIENTATION[screenFormat] || PROJECT_FORMATS_BY_ORIENTATION.landscape

  useEffect(() => {
    if (!availableProjectFormats.includes(projectFormat)) {
      onFormatChange(availableProjectFormats[0])
    }
  }, [availableProjectFormats, onFormatChange, projectFormat])

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay project-modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-dialog project-modal-dialog">
        <div className="modal-header project-modal-header">
          <div className="project-modal-heading">
            <div className="project-modal-heading__badge" aria-hidden="true">
              <Sparkles size={16} />
            </div>
            <div className="project-modal-heading__copy">
              <span className="project-modal-eyebrow">New creative</span>
              <h2 className="modal-title">Start a new project</h2>
            </div>
            <p className="project-modal-subtitle">
              Choose orientation, name your project, and drop into the studio. You can reconfigure everything later.
            </p>
          </div>
          <button type="button" className="modal-close project-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-content project-modal-content">
          <div className="project-modal-section">
            <div className="project-modal-section-label">Orientation</div>
            <div className="project-modal-orientation-grid">
              {ORIENTATION_OPTIONS.map((option) => {
                const OrientationIcon = option.icon
                const isSelected = screenFormat === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`project-modal-orientation-card ${isSelected ? 'active' : ''}`}
                    onClick={() => onScreenFormatChange(option.value)}
                  >
                    <span className={`project-modal-orientation-card__check ${isSelected ? 'active' : ''}`} aria-hidden="true">
                      {isSelected && <Check size={12} />}
                    </span>
                    <div className="project-modal-orientation-card__icon">
                      <OrientationIcon size={18} />
                    </div>
                    <div className="project-modal-orientation-card__copy">
                      <div className="project-modal-orientation-card__label">{option.label}</div>
                      <div className="project-modal-orientation-card__meta">{option.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="project-modal-form-grid">
            <div className="modal-field">
              <label className="modal-label" htmlFor="projectName">
                Project name<span className="required">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                className="modal-input"
                value={projectName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Premium summer launch"
              />
            </div>

            <div className="modal-field">
              <label className="modal-label" htmlFor="projectStatus">
                Status<span className="required">*</span>
              </label>
              <select
                id="projectStatus"
                className="modal-select project-modal-status-select"
                value={DEFAULT_PROJECT_STATUS}
                onChange={() => onStatusChange(DEFAULT_PROJECT_STATUS)}
                disabled
              >
                <option value={DEFAULT_PROJECT_STATUS}>{lockedStatusLabel}</option>
              </select>
            </div>
          </div>

          <div className="project-modal-section">
            <div className="project-modal-section-label">Format</div>
            <div className="project-modal-format-grid">
              {availableProjectFormats.map((formatOption) => (
                <button
                  key={formatOption}
                  type="button"
                  className={`project-modal-format-pill ${projectFormat === formatOption ? 'active' : ''}`}
                  onClick={() => onFormatChange(formatOption)}
                >
                  {formatOption}
                </button>
              ))}
            </div>
          </div>

          {canAssignProjectMembers && (
            <div className="project-modal-section project-modal-assignment-section">
              <div className="project-modal-section-label">Project team</div>

              <div className="project-modal-assignment-grid">
                <AssigneeSelectField
                  label="Developer"
                  users={developerUsers}
                  value={developerId}
                  emptyLabel="No developer assigned"
                  onChange={onDeveloperChange}
                />
                <AssigneeSelectField
                  label="QA reviewer"
                  users={qaUsers}
                  value={qaId}
                  emptyLabel="No QA assigned"
                  onChange={onQaChange}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer project-modal-footer">
          <div className="project-modal-footnote">
            Created projects enter <strong>{lockedStatusLabel}</strong> stage by default.
          </div>
          <div className="project-modal-footer-actions">
            <button type="button" className="modal-button-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="modal-button-save"
              onClick={onSave}
              disabled={!isValid}
            >
              Save
            </button>
            <button
              type="button"
              className="modal-button-save project-modal-open-button"
              onClick={onSaveAndOpen}
              disabled={!isValid}
            >
              Save &amp; open studio
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const toWorkflowProfile = (workflowUser) => ({
  role: workflowUser.profileRole || workflowUser.role,
  workspace_role: workflowUser.membershipRole || workflowUser.workspace_role,
  workflow_role: workflowUser.workflowRole || workflowUser.workflow_role,
  team_role: workflowUser.teamRole || workflowUser.team_role
})

const getAssigneeLabel = (workflowUser) => (
  workflowUser?.fullName ||
  workflowUser?.full_name ||
  workflowUser?.email ||
  'Workspace member'
)

const getAssigneeMeta = (workflowUser) => {
  const roleLabel = getWorkflowTeamRoleLabel(toWorkflowProfile(workflowUser))
  const email = workflowUser?.email

  if (!email || email === getAssigneeLabel(workflowUser)) {
    return roleLabel
  }

  return `${email} · ${roleLabel}`
}

const AssigneeSelectField = ({
  label,
  users,
  value,
  emptyLabel,
  onChange
}) => (
  <div className="project-modal-assignee-field">
    <label className="modal-label">{label}</label>
    <div className="project-modal-assignee-select-wrap">
      <select
        className="project-modal-assignee-select"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {users.map((workflowUser) => (
          <option key={workflowUser.id} value={workflowUser.id}>
            {getAssigneeLabel(workflowUser)} · {getAssigneeMeta(workflowUser)}
          </option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </div>
  </div>
)

export default ProjectModal

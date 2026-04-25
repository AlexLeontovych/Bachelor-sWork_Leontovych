import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, FileUp, UploadCloud, X } from 'lucide-react'
import { DEFAULT_PROJECT_STATUS, PROJECT_FORMATS } from '../../shared/utils/constants'
import { getWorkflowTeamRole, getWorkflowTeamRoleLabel } from '../../shared/utils/projectWorkflow'
import { readImportedProjectHtmlFile, type ImportedProjectHtml } from '../importProjectHtml'
import './ProjectImportModal.css'

type WorkflowUser = {
  id: string
  email?: string
  fullName?: string
  full_name?: string
  role?: string
  profileRole?: string
  membershipRole?: string
  workspace_role?: string
  workflowRole?: string | null
  workflow_role?: string | null
  teamRole?: string | null
  team_role?: string | null
}

export type ProjectImportSubmitInput = {
  name: string
  format: string
  developerId: string | null
  qaId: string | null
  importedProject: ImportedProjectHtml
}

type ProjectImportModalProps = {
  assignableUsers: WorkflowUser[]
  canAssignProjectMembers: boolean
  onClose: () => void
  onSubmit: (input: ProjectImportSubmitInput) => Promise<void> | void
}

const toWorkflowProfile = (workflowUser: WorkflowUser) => ({
  role: workflowUser.profileRole || workflowUser.role,
  workspace_role: workflowUser.membershipRole || workflowUser.workspace_role,
  workflow_role: workflowUser.workflowRole || workflowUser.workflow_role,
  team_role: workflowUser.teamRole || workflowUser.team_role
})

const getAssigneeLabel = (workflowUser: WorkflowUser) => (
  workflowUser.fullName ||
  workflowUser.full_name ||
  workflowUser.email ||
  'Workspace member'
)

const getAssigneeMeta = (workflowUser: WorkflowUser) => {
  const roleLabel = getWorkflowTeamRoleLabel(toWorkflowProfile(workflowUser))
  const email = workflowUser.email

  if (!email || email === getAssigneeLabel(workflowUser)) {
    return roleLabel
  }

  return `${email} · ${roleLabel}`
}

const getDefaultProjectName = (file: File | null) => {
  if (!file) {
    return ''
  }

  return file.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim()
}

const ProjectImportModal = ({
  assignableUsers,
  canAssignProjectMembers,
  onClose,
  onSubmit
}: ProjectImportModalProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectFormat, setProjectFormat] = useState(PROJECT_FORMATS[0] || 'Banner')
  const [developerId, setDeveloperId] = useState('')
  const [qaId, setQaId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importedProject, setImportedProject] = useState<ImportedProjectHtml | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const developerUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => (
      ['developer', 'lead'].includes(getWorkflowTeamRole(toWorkflowProfile(workflowUser)))
    ))
  ), [assignableUsers])

  const qaUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => (
      ['qa', 'lead'].includes(getWorkflowTeamRole(toWorkflowProfile(workflowUser)))
    ))
  ), [assignableUsers])

  const canSubmit = Boolean(projectName.trim() && projectFormat && importedProject && !isReadingFile && !isSubmitting)

  useEffect(() => {
    if (selectedFile && !projectName.trim()) {
      setProjectName(getDefaultProjectName(selectedFile))
    }
  }, [projectName, selectedFile])

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleFileSelect = async (file: File | undefined | null) => {
    try {
      if (!file) {
        return
      }

      setErrorMessage('')
      setSelectedFile(file)
      setIsReadingFile(true)
      const parsedProject = await readImportedProjectHtmlFile(file)
      setImportedProject(parsedProject)

      if (!projectName.trim()) {
        setProjectName(getDefaultProjectName(file))
      }
    } catch (error) {
      setImportedProject(null)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to import the selected HTML file.')
    } finally {
      setIsReadingFile(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFileSelect(event.dataTransfer.files?.[0])
  }

  const handleSubmit = async () => {
    try {
      if (!importedProject || !canSubmit) {
        return
      }

      setErrorMessage('')
      setIsSubmitting(true)
      await onSubmit({
        name: projectName.trim(),
        format: projectFormat,
        developerId: developerId || null,
        qaId: qaId || null,
        importedProject
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create the imported project.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay project-import-modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-dialog project-import-modal-dialog">
        <div className="modal-header project-import-modal-header">
          <div className="project-import-modal-heading">
            <div className="project-import-modal-heading__badge" aria-hidden="true">
              <FileUp size={17} />
            </div>
            <div>
              <span className="project-import-modal-eyebrow">HTML import</span>
              <h2 className="modal-title">Create project from export</h2>
            </div>
            <p className="project-import-modal-subtitle">
              Drop an HTML file exported from this studio and assign the imported creative to your workflow team.
            </p>
          </div>
          <button type="button" className="modal-close project-import-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-content project-import-modal-content">
          <button
            type="button"
            className={`project-import-dropzone ${isDragging ? 'active' : ''} ${importedProject ? 'ready' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              className="project-import-file-input"
              onChange={(event) => void handleFileSelect(event.target.files?.[0])}
            />
            <span className="project-import-dropzone__icon" aria-hidden="true">
              {importedProject ? <Check size={22} /> : <UploadCloud size={24} />}
            </span>
            <span className="project-import-dropzone__title">
              {selectedFile ? selectedFile.name : 'Drop exported HTML here'}
            </span>
            <span className="project-import-dropzone__meta">
              {isReadingFile
                ? 'Reading file...'
                : importedProject
                  ? `${importedProject.images.length} layers restored · ${importedProject.screenFormat}`
                  : 'Only .html files exported from this studio are supported.'}
            </span>
          </button>

          {errorMessage && (
            <div className="project-import-error" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="project-import-form-grid">
            <div className="modal-field">
              <label className="modal-label" htmlFor="importProjectName">
                Project name<span className="required">*</span>
              </label>
              <input
                id="importProjectName"
                type="text"
                className="modal-input"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Imported campaign creative"
              />
            </div>

            <div className="modal-field">
              <label className="modal-label" htmlFor="importProjectStatus">
                Status
              </label>
              <select id="importProjectStatus" className="modal-select" value={DEFAULT_PROJECT_STATUS} disabled>
                <option value={DEFAULT_PROJECT_STATUS}>Development</option>
              </select>
            </div>
          </div>

          <div className="project-import-section">
            <div className="project-import-section-label">Format</div>
            <div className="project-import-format-grid">
              {PROJECT_FORMATS.map((formatOption) => (
                <button
                  key={formatOption}
                  type="button"
                  className={`project-import-format-pill ${projectFormat === formatOption ? 'active' : ''}`}
                  onClick={() => setProjectFormat(formatOption)}
                >
                  {formatOption}
                </button>
              ))}
            </div>
          </div>

          {canAssignProjectMembers && (
            <div className="project-import-section">
              <div className="project-import-section-label">Project team</div>
              <div className="project-import-assignment-grid">
                <AssigneeSelectField
                  label="Developer"
                  users={developerUsers}
                  value={developerId}
                  emptyLabel="No developer assigned"
                  onChange={setDeveloperId}
                />
                <AssigneeSelectField
                  label="QA reviewer"
                  users={qaUsers}
                  value={qaId}
                  emptyLabel="No QA assigned"
                  onChange={setQaId}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer project-import-modal-footer">
          <div className="project-import-footnote">
            Imported projects enter <strong>Development</strong> stage by default.
          </div>
          <div className="project-import-footer-actions">
            <button type="button" className="modal-button-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="modal-button-save"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? 'Importing...' : 'Create imported project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type AssigneeSelectFieldProps = {
  label: string
  users: WorkflowUser[]
  value: string
  emptyLabel: string
  onChange: (value: string) => void
}

const AssigneeSelectField = ({
  label,
  users,
  value,
  emptyLabel,
  onChange
}: AssigneeSelectFieldProps) => (
  <div className="project-import-assignee-field">
    <label className="modal-label">{label}</label>
    <div className="project-import-assignee-select-wrap">
      <select
        className="project-import-assignee-select"
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

export default ProjectImportModal

import { ArrowUpRight, Download, Eye, Monitor, Smartphone, Trash2 } from 'lucide-react'
import {
  canDeleteProject,
  canManageProject,
  getProjectAccessMessage,
  getProjectStatusLabel,
  normalizeProjectStatus
} from '../../../shared/utils/projectWorkflow'
import StatusChip from '../../../shared/ui/StatusChip'

interface ProjectsTabProps {
  projects: Array<Record<string, any>>
  profile: Record<string, any> | null
  onBack: () => void
  onEditProject?: (project: Record<string, any>) => void
  onProjectPreview?: (project: Record<string, any>, format: string) => void
  onProjectExport?: (project: Record<string, any>) => void
  onDeleteProject?: (projectId: string) => void | Promise<void>
  onRemoveProjectLocally?: (projectId: string) => void
}

const formatDate = (value?: string) => {
  if (!value) {
    return 'Not available'
  }

  return new Date(value).toLocaleDateString('en-US')
}

const ProjectsTab = ({
  projects,
  profile,
  onBack,
  onEditProject,
  onProjectPreview,
  onProjectExport,
  onDeleteProject,
  onRemoveProjectLocally
}: ProjectsTabProps) => {
  if (projects.length === 0) {
    return (
      <div className="cabinet-empty-state glass-panel">
        <h3>No projects yet</h3>
        <p>Create your first project to see it inside your cabinet.</p>
      </div>
    )
  }

  return (
    <div className="cabinet-project-card-grid">
      {projects.map((project) => {
        const canEditCurrentProject = canManageProject(project, profile)
        const canDeleteCurrentProject = canDeleteProject(project, profile)
        const editProjectTitle = getProjectAccessMessage(project, profile, 'edit')
        const deleteProjectTitle = getProjectAccessMessage(project, profile, 'delete')
        const projectStatusLabel = project.isArchived
          ? `${getProjectStatusLabel(project.status)} (Archived)`
          : getProjectStatusLabel(project.status)
        const projectOrientation = (project.screenFormat || project.screen_format || 'landscape').toLowerCase()
        const hasAssets = Array.isArray(project.images) && project.images.length > 0
        const IdentifierIcon = projectOrientation === 'portrait' ? Smartphone : Monitor

        return (
          <article key={String(project.id)} className="glass-panel cabinet-project-card">
            <div className="cabinet-project-card__preview">
              <div className="cabinet-project-card__preview-background" />
              <div className="cabinet-project-card__preview-highlight" />
              <div className="cabinet-project-card__preview-grid grid-pattern" />
              <div className="cabinet-project-card__preview-content">
                <div className="cabinet-project-card__preview-top">
                  <StatusChip
                    status={project.isArchived ? 'archived' : normalizeProjectStatus(project.status)}
                    label={projectStatusLabel}
                    size="sm"
                  />
                  <div className="cabinet-project-card__identifier">
                    #{String(project.id).slice(0, 8)}
                  </div>
                </div>

                <div>
                  <div className="cabinet-project-card__name">{project.name}</div>
                  <div className="cabinet-project-card__meta">
                    <IdentifierIcon size={12} />
                    {projectOrientation} / {project.format || 'PageGrabber X'}
                  </div>
                </div>
              </div>
            </div>

            <div className="cabinet-project-card__footer">
              <div className="cabinet-project-card__dates">
                <div>Created {formatDate(project.createdAt || project.created_at)}</div>
                <div>Updated {formatDate(project.updatedAt || project.updated_at || project.createdAt || project.created_at)}</div>
              </div>

              <div className="cabinet-project-card__actions">
                <IconButton
                  icon={Eye}
                  label="Preview"
                  disabled={!hasAssets}
                  onClick={() => {
                    if (hasAssets && onProjectPreview) {
                      onProjectPreview(project, projectOrientation)
                    } else {
                      alert('No images in project for preview')
                    }
                  }}
                />
                <IconButton
                  icon={Download}
                  label="Export"
                  disabled={!hasAssets}
                  onClick={() => {
                    if (hasAssets && onProjectExport) {
                      onProjectExport(project)
                    } else {
                      alert('No images in project for export')
                    }
                  }}
                />
                <IconButton
                  icon={ArrowUpRight}
                  label="Open"
                  primary
                  disabled={!canEditCurrentProject}
                  title={editProjectTitle}
                  onClick={() => {
                    if (!canEditCurrentProject) {
                      alert(editProjectTitle)
                      return
                    }

                    onEditProject?.(project)
                    onBack()
                  }}
                />
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  danger
                  disabled={!canDeleteCurrentProject}
                  title={deleteProjectTitle}
                  onClick={async () => {
                    if (!canDeleteCurrentProject) {
                      alert(deleteProjectTitle)
                      return
                    }

                    if (!window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                      return
                    }

                    await onDeleteProject?.(String(project.id))
                    onRemoveProjectLocally?.(String(project.id))
                  }}
                />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

interface IconButtonProps {
  icon: typeof Eye
  label: string
  disabled?: boolean
  title?: string
  primary?: boolean
  danger?: boolean
  onClick: () => void | Promise<void>
}

const IconButton = ({
  icon: Icon,
  label,
  disabled = false,
  title,
  primary = false,
  danger = false,
  onClick
}: IconButtonProps) => {
  return (
    <button
      type="button"
      className={[
        'cabinet-icon-button',
        primary ? 'primary' : '',
        danger ? 'danger' : ''
      ].filter(Boolean).join(' ')}
      title={title || label}
      disabled={disabled}
      onClick={() => {
        void onClick()
      }}
    >
      <Icon size={14} />
    </button>
  )
}

export default ProjectsTab

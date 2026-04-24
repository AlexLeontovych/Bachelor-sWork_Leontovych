import { ArrowLeft, Hash, Monitor, Smartphone } from 'lucide-react'
import './Header.css'

const Header = ({ project, onBack }) => {
  const projectName = project?.name || 'Untitled creative'
  const projectId = project?.id ? String(project.id).slice(0, 8) : 'draft'
  const screenFormat = (project?.screenFormat || project?.screen_format) === 'portrait' ? 'portrait' : 'landscape'
  const OrientationIcon = screenFormat === 'portrait' ? Smartphone : Monitor
  const subtitle = `LPM-${projectId.toUpperCase()} · ${(project?.format || 'creative').toLowerCase()} · ${screenFormat}`

  return (
    <div className="studio-header glass-panel">
      <div className="studio-header-leading">
        <button className="studio-back-button" type="button" onClick={onBack} aria-label="Return to projects">
          <ArrowLeft size={16} />
        </button>

        <div className="studio-header-project">
          <div className="studio-header-title-row">
            <h1 className="studio-title">{projectName}</h1>
            <span className="studio-header-project-code">LPM-{projectId.toUpperCase()}</span>
          </div>
          <p className="studio-header-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="studio-header-meta">
        <span className="studio-header-chip">{project?.format || 'Creative'}</span>
        <span className="studio-header-chip">
          <OrientationIcon size={14} />
          {screenFormat}
        </span>
        <span className="studio-header-chip subtle">
          <Hash size={14} />
          {projectId}
        </span>
      </div>
    </div>
  )
}

export default Header

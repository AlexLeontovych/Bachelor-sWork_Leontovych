import { PROJECT_FORMATS, PROJECT_STATUSES } from '../../shared/utils/constants'
import './ProjectModal.css'

const ProjectModal = ({
  projectName,
  projectStatus,
  projectFormat,
  screenFormat,
  onNameChange,
  onStatusChange,
  onFormatChange,
  onScreenFormatChange,
  onClose,
  onSave,
  onSaveAndOpen
}) => {
  const isValid = projectName.trim() && projectStatus && projectFormat

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">New Creative</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-buttons-top">
          <button 
            className={`modal-button-top ${screenFormat === 'landscape' ? 'active' : ''}`}
            onClick={() => onScreenFormatChange('landscape')}
          >
            Device: Landscape (1024×600)
          </button>
          <button 
            className={`modal-button-top ${screenFormat === 'portrait' ? 'active' : ''}`}
            onClick={() => onScreenFormatChange('portrait')}
          >
            Device: Portrait (390×884)
          </button>
        </div>

        <div className="modal-content">
          <div className="modal-field">
            <label className="modal-label">
              Name<span className="required">*</span>
            </label>
            <input
              type="text"
              className="modal-input"
              value={projectName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="New PIXL Studios 2018 Creative"
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">
              Status<span className="required">*</span>
            </label>
            <select
              className="modal-select"
              value={projectStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled
            >
              <option value="Paused">Paused</option>
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label">
              Format<span className="required">*</span>
            </label>
            <select
              className="modal-select"
              value={projectFormat}
              onChange={(e) => onFormatChange(e.target.value)}
              disabled
            >
              <option value="PageGrabber X">PageGrabber X</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-button-save"
            onClick={onSave}
            disabled={!isValid}
          >
            Save
          </button>
          <button
            className="modal-button-save"
            onClick={onSaveAndOpen}
            disabled={!isValid}
          >
            Save & Open Studio
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectModal


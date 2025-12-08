import './Header.css'

const Header = ({ project, onBack }) => {
  return (
    <div className="studio-header">
      <div className="studio-title">
        Creative:{project?.name || 'New Creative'}[{project?.id || '000000'}][{project?.format || 'PageGrabber X'}]
      </div>
      <button className="studio-back-button" onClick={onBack}>
        ← Back to Projects
      </button>
    </div>
  )
}

export default Header


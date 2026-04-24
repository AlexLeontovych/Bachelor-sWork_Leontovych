import { useEffect } from 'react'
import { AlertTriangle, Save, X } from 'lucide-react'
import StatusChip from '../../shared/ui/StatusChip'
import './UnsavedChangesModal.css'

/**
 * Shows a confirmation dialog before leaving the editor with unsaved changes.
 *
 * @param {Object} props
 * @param {string} [props.projectName]
 * @param {boolean} props.isSaving
 * @param {() => void} props.onCancel
 * @param {() => void} props.onDiscard
 * @param {() => void} props.onSaveAndLeave
 * @returns {JSX.Element}
 */
const UnsavedChangesModal = ({ projectName, isSaving, onCancel, onDiscard, onSaveAndLeave }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || isSaving) {
        return
      }

      try {
        onCancel()
      } catch (error) {
        console.error('Error closing unsaved changes modal with Escape:', error)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSaving, onCancel])

  const handleOverlayClick = (event) => {
    if (event.target !== event.currentTarget || isSaving) {
      return
    }

    try {
      onCancel()
    } catch (error) {
      console.error('Error closing unsaved changes modal from overlay:', error)
    }
  }

  const handleCancelClick = () => {
    try {
      const cancelResult = onCancel()
      if (cancelResult && typeof cancelResult.then === 'function') {
        cancelResult.catch((error) => {
          console.error('Async error while cancelling unsaved changes modal:', error)
        })
      }
    } catch (error) {
      console.error('Error cancelling unsaved changes modal:', error)
    }
  }

  const handleDiscardClick = () => {
    try {
      const discardResult = onDiscard()
      if (discardResult && typeof discardResult.then === 'function') {
        discardResult.catch((error) => {
          console.error('Async error while discarding unsaved changes:', error)
        })
      }
    } catch (error) {
      console.error('Error discarding unsaved changes:', error)
    }
  }

  const handleSaveAndLeaveClick = () => {
    try {
      const saveResult = onSaveAndLeave()
      if (saveResult && typeof saveResult.then === 'function') {
        saveResult.catch((error) => {
          console.error('Async error while saving changes before leaving editor:', error)
        })
      }
    } catch (error) {
      console.error('Error saving changes before leaving editor:', error)
    }
  }

  return (
    <div className="unsaved-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="unsaved-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-modal-title"
        aria-describedby="unsaved-modal-description"
        aria-busy={isSaving}
      >
        <div className="unsaved-modal-header">
          <div className="unsaved-modal-icon" aria-hidden="true">
            <AlertTriangle size={22} />
          </div>
          <div className="unsaved-modal-header-content">
            <span className="unsaved-modal-eyebrow">Unsaved changes</span>
            <h2 id="unsaved-modal-title" className="unsaved-modal-title">
              Leave editor without losing work?
            </h2>
            <p id="unsaved-modal-description" className="unsaved-modal-description">
              {projectName
                ? `You have unsaved changes in "${projectName}". Save them now, discard them, or stay in the editor.`
                : 'You have unsaved changes in the current project. Save them now, discard them, or stay in the editor.'}
            </p>
          </div>
        </div>

        <div className="unsaved-modal-body">
          <div className="unsaved-modal-chip-row">
            <StatusChip status={isSaving ? 'saved' : 'unsaved'} label={isSaving ? 'Saving now' : 'Unsaved draft'} size="sm" pulse={!isSaving} />
            {projectName && <StatusChip status="assigned" label={projectName} size="sm" />}
          </div>

          <div className="unsaved-modal-summary">
            <div className="unsaved-modal-summary-label">Current action</div>
            <div className="unsaved-modal-summary-value">
              {isSaving
                ? 'Saving your project before leaving the studio.'
                : 'Leaving now will close the current editing session and remove any unsaved updates.'}
            </div>
          </div>
        </div>

        <div className="unsaved-modal-footer">
          <button
            type="button"
            className="unsaved-modal-button unsaved-modal-button-secondary"
            onClick={handleCancelClick}
            disabled={isSaving}
            autoFocus
          >
            <X size={14} />
            Stay in editor
          </button>
          <button
            type="button"
            className="unsaved-modal-button unsaved-modal-button-danger"
            onClick={handleDiscardClick}
            disabled={isSaving}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className="unsaved-modal-button unsaved-modal-button-primary glow-blue"
            onClick={handleSaveAndLeaveClick}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save and leave'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnsavedChangesModal

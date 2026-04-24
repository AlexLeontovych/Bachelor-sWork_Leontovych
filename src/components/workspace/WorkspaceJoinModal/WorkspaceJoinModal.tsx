import { useState, type FormEvent, type MouseEvent } from 'react'
import { Building2, KeyRound, LogIn, X } from 'lucide-react'
import { validateWorkspaceJoinRequest } from '../../../features/workspaceOnboarding/workspaceJoinCredentials'
import './WorkspaceJoinModal.css'

interface WorkspaceJoinModalProps {
  onClose: () => void
  onJoin: (input: { workspaceLogin: string; workspacePassword: string }) => Promise<unknown>
}

/**
 * Renders a styled modal for joining a team workspace via shared credentials.
 *
 * @param props Workspace join modal callbacks.
 * @returns A workspace join form modal.
 *
 * @example
 * <WorkspaceJoinModal onClose={closeModal} onJoin={joinWorkspace} />
 */
const WorkspaceJoinModal = ({ onClose, onJoin }: WorkspaceJoinModalProps) => {
  const [workspaceLogin, setWorkspaceLogin] = useState('')
  const [workspacePassword, setWorkspacePassword] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isJoining) {
      return
    }

    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedbackError('')
    setFeedbackSuccess('')

    try {
      setIsJoining(true)
      const validatedRequest = validateWorkspaceJoinRequest({
        workspaceLogin,
        workspacePassword
      })

      const joinResult = await onJoin(validatedRequest)
      const isPendingApproval =
        joinResult &&
        typeof joinResult === 'object' &&
        'status' in joinResult &&
        joinResult.status === 'pending_approval'

      setFeedbackSuccess(
        isPendingApproval
          ? 'Request sent. The team lead will review it and you will receive a live notification.'
          : 'Workspace joined successfully. Opening your team workspace...'
      )
      window.setTimeout(onClose, 450)
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : 'Unable to join this workspace.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="workspace-join-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="workspace-join-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-join-modal-title"
        aria-describedby="workspace-join-modal-description"
        aria-busy={isJoining}
      >
        <div className="workspace-join-modal__header">
          <div className="workspace-join-modal__icon" aria-hidden="true">
            <Building2 size={24} />
          </div>
          <div>
            <span className="workspace-join-modal__eyebrow">Team workspace</span>
            <h2 id="workspace-join-modal-title" className="workspace-join-modal__title">
              Join by access code
            </h2>
            <p id="workspace-join-modal-description" className="workspace-join-modal__description">
              Enter the shared workspace login and password from your team lead to join a corporate workspace.
            </p>
          </div>
        </div>

        <form className="workspace-join-modal__body" onSubmit={handleSubmit}>
          <label className="workspace-join-modal__field">
            <span>Workspace login / code</span>
            <div className="workspace-join-modal__input-wrap">
              <Building2 size={15} />
              <input
                type="text"
                value={workspaceLogin}
                onChange={(event) => setWorkspaceLogin(event.target.value)}
                placeholder="team-workspace-code"
                autoComplete="off"
                disabled={isJoining}
                required
              />
            </div>
          </label>

          <label className="workspace-join-modal__field">
            <span>Workspace password</span>
            <div className="workspace-join-modal__input-wrap">
              <KeyRound size={15} />
              <input
                type="password"
                value={workspacePassword}
                onChange={(event) => setWorkspacePassword(event.target.value)}
                placeholder="Enter shared password"
                autoComplete="current-password"
                disabled={isJoining}
                required
              />
            </div>
          </label>

          {feedbackError && <div className="workspace-join-modal__feedback error">{feedbackError}</div>}
          {feedbackSuccess && <div className="workspace-join-modal__feedback success">{feedbackSuccess}</div>}

          <div className="workspace-join-modal__footer">
            <button
              type="button"
              className="workspace-join-modal__button workspace-join-modal__button-secondary"
              onClick={onClose}
              disabled={isJoining}
            >
              <X size={14} />
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-join-modal__button workspace-join-modal__button-primary glow-blue"
              disabled={isJoining}
            >
              <LogIn size={14} />
              {isJoining ? 'Joining...' : 'Join workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WorkspaceJoinModal

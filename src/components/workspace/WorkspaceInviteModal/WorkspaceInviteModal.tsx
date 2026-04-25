import type { MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, Check, Mail, UserRound, X } from 'lucide-react'
import RoleBadge from '../../shared/ui/RoleBadge'
import './WorkspaceInviteModal.css'

type WorkspaceInviteModalData = {
  workspaceId: string
  workspaceName: string
  workflowRole: 'developer' | 'qa' | 'lead' | 'member'
  workflowRoleLabel: string
  invitedByName: string | null
  invitedByEmail: string | null
  isLoadingDetails?: boolean
  detailsError?: string | null
}

interface WorkspaceInviteModalProps {
  invite: WorkspaceInviteModalData | null
  isSubmitting?: boolean
  onAccept: () => void
  onDecline: () => void
  onClose: () => void
}

interface InviteDetailProps {
  icon: LucideIcon
  label: string
  value: ReactNode
}

/**
 * Shows a workspace invitation review dialog before accepting or declining.
 *
 * @param props Workspace invite modal configuration.
 * @returns A styled invitation modal or null when no invite is selected.
 *
 * @example
 * <WorkspaceInviteModal invite={invite} onAccept={acceptInvite} onDecline={declineInvite} onClose={closeInvite} />
 */
const WorkspaceInviteModal = ({
  invite,
  isSubmitting = false,
  onAccept,
  onDecline,
  onClose
}: WorkspaceInviteModalProps) => {
  if (!invite) {
    return null
  }

  const invitedBy = invite.invitedByName || invite.invitedByEmail || 'Workspace lead'
  const invitedRole = invite.workflowRoleLabel || 'Workspace member'

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isSubmitting) {
      return
    }

    try {
      onClose()
    } catch (error) {
      console.error('Error closing workspace invitation modal from overlay:', error)
    }
  }

  return (
    <div className="workspace-invite-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="workspace-invite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-invite-modal-title"
        aria-describedby="workspace-invite-modal-description"
        aria-busy={isSubmitting}
      >
        <div className="workspace-invite-modal__header">
          <div className="workspace-invite-modal__icon" aria-hidden="true">
            <Building2 size={24} />
          </div>
          <div>
            <span className="workspace-invite-modal__eyebrow">Workspace invitation</span>
            <h2 id="workspace-invite-modal-title" className="workspace-invite-modal__title">
              Join {invite.workspaceName}
            </h2>
            <p id="workspace-invite-modal-description" className="workspace-invite-modal__description">
              {invite.isLoadingDetails
                ? 'Loading the full invitation details...'
                : invite.detailsError || 'Review this invitation before switching into a new team workspace.'}
            </p>
          </div>
        </div>

        <div className="workspace-invite-modal__body">
          <div className="workspace-invite-modal__details">
            <InviteDetail icon={UserRound} label="Invited by" value={invitedBy} />
            <InviteDetail icon={Building2} label="Workspace" value={invite.workspaceName} />
            <InviteDetail
              icon={Mail}
              label="Your role"
              value={<RoleBadge role={invite.workflowRole} label={invitedRole} size="sm" />}
            />
          </div>
        </div>

        <div className="workspace-invite-modal__footer">
          <button
            type="button"
            className="workspace-invite-modal__button workspace-invite-modal__button-secondary"
            onClick={onDecline}
            disabled={isSubmitting}
          >
            <X size={14} />
            Decline
          </button>
          <button
            type="button"
            className="workspace-invite-modal__button workspace-invite-modal__button-primary glow-blue"
            onClick={onAccept}
            disabled={isSubmitting}
          >
            <Check size={14} />
            {isSubmitting ? 'Joining...' : 'Accept invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

const InviteDetail = ({ icon: Icon, label, value }: InviteDetailProps) => (
  <div className="workspace-invite-modal__detail">
    <div className="workspace-invite-modal__detail-label">
      <Icon size={13} />
      {label}
    </div>
    <div className="workspace-invite-modal__detail-value">{value}</div>
  </div>
)

export default WorkspaceInviteModal

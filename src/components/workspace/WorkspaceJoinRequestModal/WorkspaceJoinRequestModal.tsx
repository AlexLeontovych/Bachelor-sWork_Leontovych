import { useState, type MouseEvent } from 'react'
import { Check, Clock3, ShieldCheck, UserRound, X } from 'lucide-react'
import RoleBadge from '../../shared/ui/RoleBadge'
import './WorkspaceJoinRequestModal.css'

type WorkspaceWorkflowRole = 'developer' | 'qa' | 'lead'

type WorkspaceJoinRequestDetails = {
  requestId: string
  workspaceId: string
  workspaceName: string
  requesterUserId: string
  requesterName: string | null
  requesterEmail: string | null
  status: 'pending' | 'accepted' | 'declined'
  requestedAt: string
  workflowRole: WorkspaceWorkflowRole | null
  isLoadingDetails?: boolean
  detailsError?: string | null
}

interface WorkspaceJoinRequestModalProps {
  request: WorkspaceJoinRequestDetails | null
  isSubmitting?: boolean
  onAccept: (workflowRole: WorkspaceWorkflowRole) => void
  onDecline: () => void
  onClose: () => void
}

const formatRequestedAt = (value: string) => {
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return 'Recently'
  }
}

/**
 * Shows a team lead review dialog for workspace join requests created by shared credentials.
 *
 * @param props Workspace join request modal configuration.
 * @returns A styled review modal or null when no request is selected.
 *
 * @example
 * <WorkspaceJoinRequestModal request={request} onAccept={accept} onDecline={decline} onClose={close} />
 */
const WorkspaceJoinRequestModal = ({
  request,
  isSubmitting = false,
  onAccept,
  onDecline,
  onClose
}: WorkspaceJoinRequestModalProps) => {
  const [selectedRole, setSelectedRole] = useState<WorkspaceWorkflowRole>('developer')

  if (!request) {
    return null
  }

  const requesterLabel = request.requesterName || request.requesterEmail || 'Workspace user'
  const isRequestActionDisabled = Boolean(isSubmitting || request.isLoadingDetails || request.detailsError || request.status !== 'pending')

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isSubmitting) {
      return
    }

    onClose()
  }

  return (
    <div className="workspace-join-request-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="workspace-join-request-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-join-request-modal-title"
        aria-describedby="workspace-join-request-modal-description"
        aria-busy={isSubmitting}
      >
        <div className="workspace-join-request-modal__header">
          <div className="workspace-join-request-modal__icon" aria-hidden="true">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="workspace-join-request-modal__eyebrow">Access request</span>
            <h2 id="workspace-join-request-modal-title" className="workspace-join-request-modal__title">
              Review workspace access
            </h2>
            <p id="workspace-join-request-modal-description" className="workspace-join-request-modal__description">
              {request.isLoadingDetails
                ? 'Loading the full request details...'
                : request.detailsError || `${requesterLabel} wants to join ${request.workspaceName}.`}
            </p>
          </div>
        </div>

        <div className="workspace-join-request-modal__body">
          <div className="workspace-join-request-modal__details">
            <RequestDetail icon={UserRound} label="Requested by" value={requesterLabel} />
            <RequestDetail icon={ShieldCheck} label="Workspace" value={request.workspaceName} />
            <RequestDetail icon={Clock3} label="Requested at" value={formatRequestedAt(request.requestedAt)} />
          </div>

          <div className="workspace-join-request-modal__role-card">
            <div>
              <div className="workspace-join-request-modal__role-label">Assign role before approval</div>
              <div className="workspace-join-request-modal__role-copy">
                This role controls the member's project workflow permissions after joining.
              </div>
            </div>
            <div className="workspace-join-request-modal__role-actions">
              <button
                type="button"
                className={selectedRole === 'lead' ? 'active' : ''}
                onClick={() => setSelectedRole('lead')}
                disabled={isSubmitting}
              >
                <RoleBadge role="lead" label="Lead" size="sm" />
              </button>
              <button
                type="button"
                className={selectedRole === 'developer' ? 'active' : ''}
                onClick={() => setSelectedRole('developer')}
                disabled={isSubmitting}
              >
                <RoleBadge role="developer" label="Developer" size="sm" />
              </button>
              <button
                type="button"
                className={selectedRole === 'qa' ? 'active' : ''}
                onClick={() => setSelectedRole('qa')}
                disabled={isSubmitting}
              >
                <RoleBadge role="qa" label="QA" size="sm" />
              </button>
            </div>
          </div>
        </div>

        <div className="workspace-join-request-modal__footer">
          <button
            type="button"
            className="workspace-join-request-modal__button workspace-join-request-modal__button-secondary"
            onClick={onDecline}
            disabled={isRequestActionDisabled}
          >
            <X size={14} />
            Decline
          </button>
          <button
            type="button"
            className="workspace-join-request-modal__button workspace-join-request-modal__button-primary glow-blue"
            onClick={() => onAccept(selectedRole)}
            disabled={isRequestActionDisabled}
          >
            <Check size={14} />
            {isSubmitting ? 'Reviewing...' : 'Accept request'}
          </button>
        </div>
      </div>
    </div>
  )
}

const RequestDetail = ({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UserRound
  label: string
  value: string
}) => (
  <div className="workspace-join-request-modal__detail">
    <div className="workspace-join-request-modal__detail-label">
      <Icon size={13} />
      {label}
    </div>
    <div className="workspace-join-request-modal__detail-value">{value}</div>
  </div>
)

export default WorkspaceJoinRequestModal

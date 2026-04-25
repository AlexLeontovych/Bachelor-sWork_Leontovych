import { useState, type ChangeEvent, type FormEventHandler } from 'react'
import { AlertTriangle, Building2, Eye, Mail, Plus, Trash2, Users, X } from 'lucide-react'
import RoleBadge from '../../../shared/ui/RoleBadge'
import StatusChip from '../../../shared/ui/StatusChip'
import WorkspaceSwitcher from '../../../shared/ui/WorkspaceSwitcher'

interface WorkspaceMember {
  id: string
  userId?: string
  email?: string
  fullName?: string
  membershipRole?: string
  workflowRole?: string
  profileRole?: string | null
  created_at?: string | null
}

interface WorkspaceInvite {
  id: string
  email: string
  workflowRole?: string
  status?: string
}

interface WorkspaceJoinCredentialsSummary {
  workspaceLogin?: string | null
  hasCredentials?: boolean
  rotatedAt?: string | null
}

interface WorkspaceJoinCredentialsSecret {
  workspacePassword?: string
}

type WorkspaceWorkflowRole = 'developer' | 'qa' | 'lead'

interface ActiveWorkspace {
  workspaceId: string
  workspaceName: string
  workspaceType: string
  workspaceRole: string
}

interface WorkspaceTabProps {
  activeWorkspace: ActiveWorkspace
  accessibleWorkspaces?: Array<Record<string, unknown>>
  workspaceMembers?: WorkspaceMember[]
  workspaceInvites?: WorkspaceInvite[]
  workspaceJoinCredentials?: WorkspaceJoinCredentialsSummary | null
  workspaceJoinSecret?: WorkspaceJoinCredentialsSecret | null
  workspaceInviteEmail: string
  workspaceInviteRole: string
  workspaceInviteError: string
  workspaceInviteSuccess: string
  isWorkspaceInviteLoading: boolean
  onWorkspaceChange?: (workspaceId: string) => void
  onRotateWorkspaceCredentials?: () => void | Promise<unknown>
  onUpdateMemberRole?: (membershipId: string, workflowRole: WorkspaceWorkflowRole) => void | Promise<void>
  onRemoveMember?: (membershipId: string) => void | Promise<void>
  onViewMember?: (member: WorkspaceMember) => void
  onInviteEmailChange: (value: string) => void
  onInviteRoleChange: (value: string) => void
  onInviteSubmit: FormEventHandler<HTMLFormElement>
  onInviteRevoke: (inviteId: string) => void | Promise<void>
}

const getInitials = (fullName?: string, email?: string) => {
  const label = fullName || email || 'WU'
  const segments = label.split(' ').filter(Boolean)

  if (segments.length > 1) {
    return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase()
  }

  return label.slice(0, 2).toUpperCase()
}

const getWorkflowRoleLabel = (workflowRole?: string | null) => {
  if (workflowRole === 'lead') {
    return 'Lead'
  }

  if (workflowRole === 'qa') {
    return 'QA'
  }

  return 'Developer'
}

const getWorkflowRoleValue = (workflowRole?: string | null): WorkspaceWorkflowRole => {
  if (workflowRole === 'lead' || workflowRole === 'qa') {
    return workflowRole
  }

  return 'developer'
}

const WorkspaceTab = ({
  activeWorkspace,
  accessibleWorkspaces = [],
  workspaceMembers = [],
  workspaceInvites = [],
  workspaceJoinCredentials = null,
  workspaceJoinSecret = null,
  workspaceInviteEmail,
  workspaceInviteRole,
  workspaceInviteError,
  workspaceInviteSuccess,
  isWorkspaceInviteLoading,
  onWorkspaceChange,
  onRotateWorkspaceCredentials,
  onUpdateMemberRole,
  onRemoveMember,
  onViewMember,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteSubmit,
  onInviteRevoke
}: WorkspaceTabProps) => {
  const isTeamOwner = activeWorkspace.workspaceType === 'team' && activeWorkspace.workspaceRole === 'owner'
  const [workspaceCredentialsError, setWorkspaceCredentialsError] = useState('')
  const [workspaceCredentialsSuccess, setWorkspaceCredentialsSuccess] = useState('')
  const [isRotatingWorkspaceCredentials, setIsRotatingWorkspaceCredentials] = useState(false)
  const [memberAccessError, setMemberAccessError] = useState('')
  const [memberAccessSuccess, setMemberAccessSuccess] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<WorkspaceMember | null>(null)

  const handleRotateWorkspaceCredentials = async () => {
    if (!onRotateWorkspaceCredentials) {
      setWorkspaceCredentialsError('Workspace credential management is unavailable.')
      return
    }

    try {
      setIsRotatingWorkspaceCredentials(true)
      setWorkspaceCredentialsError('')
      setWorkspaceCredentialsSuccess('')
      const rotatedCredentials = await onRotateWorkspaceCredentials()
      const isNewCredentials = Boolean(
        rotatedCredentials && typeof rotatedCredentials === 'object' && 'isNew' in rotatedCredentials && rotatedCredentials.isNew
      )
      setWorkspaceCredentialsSuccess(
        isNewCredentials
          ? 'Shared access credentials created. Copy the password now because it is shown only once.'
          : 'Shared access password rotated. Copy the new password now because it is shown only once.'
      )
    } catch (error) {
      setWorkspaceCredentialsError(error instanceof Error ? error.message : 'Unable to rotate the workspace credentials.')
    } finally {
      setIsRotatingWorkspaceCredentials(false)
    }
  }

  const handleUpdateMemberRole = async (membershipId: string, workflowRole: WorkspaceWorkflowRole) => {
    if (!onUpdateMemberRole) {
      setMemberAccessError('Workspace member access management is unavailable.')
      return
    }

    try {
      setUpdatingMemberId(membershipId)
      setMemberAccessError('')
      setMemberAccessSuccess('')
      await onUpdateMemberRole(membershipId, workflowRole)
      setMemberAccessSuccess('Member access role updated.')
    } catch (error) {
      setMemberAccessError(error instanceof Error ? error.message : 'Unable to update member access.')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleRemoveMemberRequest = (member: WorkspaceMember) => {
    if (!onRemoveMember) {
      setMemberAccessError('Workspace member removal is unavailable.')
      return
    }

    setMemberPendingRemoval(member)
  }

  const handleCancelMemberRemoval = () => {
    if (removingMemberId) {
      return
    }

    setMemberPendingRemoval(null)
  }

  const handleConfirmMemberRemoval = async () => {
    if (!memberPendingRemoval || !onRemoveMember) {
      return
    }

    const memberLabel = memberPendingRemoval.fullName || memberPendingRemoval.email || 'this member'

    try {
      setRemovingMemberId(memberPendingRemoval.id)
      setMemberAccessError('')
      setMemberAccessSuccess('')
      await onRemoveMember(memberPendingRemoval.id)
      setMemberAccessSuccess(`${memberLabel} was removed from the workspace.`)
      setMemberPendingRemoval(null)
    } catch (error) {
      setMemberAccessError(error instanceof Error ? error.message : 'Unable to remove the workspace member.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  return (
    <div className="cabinet-workspace-stack">
      <section className="glass-panel cabinet-workspace-overview">
        <div className="cabinet-workspace-overview__main">
          <div className="cabinet-workspace-overview__icon">
            <Building2 size={24} />
          </div>
          <div>
            <div className="cabinet-panel-kicker cabinet-panel-kicker--muted">Active workspace</div>
            <div className="cabinet-workspace-overview__title">{activeWorkspace.workspaceName}</div>
            <div className="cabinet-workspace-overview__meta">
              <RoleBadge
                role={activeWorkspace.workspaceRole === 'owner' ? 'owner' : 'member'}
                label={activeWorkspace.workspaceRole === 'owner' ? 'Owner' : 'Member'}
                size="sm"
              />
              <span>{activeWorkspace.workspaceType === 'team' ? 'Corporate workspace' : 'Solo workspace'}</span>
            </div>
          </div>
        </div>

        {accessibleWorkspaces.length > 1 && (
          <WorkspaceSwitcher
            workspaces={accessibleWorkspaces}
            active={activeWorkspace.workspaceId}
            onChange={onWorkspaceChange}
          />
        )}
      </section>

      <div className="cabinet-tab-grid cabinet-tab-grid--workspace">
        <section className="glass-panel cabinet-members-panel">
          <div className="cabinet-panel-head">
            <div>
              <div className="cabinet-panel-kicker cabinet-panel-kicker--muted">Members</div>
              <h3 className="cabinet-panel-title">Team roster</h3>
            </div>
            <Users size={16} className="cabinet-panel-head-icon" />
          </div>

          <div className="cabinet-member-grid">
            {workspaceMembers.length === 0 ? (
              <div className="cabinet-empty-card">No members are attached to this workspace yet.</div>
            ) : (
              workspaceMembers.map((member) => (
                <div
                  key={member.id}
                  className={`cabinet-member-card ${onViewMember ? 'cabinet-member-card--clickable' : ''}`}
                  role={onViewMember ? 'button' : undefined}
                  tabIndex={onViewMember ? 0 : undefined}
                  onClick={() => onViewMember?.(member)}
                  onKeyDown={(event) => {
                    if (!onViewMember) {
                      return
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onViewMember(member)
                    }
                  }}
                >
                  <div className="cabinet-member-card__head">
                    <div className="ui-avatar ui-avatar--md">{getInitials(member.fullName, member.email)}</div>
                    <div className="cabinet-member-card__copy">
                      <div className="cabinet-member-card__name">
                        {member.fullName || member.email || 'Workspace member'}
                      </div>
                      <div className="cabinet-member-card__email">
                        {member.email || 'No email available'}
                      </div>
                    </div>
                  </div>
                  <div className="cabinet-member-card__badges">
                    <RoleBadge
                      role={member.membershipRole === 'owner' ? 'owner' : 'member'}
                      label={member.membershipRole === 'owner' ? 'Owner' : 'Member'}
                      size="sm"
                    />
                    {member.membershipRole !== 'owner' && (
                      <RoleBadge
                        role={getWorkflowRoleValue(member.workflowRole)}
                        label={getWorkflowRoleLabel(member.workflowRole)}
                        size="sm"
                      />
                    )}
                  </div>
                  {onViewMember && (
                    <div className="cabinet-member-card__view">
                      <button
                        type="button"
                        className="cabinet-secondary-button cabinet-secondary-button--compact"
                        onClick={(event) => {
                          event.stopPropagation()
                          onViewMember(member)
                        }}
                      >
                        <Eye size={13} />
                        View profile
                      </button>
                    </div>
                  )}
                  {isTeamOwner && member.membershipRole !== 'owner' && (
                    <div className="cabinet-member-card__access">
                      <label className="cabinet-member-card__access-label" htmlFor={`memberRole-${member.id}`}>
                        Access rights
                      </label>
                      <div className="cabinet-member-card__access-controls">
                        <select
                          id={`memberRole-${member.id}`}
                          className="cabinet-inline-select"
                          value={getWorkflowRoleValue(member.workflowRole)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                            void handleUpdateMemberRole(member.id, event.target.value as WorkspaceWorkflowRole)
                          }}
                          disabled={updatingMemberId === member.id || removingMemberId === member.id}
                        >
                          <option value="lead">Lead</option>
                          <option value="developer">Developer</option>
                          <option value="qa">QA</option>
                        </select>
                        <button
                          type="button"
                          className="cabinet-secondary-button cabinet-secondary-button--compact danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRemoveMemberRequest(member)
                          }}
                          disabled={updatingMemberId === member.id || removingMemberId === member.id}
                        >
                          <Trash2 size={13} />
                          {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {memberAccessError && <div className="cabinet-feedback cabinet-feedback--error">{memberAccessError}</div>}
          {memberAccessSuccess && (
            <div className="cabinet-feedback cabinet-feedback--success">{memberAccessSuccess}</div>
          )}
        </section>

        <section className="glass-panel cabinet-invites-panel">
          <div className="cabinet-panel-kicker cabinet-panel-kicker--muted">Invitations</div>
          <h3 className="cabinet-panel-title">Invite team members</h3>

          {isTeamOwner ? (
            <>
              <div className="cabinet-subsection-label">Shared workspace credentials</div>
              <div className="cabinet-credentials-card">
                <div className="cabinet-credentials-grid">
                  <div className="cabinet-credentials-field">
                    <span className="cabinet-credentials-label">Workspace login</span>
                    <strong className="cabinet-credentials-value">
                      {workspaceJoinCredentials?.workspaceLogin || 'Generate credentials to create the login'}
                    </strong>
                    <small className="cabinet-credentials-meta">
                      {workspaceJoinCredentials?.rotatedAt
                        ? `Last rotated ${new Date(workspaceJoinCredentials.rotatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}`
                        : 'The login remains stable until it is regenerated.'}
                    </small>
                  </div>

                  <div className="cabinet-credentials-field">
                    <span className="cabinet-credentials-label">Workspace password</span>
                    <strong className="cabinet-credentials-value cabinet-credentials-value-secret">
                      {workspaceJoinSecret?.workspacePassword || 'Hidden for security. Rotate to create a new password.'}
                    </strong>
                    <small className="cabinet-credentials-meta">
                      {workspaceJoinSecret
                        ? 'Shown only after generation or rotation.'
                        : 'Stored only as a secure hash after rotation.'}
                    </small>
                  </div>
                </div>

                <div className="cabinet-credentials-actions">
                  <button
                    type="button"
                    className="cabinet-primary-button cabinet-primary-button--compact"
                    onClick={() => {
                      void handleRotateWorkspaceCredentials()
                    }}
                    disabled={isRotatingWorkspaceCredentials}
                  >
                    {isRotatingWorkspaceCredentials
                      ? 'Generating...'
                      : workspaceJoinCredentials?.hasCredentials
                        ? 'Rotate password'
                        : 'Generate credentials'}
                  </button>
                </div>

                {workspaceCredentialsError && (
                  <div className="cabinet-feedback cabinet-feedback--error">{workspaceCredentialsError}</div>
                )}
                {workspaceCredentialsSuccess && (
                  <div className="cabinet-feedback cabinet-feedback--success">{workspaceCredentialsSuccess}</div>
                )}
              </div>

              <form className="cabinet-invite-form" onSubmit={onInviteSubmit}>
                <div className="cabinet-invite-field">
                  <Mail size={15} />
                  <input
                    type="email"
                    className="cabinet-input"
                    placeholder="name@company.com"
                    value={workspaceInviteEmail}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onInviteEmailChange(event.target.value)}
                    disabled={isWorkspaceInviteLoading}
                    required
                  />
                </div>

                <select
                  className="cabinet-select"
                  value={workspaceInviteRole}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onInviteRoleChange(event.target.value)}
                  disabled={isWorkspaceInviteLoading}
                >
                  <option value="lead">Lead</option>
                  <option value="developer">Developer</option>
                  <option value="qa">QA</option>
                </select>

                <button
                  type="submit"
                  className="cabinet-primary-button cabinet-primary-button--compact"
                  disabled={isWorkspaceInviteLoading}
                >
                  <Plus size={14} />
                  {isWorkspaceInviteLoading ? 'Saving...' : 'Invite'}
                </button>
              </form>

              {workspaceInviteError && (
                <div className="cabinet-feedback cabinet-feedback--error">{workspaceInviteError}</div>
              )}
              {workspaceInviteSuccess && (
                <div className="cabinet-feedback cabinet-feedback--success">{workspaceInviteSuccess}</div>
              )}

              <div className="cabinet-subsection-label">Pending invites</div>
              <div className="cabinet-invite-list">
                {workspaceInvites.length === 0 ? (
                  <div className="cabinet-empty-card">No pending invites yet.</div>
                ) : (
                  workspaceInvites.map((invite) => (
                    <div key={invite.id} className="cabinet-invite-row">
                      <div className="cabinet-invite-row__left">
                        <div className="cabinet-invite-row__mail">
                          <Mail size={14} />
                        </div>
                        <div>
                          <div className="cabinet-invite-row__email">{invite.email}</div>
                          <div className="cabinet-invite-row__meta">
                            {getWorkflowRoleLabel(invite.workflowRole)} access
                          </div>
                        </div>
                      </div>
                      <div className="cabinet-invite-row__right">
                        <StatusChip status={invite.status || 'pending'} size="sm" />
                        {invite.status === 'pending' && (
                          <button
                            type="button"
                            className="cabinet-secondary-button cabinet-secondary-button--compact"
                            onClick={() => onInviteRevoke(invite.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="cabinet-empty-card">
              Invite and credential management are available only for corporate workspace owners.
            </div>
          )}
        </section>
      </div>
      {memberPendingRemoval && (
        <div className="cabinet-member-remove-modal-overlay" onClick={handleCancelMemberRemoval} role="presentation">
          <div
            className="cabinet-member-remove-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cabinet-member-remove-modal-title"
            aria-describedby="cabinet-member-remove-modal-description"
            aria-busy={Boolean(removingMemberId)}
          >
            <div className="cabinet-member-remove-modal__header">
              <div className="cabinet-member-remove-modal__icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </div>
              <div>
                <span className="cabinet-member-remove-modal__eyebrow">Workspace access</span>
                <h2 id="cabinet-member-remove-modal-title" className="cabinet-member-remove-modal__title">
                  Remove member?
                </h2>
                <p id="cabinet-member-remove-modal-description" className="cabinet-member-remove-modal__description">
                  This will remove {memberPendingRemoval.fullName || memberPendingRemoval.email || 'this member'} from {activeWorkspace.workspaceName}.
                </p>
              </div>
            </div>

            <div className="cabinet-member-remove-modal__body">
              <div className="cabinet-member-remove-modal__summary">
                <div className="cabinet-member-remove-modal__summary-label">Member</div>
                <div className="cabinet-member-remove-modal__summary-value">
                  {memberPendingRemoval.fullName || memberPendingRemoval.email || 'Workspace member'}
                </div>
                {memberPendingRemoval.email && memberPendingRemoval.fullName && (
                  <div className="cabinet-member-remove-modal__summary-meta">{memberPendingRemoval.email}</div>
                )}
              </div>
            </div>

            <div className="cabinet-member-remove-modal__footer">
              <button
                type="button"
                className="cabinet-member-remove-modal__button cabinet-member-remove-modal__button-secondary"
                onClick={handleCancelMemberRemoval}
                disabled={Boolean(removingMemberId)}
              >
                <X size={14} />
                Cancel
              </button>
              <button
                type="button"
                className="cabinet-member-remove-modal__button cabinet-member-remove-modal__button-danger"
                onClick={() => {
                  void handleConfirmMemberRemoval()
                }}
                disabled={Boolean(removingMemberId)}
              >
                <Trash2 size={14} />
                {removingMemberId ? 'Removing...' : 'Remove member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkspaceTab

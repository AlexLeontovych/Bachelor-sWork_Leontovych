import { Ban, Edit3, Eye, RotateCcw } from 'lucide-react'
import { getWorkflowTeamRoleLabel } from '../../../shared/utils/projectWorkflow'
import RoleBadge from '../../../shared/ui/RoleBadge'
import StatusChip from '../../../shared/ui/StatusChip'

interface UsersTabProps {
  loadingUsers: boolean
  allUsers: Array<Record<string, any>>
  editingUserId: string | null
  setEditingUserId: (userId: string | null) => void
  profile: Record<string, any> | null
  isBanning: boolean
  onViewUser?: (user: Record<string, any>) => void
  onRoleChange: (userId: string, role: string) => void | Promise<void>
  onTeamRoleChange: (userId: string, role: string) => void | Promise<void>
  onToggleBan: (user: Record<string, any>) => void | Promise<void>
}

const formatDate = (value?: string) => {
  if (!value) {
    return 'Not specified'
  }

  return new Date(value).toLocaleDateString('en-US')
}

const getInitials = (fullName?: string, email?: string) => {
  const label = fullName || email || 'WU'
  const segments = label.split(' ').filter(Boolean)

  if (segments.length > 1) {
    return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase()
  }

  return label.slice(0, 2).toUpperCase()
}

const UsersTab = ({
  loadingUsers,
  allUsers,
  editingUserId,
  setEditingUserId,
  profile,
  isBanning,
  onViewUser,
  onRoleChange,
  onTeamRoleChange,
  onToggleBan
}: UsersTabProps) => {
  return (
    <div className="glass-panel cabinet-users-panel">
      <div className="cabinet-users-panel__header">
        <div>
          <div className="cabinet-panel-kicker cabinet-panel-kicker--muted">Access control</div>
          <div className="cabinet-panel-title">Workspace user management</div>
        </div>
        <div className="cabinet-users-legend">
          <Legend tone="emerald" label="Active" />
          <Legend tone="rose" label="Banned" />
          <span>{allUsers.length} total</span>
        </div>
      </div>

      {loadingUsers ? (
        <div className="cabinet-empty-card">Loading users...</div>
      ) : allUsers.length === 0 ? (
        <div className="cabinet-empty-card">No users found.</div>
      ) : (
        <>
          <div className="cabinet-users-table cabinet-users-table--header">
            <div>Email</div>
            <div>Name</div>
            <div>Access</div>
            <div>Function</div>
            <div>Status</div>
            <div>Registered</div>
            <div className="align-right">Actions</div>
          </div>

          <div className="cabinet-users-rows">
            {allUsers.map((user, index) => {
              const isEditing = editingUserId === user.id
              const accessLabel = user.role === 'admin' ? 'Admin' : 'User'
              const functionLabel = user.role === 'admin' ? 'Team Lead' : getWorkflowTeamRoleLabel(user)

              return (
                <div key={user.id} className="cabinet-users-table cabinet-users-row">
                  <div className="cabinet-users-cell cabinet-users-cell--identity">
                    <div className="ui-avatar ui-avatar--md">{getInitials(user.full_name, user.email)}</div>
                    <div className="cabinet-users-cell__identity-copy">
                      <div className="cabinet-users-cell__mono">{user.email || 'Not specified'}</div>
                    </div>
                  </div>

                  <div className="cabinet-users-cell">{user.full_name || 'Not specified'}</div>

                  <div className="cabinet-users-cell">
                    {isEditing ? (
                      <select
                        className="cabinet-inline-select"
                        value={user.role || 'user'}
                        onChange={(event) => {
                          void onRoleChange(user.id, event.target.value)
                          setEditingUserId(null)
                        }}
                        onBlur={() => setEditingUserId(null)}
                        autoFocus
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <RoleBadge
                        role={user.role === 'admin' ? 'admin' : 'user'}
                        label={accessLabel}
                        size="sm"
                      />
                    )}
                  </div>

                  <div className="cabinet-users-cell">
                    {isEditing ? (
                      <select
                        className="cabinet-inline-select"
                        value={user.team_role || 'developer'}
                        onChange={(event) => {
                          void onTeamRoleChange(user.id, event.target.value)
                          setEditingUserId(null)
                        }}
                        onBlur={() => setEditingUserId(null)}
                        disabled={user.role === 'admin'}
                      >
                        <option value="developer">Developer</option>
                        <option value="qa">QA</option>
                      </select>
                    ) : (
                      <RoleBadge
                        role={user.role === 'admin' ? 'lead' : user.team_role === 'qa' ? 'qa' : 'developer'}
                        label={functionLabel}
                        size="sm"
                      />
                    )}
                  </div>

                  <div className="cabinet-users-cell">
                    <StatusChip status={user.banned ? 'banned' : 'active'} size="sm" />
                  </div>

                  <div className="cabinet-users-cell cabinet-users-cell--muted">{formatDate(user.created_at)}</div>

                  <div className="cabinet-users-cell cabinet-users-cell--actions">
                    {onViewUser && (
                      <button
                        type="button"
                        className="cabinet-secondary-button cabinet-secondary-button--compact"
                        onClick={() => onViewUser(user)}
                        title="View profile and projects"
                      >
                        <Eye size={13} />
                        View
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        className="cabinet-secondary-button cabinet-secondary-button--compact"
                        onClick={() => setEditingUserId(user.id)}
                        title="Change role"
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                    )}

                    {user.id !== profile?.id && (
                      <button
                        type="button"
                        className={[
                          'cabinet-secondary-button',
                          'cabinet-secondary-button--compact',
                          user.banned ? 'success' : 'danger'
                        ].join(' ')}
                        disabled={isBanning}
                        onClick={() => {
                          void onToggleBan(user)
                        }}
                        title={user.banned ? 'Unban user' : 'Ban user'}
                      >
                        {user.banned ? <RotateCcw size={13} /> : <Ban size={13} />}
                        {user.banned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

interface LegendProps {
  tone: 'emerald' | 'rose'
  label: string
}

const Legend = ({ tone, label }: LegendProps) => {
  return (
    <span className="cabinet-legend">
      <span className={`cabinet-legend__dot ${tone}`} />
      {label}
    </span>
  )
}

export default UsersTab

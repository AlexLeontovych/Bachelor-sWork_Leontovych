import type { ChangeEvent, FormEventHandler, ReactNode } from 'react'
import { Calendar, Key, LogOut, Mail, Shield, User } from 'lucide-react'
import RoleBadge from '../../../shared/ui/RoleBadge'
import AssignedProjectsSummary from './AssignedProjectsSummary'

interface ProfileTabProps {
  profile: {
    email?: string
    full_name?: string
    created_at?: string
    id?: string
  } | null
  projects?: Array<Record<string, any>>
  workflowRoleLabel: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  changingPassword: boolean
  passwordError: string
  passwordSuccess: string
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onSignOut?: () => void | Promise<void>
}

const getInitials = (fullName?: string, email?: string) => {
  const label = fullName || email || 'Workspace User'
  const segments = label.split(' ').filter(Boolean)

  if (segments.length > 1) {
    return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase()
  }

  return label.slice(0, 2).toUpperCase()
}

const formatRegistrationDate = (createdAt?: string) => {
  if (!createdAt) {
    return 'Not specified'
  }

  return new Date(createdAt).toLocaleDateString('en-US')
}

const ProfileTab = ({
  profile,
  projects = [],
  workflowRoleLabel,
  currentPassword,
  newPassword,
  confirmPassword,
  changingPassword,
  passwordError,
  passwordSuccess,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSignOut
}: ProfileTabProps) => {
  const initials = getInitials(profile?.full_name, profile?.email)

  return (
    <div className="cabinet-tab-grid cabinet-tab-grid--profile">
      <section className="glass-panel cabinet-profile-overview">
        <div className="cabinet-profile-summary">
          <div className="ui-avatar ui-avatar--lg cabinet-profile-avatar">{initials}</div>
          <div>
            <div className="cabinet-profile-name">{profile?.full_name || 'Workspace user'}</div>
            <div className="cabinet-profile-meta-copy">Workspace member / Active operating profile</div>
          </div>
        </div>

        <div className="cabinet-info-grid">
          <InfoRow icon={Mail} label="Email" value={profile?.email || 'Not specified'} />
          <InfoRow icon={User} label="Full name" value={profile?.full_name || 'Not specified'} />
          <InfoRow
            icon={Shield}
            label="Workflow role"
            value={<RoleBadge role={workflowRoleLabel.toLowerCase()} label={workflowRoleLabel} size="sm" />}
          />
          <InfoRow icon={Calendar} label="Registered" value={formatRegistrationDate(profile?.created_at)} />
        </div>
      </section>

      <section className="glass-panel cabinet-security-panel">
        <div className="cabinet-panel-kicker">
          <Key size={15} />
          <span>Security</span>
        </div>
        <h3 className="cabinet-panel-title">Change password</h3>

        <form className="cabinet-password-form" onSubmit={onSubmit}>
          <Field
            label="Current password"
            type="password"
            placeholder="**********"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
            disabled={changingPassword}
          />
          <Field
            label="New password"
            type="password"
            placeholder="Must contain 6+ characters"
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            disabled={changingPassword}
          />
          <Field
            label="Confirm new password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            disabled={changingPassword}
          />

          {passwordError && (
            <div className="cabinet-feedback cabinet-feedback--error">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="cabinet-feedback cabinet-feedback--success">{passwordSuccess}</div>
          )}

          <div className="cabinet-panel-actions">
            <button
              type="button"
              className="cabinet-danger-button"
              onClick={onSignOut}
              disabled={changingPassword}
            >
              <LogOut size={14} />
              Sign out
            </button>
            <button
              type="submit"
              className="cabinet-primary-button glow-blue"
              disabled={changingPassword}
            >
              {changingPassword ? 'Changing...' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      <AssignedProjectsSummary
        projects={projects}
        memberId={profile?.id || null}
        title="Your assigned project timeline"
      />
    </div>
  )
}

interface InfoRowProps {
  icon: typeof Mail
  label: string
  value: ReactNode
}

const InfoRow = ({ icon: Icon, label, value }: InfoRowProps) => {
  return (
    <div className="cabinet-info-row">
      <div className="cabinet-info-label">
        <Icon size={12} />
        {label}
      </div>
      <div className="cabinet-info-value">{value}</div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}

const Field = ({ label, type = 'text', ...rest }: FieldProps) => {
  return (
    <label className="cabinet-field">
      <div className="cabinet-field-label">{label}</div>
      <input type={type} className="cabinet-input" {...rest} />
    </label>
  )
}

export default ProfileTab

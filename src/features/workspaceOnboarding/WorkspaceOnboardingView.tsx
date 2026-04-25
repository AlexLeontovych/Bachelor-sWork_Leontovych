import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  Clock3,
  CreditCard,
  MailPlus,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound
} from 'lucide-react'
import { getWorkspacePlanOptions } from './workspacePlans'
import {
  getWorkspacePaymentConfirmationRemainingSeconds,
  isWorkspacePaymentConfirmationDelayed,
  isWorkspacePaymentConfirmationExpired,
  isWorkspacePaymentFailureStatus
} from './workspaceAccess'
import Logo from '../../components/shared/ui/Logo'
import type {
  WorkspaceAccess,
  WorkspaceInvite,
  WorkspaceJoinCredentialsSecret,
  WorkspaceJoinCredentialsSummary,
  WorkspaceMember,
  WorkspacePayment,
  WorkspacePlanType,
  WorkspaceWorkflowRole
} from './types'
import './WorkspaceOnboardingView.css'

interface WorkspaceOnboardingViewProps {
  activeWorkspace: WorkspaceAccess | null
  pendingPayment: WorkspacePayment | null
  pendingOrderId: string | null
  pendingPaymentStartedAt: number | null
  isResolvingWorkspaceContext: boolean
  invites: WorkspaceInvite[]
  members: WorkspaceMember[]
  workspaceJoinCredentials: WorkspaceJoinCredentialsSummary | null
  workspaceJoinSecret: WorkspaceJoinCredentialsSecret | null
  selectedPlanType: WorkspacePlanType
  isStartingCheckout: boolean
  isStartingTestPayment: boolean
  isRefreshingPayment: boolean
  isFinalizingActivation: boolean
  isReturningToLogin: boolean
  paymentError: string
  onPlanChange: (planType: WorkspacePlanType) => void
  onJoinWorkspace: (input: { workspaceLogin: string; workspacePassword: string }) => Promise<unknown>
  onStartCheckout: (planType: WorkspacePlanType) => Promise<void>
  onStartTestPayment: (planType: WorkspacePlanType) => Promise<void>
  onReturnToLogin: () => Promise<void>
  onContinueToWorkspace: () => void
  onOpenWorkspaceAccess: () => void
  onCreateInvite: (email: string, workflowRole: Exclude<WorkspaceWorkflowRole, null>) => Promise<void>
  onRotateWorkspaceCredentials: () => Promise<WorkspaceJoinCredentialsSecret>
  onRevokeInvite: (inviteId: string) => Promise<void>
}

type WorkspaceStepState = 'complete' | 'current' | 'upcoming'
type AssignableWorkspaceWorkflowRole = Exclude<WorkspaceWorkflowRole, null>

interface WorkspaceShellProps {
  currentStep: 'activate' | 'projects'
  isReturningToLogin: boolean
  onReturnToLogin: () => Promise<void>
  children: ReactNode
}

interface PlanPresentation {
  title: string
  subtitle: string
  icon: typeof UserRound
  tone: 'gold' | 'blue'
  badge?: string
  benefits: string[]
  drawbacks: string[]
}

const PLAN_PRESENTATION: Record<WorkspacePlanType, PlanPresentation> = {
  personal: {
    title: 'Solo Workspace',
    subtitle: 'For a single creator paying only for personal access',
    icon: UserRound,
    tone: 'gold',
    benefits: [
      'Private isolated environment',
      'Personal projects in one workspace',
      'Full editor and motion workflow',
      'Fast activation after payment'
    ],
    drawbacks: [
      'No shared collaborators',
      'No team-level shared credentials',
      'Built for solo operations only'
    ]
  },
  team: {
    title: 'Corporate Workspace',
    subtitle: 'For team leads who unlock access for the full workspace',
    icon: UsersRound,
    tone: 'blue',
    badge: 'Team lead plan',
    benefits: [
      'Shared workspace for the team lead and collaborators',
      'Granular roles and permissions',
      'Full QA review workflow',
      'Invite by email or shared workspace credentials'
    ],
    drawbacks: [
      'The team lead manages access after purchase',
      'Shared access credentials should be rotated carefully'
    ]
  }
}

const getWorkspaceWorkflowRoleLabel = (workflowRole?: WorkspaceWorkflowRole) => {
  if (workflowRole === 'lead') {
    return 'Lead'
  }

  if (workflowRole === 'qa') {
    return 'QA'
  }

  return 'Developer'
}

const resolveStepStates = (
  currentStep: WorkspaceShellProps['currentStep']
): Array<{ label: string; state: WorkspaceStepState }> => {
  if (currentStep === 'projects') {
    return [
      { label: 'Account', state: 'complete' },
      { label: 'Activate', state: 'complete' },
      { label: 'Projects', state: 'current' }
    ]
  }

  return [
    { label: 'Account', state: 'complete' },
    { label: 'Activate', state: 'current' },
    { label: 'Projects', state: 'upcoming' }
  ]
}

const formatWorkspacePlanAmount = (amountMinor: number) => {
  const amountMajor = amountMinor / 100
  return Number.isInteger(amountMajor) ? String(amountMajor) : amountMajor.toFixed(2)
}

const formatWorkspacePaidAt = (paidAt: string | null) => {
  try {
    if (!paidAt) {
      return 'Payment confirmed'
    }

    return `Confirmed ${new Date(paidAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })}`
  } catch (error) {
    return 'Payment confirmed'
  }
}

const formatWorkspacePaymentStatus = (
  status: WorkspacePayment['status'] | 'provisioning' | undefined,
  isRefreshingPayment: boolean
) => {
  if (status === 'provisioning') {
    return 'Provisioning'
  }

  if (isRefreshingPayment && status !== 'failed' && status !== 'cancelled') {
    return 'Syncing'
  }

  switch (status) {
    case 'processing':
      return 'Processing'
    case 'paid':
      return 'Paid'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'pending':
    default:
      return 'Pending'
  }
}

const resolveWorkspacePaymentTone = (
  status: WorkspacePayment['status'] | 'provisioning' | undefined,
  isRefreshingPayment: boolean
) => {
  if (status === 'failed' || status === 'cancelled') {
    return 'error'
  }

  if (status === 'paid') {
    return 'success'
  }

  if (status === 'provisioning' || status === 'processing' || isRefreshingPayment) {
    return 'processing'
  }

  return 'pending'
}

const WorkspaceShell = ({ currentStep, isReturningToLogin, onReturnToLogin, children }: WorkspaceShellProps) => {
  const steps = resolveStepStates(currentStep)

  return (
    <div className="workspace-onboarding workspace-shell">
      <header className="workspace-shell-topbar">
        <div className="workspace-shell-brand">
          <Logo size="sm" withText={false} />
          <div>
            <div className="workspace-shell-brand-name">Web Creative Studio</div>
            <div className="workspace-shell-brand-subname">Creative Control Room</div>
          </div>
        </div>

        <ol className="workspace-shell-steps" aria-label="Workspace activation progress">
          {steps.map((step, index) => (
            <li key={step.label} className={`workspace-shell-step ${step.state}`}>
              <span className="workspace-shell-step-dot" />
              <span>{step.label}</span>
              {index < steps.length - 1 && <span className="workspace-shell-step-line" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="workspace-shell-actions">
          <button
            type="button"
            className="workspace-shell-return-button"
            onClick={() => {
              void onReturnToLogin()
            }}
            disabled={isReturningToLogin}
          >
            <ArrowLeft size={14} />
            {isReturningToLogin ? 'Going back...' : 'Go back'}
          </button>
        </div>
      </header>

      {children}
    </div>
  )
}

/**
 * Renders the post-login paid workspace onboarding flow.
 *
 * @param {WorkspaceOnboardingViewProps} props
 * @returns {JSX.Element}
 */
const WorkspaceOnboardingView = ({
  activeWorkspace,
  pendingPayment,
  pendingOrderId,
  pendingPaymentStartedAt,
  isResolvingWorkspaceContext,
  invites,
  members,
  workspaceJoinCredentials,
  workspaceJoinSecret,
  selectedPlanType,
  isStartingCheckout,
  isStartingTestPayment,
  isRefreshingPayment,
  isFinalizingActivation,
  isReturningToLogin,
  paymentError,
  onPlanChange,
  onJoinWorkspace,
  onStartCheckout,
  onStartTestPayment,
  onReturnToLogin,
  onContinueToWorkspace,
  onOpenWorkspaceAccess,
  onCreateInvite,
  onRotateWorkspaceCredentials,
  onRevokeInvite
}: WorkspaceOnboardingViewProps) => {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AssignableWorkspaceWorkflowRole>('developer')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null)
  const [workspaceJoinLogin, setWorkspaceJoinLogin] = useState('')
  const [workspaceJoinPassword, setWorkspaceJoinPassword] = useState('')
  const [workspaceJoinError, setWorkspaceJoinError] = useState('')
  const [workspaceJoinSuccess, setWorkspaceJoinSuccess] = useState('')
  const [isJoiningWorkspace, setIsJoiningWorkspace] = useState(false)
  const [workspaceCredentialsError, setWorkspaceCredentialsError] = useState('')
  const [workspaceCredentialsSuccess, setWorkspaceCredentialsSuccess] = useState('')
  const [isRotatingWorkspaceCredentials, setIsRotatingWorkspaceCredentials] = useState(false)
  const [paymentClockNow, setPaymentClockNow] = useState(() => Date.now())

  const plans = useMemo(() => getWorkspacePlanOptions(), [])
  const selectedPlan = plans.find((plan) => plan.type === selectedPlanType) || plans[0]
  const isTeamWorkspaceOwner = activeWorkspace?.workspaceType === 'team' && activeWorkspace.workspaceRole === 'owner'
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')
  const hasDetailedWorkspaceReview = Boolean(
    (activeWorkspace?.workspaceType === 'team' && (isTeamWorkspaceOwner || members.length > 1)) ||
      pendingInvites.length > 0
  )
  const hasPaymentFailureState = isWorkspacePaymentFailureStatus(pendingPayment?.status)
  const effectivePendingPaymentStartedAt = pendingPayment?.createdAt
    ? new Date(pendingPayment.createdAt).getTime()
    : pendingPaymentStartedAt
  const hasPaymentExpiredState = Boolean(
    (pendingPayment || pendingOrderId) &&
      !hasPaymentFailureState &&
      !isFinalizingActivation &&
      isWorkspacePaymentConfirmationExpired({
        startedAt: effectivePendingPaymentStartedAt,
        now: paymentClockNow
      })
  )
  const hasPendingPaymentState = Boolean(pendingPayment || pendingOrderId || isFinalizingActivation)
  const hasPaymentTimeoutState = Boolean(
    (pendingPayment || pendingOrderId) &&
      !hasPaymentFailureState &&
      !hasPaymentExpiredState &&
      !isFinalizingActivation &&
      isWorkspacePaymentConfirmationDelayed({
        startedAt: effectivePendingPaymentStartedAt,
        now: paymentClockNow
      })
  )
  const paymentRemainingSeconds = getWorkspacePaymentConfirmationRemainingSeconds({
    startedAt: effectivePendingPaymentStartedAt,
    now: paymentClockNow
  })
  const paymentStatusLabel = formatWorkspacePaymentStatus(
    isFinalizingActivation ? 'provisioning' : pendingPayment?.status,
    isRefreshingPayment
  )
  const paymentStatusTone = resolveWorkspacePaymentTone(
    isFinalizingActivation ? 'provisioning' : pendingPayment?.status,
    isRefreshingPayment
  )
  const paymentOrderLabel = pendingPayment?.orderId || pendingOrderId || 'Waiting for provider'
  const paymentProgressLabel = isFinalizingActivation
    ? 'Provisioning workspace access'
    : isRefreshingPayment
      ? 'Refreshing payment status'
      : 'Confirming payment'
  const paymentHeadline = isFinalizingActivation
    ? 'Your payment is confirmed.'
    : "We're preparing your workspace."
  const paymentDescription = isFinalizingActivation
    ? 'We are finalizing billing, access, and onboarding permissions now. Your workspace screen will open automatically in a moment.'
    : 'Your payment is being confirmed with our provider. The workspace will open automatically once the transaction settles.'
  const paymentFailureKicker = hasPaymentExpiredState
    ? 'Payment timeout'
    : pendingPayment?.status === 'cancelled'
      ? 'Payment cancelled'
      : 'Payment failed'
  const paymentFailureHeadline = hasPaymentExpiredState
    ? 'Payment was not completed.'
    : pendingPayment?.status === 'cancelled'
    ? 'The checkout was cancelled.'
    : 'We could not confirm the payment.'
  const paymentFailureDescription = hasPaymentExpiredState
    ? 'The provider did not confirm this transaction within 3 minutes. Your workspace remains inactive until a new payment succeeds.'
    : pendingPayment?.status === 'cancelled'
    ? 'The provider window was closed before the transaction was confirmed. Your workspace was not activated.'
    : 'The provider returned an unsuccessful payment result. Your workspace remains inactive until a new payment succeeds.'
  const paymentFailureBanner =
    paymentError ||
    (hasPaymentExpiredState
      ? 'No payment confirmation arrived within 3 minutes. Please restart checkout and complete a new payment.'
      : pendingPayment?.status === 'cancelled'
      ? 'No charge was finalized. You can restart checkout safely.'
      : 'Try the payment again or verify your card details in the provider flow.')
  const paymentTimeoutBanner =
    paymentError ||
    'The provider has not confirmed the transaction within 60 seconds. Access is still blocked, but background verification remains active.'
  const workspaceCredentialsSummaryLabel = workspaceJoinCredentials?.hasCredentials ? 'Credentials ready' : 'Credentials not created'

  useEffect(() => {
    if (!hasPendingPaymentState) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPaymentClockNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasPendingPaymentState])

  const handleReviewWorkspace = () => {
    try {
      const targetElement = document.getElementById('workspace-activation-details')

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }
    } catch (error) {
      // Scroll support can fail in legacy browsers; onboarding still remains usable.
    }
  }

  const handleStartCheckout = async () => {
    try {
      await onStartCheckout(selectedPlan.type)
    } catch (error) {
      // Parent component already exposes the error state.
    }
  }

  const handlePlanCheckout = async (planType: WorkspacePlanType) => {
    try {
      onPlanChange(planType)
      await onStartCheckout(planType)
    } catch (error) {
      // Parent component already exposes the error state.
    }
  }

  const handlePlanTestPayment = async (planType: WorkspacePlanType) => {
    try {
      onPlanChange(planType)
      await onStartTestPayment(planType)
    } catch (error) {
      // Parent component already exposes the error state.
    }
  }

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteError('')
    setInviteSuccess('')

    try {
      setIsSubmittingInvite(true)
      await onCreateInvite(inviteEmail, inviteRole)
      setInviteEmail('')
      setInviteRole('developer')
      setInviteSuccess('Invitation saved. The user will receive access after signing in with this email.')
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Unable to create the workspace invite.')
    } finally {
      setIsSubmittingInvite(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      setRevokingInviteId(inviteId)
      await onRevokeInvite(inviteId)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Unable to revoke the workspace invite.')
    } finally {
      setRevokingInviteId(null)
    }
  }

  const handleWorkspaceJoinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setWorkspaceJoinError('')
    setWorkspaceJoinSuccess('')

    try {
      setIsJoiningWorkspace(true)
      const joinResult = await onJoinWorkspace({
        workspaceLogin: workspaceJoinLogin,
        workspacePassword: workspaceJoinPassword
      })

      if (
        joinResult &&
        typeof joinResult === 'object' &&
        'requiresAuthentication' in joinResult &&
        joinResult.requiresAuthentication
      ) {
        return
      }

      setWorkspaceJoinSuccess('Workspace access granted. Opening your project board now.')
      setWorkspaceJoinLogin('')
      setWorkspaceJoinPassword('')
    } catch (error) {
      setWorkspaceJoinError(error instanceof Error ? error.message : 'Unable to join the workspace.')
    } finally {
      setIsJoiningWorkspace(false)
    }
  }

  const handleRotateWorkspaceCredentials = async () => {
    try {
      setIsRotatingWorkspaceCredentials(true)
      setWorkspaceCredentialsError('')
      setWorkspaceCredentialsSuccess('')
      const rotatedCredentials = await onRotateWorkspaceCredentials()
      setWorkspaceCredentialsSuccess(
        rotatedCredentials.isNew
          ? 'Shared access credentials created. Copy the password now because it is shown only once.'
          : 'Shared access password rotated. Copy the new password now because it is shown only once.'
      )
    } catch (error) {
      setWorkspaceCredentialsError(error instanceof Error ? error.message : 'Unable to rotate the workspace credentials.')
    } finally {
      setIsRotatingWorkspaceCredentials(false)
    }
  }

  if (activeWorkspace) {
    return (
      <WorkspaceShell
        currentStep="projects"
        isReturningToLogin={isReturningToLogin}
        onReturnToLogin={onReturnToLogin}
      >
        <section className="workspace-success-hero">
          <div className="workspace-success-badge" aria-hidden="true">
            <Check size={16} />
          </div>
          <span className="workspace-section-kicker">Activation complete</span>
          <h1 className="workspace-hero-title">Your workspace is live.</h1>
          <p className="workspace-hero-copy">
            {hasDetailedWorkspaceReview
              ? `${activeWorkspace.workspaceName} is ready. Review access, members, and invites below, or move straight into project operations now.`
              : `${activeWorkspace.workspaceName} is ready. Your access is already active, so you can move straight into project operations now.`}
          </p>
          <div className="workspace-success-actions">
            <button className="workspace-primary-button workspace-primary-button-wide" onClick={onContinueToWorkspace}>
              Enter projects
              <ArrowRight size={15} />
            </button>
            {isTeamWorkspaceOwner && (
              <button
                type="button"
                className="workspace-secondary-button workspace-success-secondary-button"
                onClick={onOpenWorkspaceAccess}
              >
                Workspace access
              </button>
            )}
          </div>
        </section>

        <section className="workspace-success-summary-grid">
          <article className="workspace-surface-card workspace-success-summary-card">
            <span className="workspace-success-summary-label">Workspace</span>
            <strong className="workspace-success-summary-value">{activeWorkspace.workspaceName}</strong>
            <span className="workspace-success-summary-subtitle">
              {activeWorkspace.workspaceType === 'team' ? 'Corporate workspace' : 'Solo workspace'}
            </span>
          </article>

          <article className="workspace-surface-card workspace-success-summary-card">
            <span className="workspace-success-summary-label">Access level</span>
            <strong className="workspace-success-summary-value">
              {activeWorkspace.workspaceRole === 'owner' ? 'Owner' : 'Member'}
            </strong>
            <span className="workspace-success-summary-subtitle">
              {activeWorkspace.workspaceRole === 'owner' ? 'Full administration rights' : 'Assigned workspace access'}
            </span>
          </article>

          <article className="workspace-surface-card workspace-success-summary-card">
            <span className="workspace-success-summary-label">Billing</span>
            <strong className="workspace-success-summary-value">Active</strong>
            <span className="workspace-success-summary-subtitle">{formatWorkspacePaidAt(activeWorkspace.paidAt)}</span>
          </article>
        </section>

        <div
          id="workspace-activation-details"
          className={`workspace-detail-grid ${isTeamWorkspaceOwner ? '' : 'workspace-detail-grid-single'}`.trim()}
        >
          <section className="workspace-surface-card">
            <div className="workspace-surface-head">
              <div>
                <span className="workspace-section-kicker">Current members</span>
                <h2>Team access</h2>
              </div>
              <span className="workspace-pill workspace-pill-neutral">
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="workspace-empty-state">No members are attached to this workspace yet.</div>
            ) : (
              <div className="workspace-stack-list">
                {members.map((member) => (
                  <div key={member.id} className="workspace-stack-row">
                    <div>
                      <div className="workspace-stack-title">{member.fullName || member.email || 'Workspace member'}</div>
                      <div className="workspace-stack-meta">{member.email || 'No email available'}</div>
                    </div>
                    <span className={`workspace-pill workspace-pill-role-${member.membershipRole}`}>
                      {member.membershipRole === 'owner' ? 'Owner' : getWorkspaceWorkflowRoleLabel(member.workflowRole)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isTeamWorkspaceOwner && (
            <section className="workspace-surface-card">
              <div className="workspace-surface-head workspace-surface-head-inline">
                <div>
                  <span className="workspace-section-kicker">Invite your team</span>
                  <h3>Workspace invites</h3>
                </div>
                <span className="workspace-pill workspace-pill-neutral">Email-based access</span>
              </div>

              <p className="workspace-surface-copy">
                Add collaborators by email. They automatically gain access after signing in with the same address.
              </p>

              <div className="workspace-inline-section workspace-inline-section-credentials">
                <div className="workspace-surface-head workspace-surface-head-inline">
                  <div>
                    <span className="workspace-section-kicker">Shared join access</span>
                    <h3>Workspace credentials</h3>
                  </div>
                  <span className="workspace-pill workspace-pill-neutral">{workspaceCredentialsSummaryLabel}</span>
                </div>

                <p className="workspace-surface-copy">
                  Registered teammates can join this corporate workspace with the shared login and password below.
                  Review join requests when you need to assign Lead, QA, or Developer access.
                </p>

                <div className="workspace-credential-grid">
                  <div className="workspace-credential-card">
                    <span className="workspace-credential-label">Workspace login</span>
                    <strong className="workspace-credential-value">
                      {workspaceJoinCredentials?.workspaceLogin || 'Generate credentials to create the login'}
                    </strong>
                    <small className="workspace-credential-meta">
                      {workspaceJoinCredentials?.rotatedAt
                        ? `Last rotated ${new Date(workspaceJoinCredentials.rotatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}`
                        : 'The login remains stable until the workspace is regenerated.'}
                    </small>
                  </div>

                  <div className="workspace-credential-card">
                    <span className="workspace-credential-label">Workspace password</span>
                    <strong className="workspace-credential-value workspace-credential-value-secret">
                      {workspaceJoinSecret?.workspacePassword || 'Hidden for security. Rotate to create a new password.'}
                    </strong>
                    <small className="workspace-credential-meta">
                      {workspaceJoinSecret
                        ? 'Shown only after generation or rotation.'
                        : 'Stored only as a secure hash after rotation.'}
                    </small>
                  </div>
                </div>

                <div className="workspace-credential-actions">
                  <button
                    type="button"
                    className="workspace-primary-button"
                    onClick={() => {
                      void handleRotateWorkspaceCredentials()
                    }}
                    disabled={isRotatingWorkspaceCredentials}
                  >
                    {isRotatingWorkspaceCredentials
                      ? 'Generating credentials...'
                      : workspaceJoinCredentials?.hasCredentials
                        ? 'Rotate password'
                        : 'Generate credentials'}
                  </button>
                </div>

                {workspaceCredentialsError && (
                  <div className="workspace-feedback workspace-feedback-error">{workspaceCredentialsError}</div>
                )}
                {workspaceCredentialsSuccess && (
                  <div className="workspace-feedback workspace-feedback-success">{workspaceCredentialsSuccess}</div>
                )}
              </div>

              <form className="workspace-invite-form" onSubmit={handleInviteSubmit}>
                <div className="workspace-form-group workspace-form-group-wide">
                  <label htmlFor="workspaceInviteEmail">Email</label>
                  <input
                    id="workspaceInviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="teammate@example.com"
                    disabled={isSubmittingInvite}
                    required
                  />
                </div>
                <div className="workspace-form-group">
                  <label htmlFor="workspaceInviteRole">Role</label>
                  <select
                    id="workspaceInviteRole"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as AssignableWorkspaceWorkflowRole)}
                    disabled={isSubmittingInvite}
                  >
                    <option value="lead">Lead</option>
                    <option value="developer">Developer</option>
                    <option value="qa">QA</option>
                  </select>
                </div>
                <button type="submit" className="workspace-primary-button" disabled={isSubmittingInvite}>
                  <MailPlus size={15} />
                  {isSubmittingInvite ? 'Saving invite...' : 'Add email'}
                </button>
              </form>

              {inviteError && <div className="workspace-feedback workspace-feedback-error">{inviteError}</div>}
              {inviteSuccess && <div className="workspace-feedback workspace-feedback-success">{inviteSuccess}</div>}

              <div className="workspace-inline-section">
                <div className="workspace-surface-head workspace-surface-head-inline">
                  <div>
                    <span className="workspace-section-kicker">Pending access</span>
                    <h3>Pending invites</h3>
                  </div>
                  <span className="workspace-pill workspace-pill-neutral">{pendingInvites.length} pending</span>
                </div>

                {pendingInvites.length === 0 ? (
                  <div className="workspace-empty-state">No pending invites yet.</div>
                ) : (
                  <div className="workspace-stack-list">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="workspace-stack-row">
                        <div>
                          <div className="workspace-stack-title">{invite.email}</div>
                          <div className="workspace-stack-meta">
                            {getWorkspaceWorkflowRoleLabel(invite.workflowRole)} access
                          </div>
                        </div>
                        <button
                          type="button"
                          className="workspace-secondary-button"
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revokingInviteId === invite.id}
                        >
                          {revokingInviteId === invite.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </WorkspaceShell>
    )
  }

  if (isResolvingWorkspaceContext && !hasPendingPaymentState && !hasPaymentFailureState) {
    return (
      <WorkspaceShell
        currentStep="activate"
        isReturningToLogin={isReturningToLogin}
        onReturnToLogin={onReturnToLogin}
      >
        <section className="workspace-surface-card workspace-payment-wait-shell">
          <div className="workspace-payment-wait-orb" aria-hidden="true">
            <span className="workspace-payment-wait-spinner" />
          </div>

          <span className="workspace-section-kicker">Syncing workspace access</span>
          <h1 className="workspace-payment-wait-title">We are loading your workspace.</h1>
          <p className="workspace-payment-wait-copy">
            Checking your active workspace access before showing activation options. Paid users will be routed directly
            into the correct workspace flow.
          </p>

          <div className="workspace-payment-footnote">
            Permissions, workspace billing, and project access are being synchronized right now.
          </div>
        </section>
      </WorkspaceShell>
    )
  }

  if ((hasPaymentFailureState || hasPaymentExpiredState) && pendingPayment) {
    return (
      <WorkspaceShell
        currentStep="activate"
        isReturningToLogin={isReturningToLogin}
        onReturnToLogin={onReturnToLogin}
      >
        <section className="workspace-surface-card workspace-payment-failure-shell">
          <div className="workspace-payment-failure-orb" aria-hidden="true">
            <AlertTriangle size={22} />
          </div>

          <span className="workspace-section-kicker workspace-section-kicker-danger">{paymentFailureKicker}</span>
          <h1 className="workspace-payment-failure-title">{paymentFailureHeadline}</h1>
          <p className="workspace-payment-failure-copy">{paymentFailureDescription}</p>

          <div className="workspace-payment-failure-banner">
            <span className="workspace-payment-failure-banner-dot" aria-hidden="true" />
            <span>{paymentFailureBanner}</span>
          </div>

          <div className="workspace-payment-meta-grid">
            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Order</span>
              <strong className="workspace-payment-meta-value">{pendingPayment.orderId}</strong>
              <small>Hosted checkout order</small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Plan</span>
              <strong className="workspace-payment-meta-value">{PLAN_PRESENTATION[pendingPayment.planType].title}</strong>
              <small>
                {formatWorkspacePlanAmount(pendingPayment.amountMinor)} {pendingPayment.currency} / one-time
              </small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Status</span>
              <strong className="workspace-payment-status-badge workspace-payment-status-badge-error">
                {hasPaymentExpiredState ? 'Timed out' : paymentStatusLabel}
              </strong>
              <small>{hasPaymentExpiredState ? '3 minute payment window elapsed' : 'Activation was stopped before completion'}</small>
            </article>
          </div>

          <div className="workspace-payment-failure-actions">
            <button
              type="button"
              className="workspace-primary-button workspace-primary-button-wide"
              onClick={() => {
                void handlePlanCheckout(pendingPayment.planType)
              }}
              disabled={isStartingCheckout}
            >
              {isStartingCheckout ? 'Restarting checkout...' : 'Try again'}
              {!isStartingCheckout && <ArrowRight size={15} />}
            </button>
          </div>
        </section>
      </WorkspaceShell>
    )
  }

  if (hasPaymentTimeoutState) {
    return (
      <WorkspaceShell
        currentStep="activate"
        isReturningToLogin={isReturningToLogin}
        onReturnToLogin={onReturnToLogin}
      >
        <section className="workspace-surface-card workspace-payment-timeout-shell">
          <div className="workspace-payment-timeout-orb" aria-hidden="true">
            <Clock3 size={22} />
          </div>

          <span className="workspace-section-kicker workspace-section-kicker-warning">Confirmation delayed</span>
          <h1 className="workspace-payment-timeout-title">Payment confirmation is taking longer than expected.</h1>
          <p className="workspace-payment-timeout-copy">
            The 60 second confirmation window has elapsed, so access is still blocked for now. If the provider sends a
            late confirmation, the workspace will unlock automatically without another payment.
          </p>

          <div className="workspace-payment-timeout-banner">
            <span className="workspace-payment-timeout-banner-dot" aria-hidden="true" />
            <span>{paymentTimeoutBanner}</span>
          </div>

          <div className="workspace-payment-meta-grid">
            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Order</span>
              <strong className="workspace-payment-meta-value">{pendingOrderId || pendingPayment?.orderId || 'Waiting for provider'}</strong>
              <small>Tracking continues in the background</small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Window</span>
              <strong className="workspace-payment-status-badge workspace-payment-status-badge-warning">60s elapsed</strong>
              <small>{paymentRemainingSeconds === 0 ? 'Timeout reached, still polling' : `${paymentRemainingSeconds}s remaining`}</small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Status</span>
              <strong className="workspace-payment-status-badge workspace-payment-status-badge-processing">
                {isRefreshingPayment ? 'Checking' : paymentStatusLabel}
              </strong>
              <small>Late confirmations still grant access automatically</small>
            </article>
          </div>

          <div className="workspace-payment-footnote">
            Keep this page open if possible. The app checks the payment status automatically every few seconds.
          </div>
        </section>
      </WorkspaceShell>
    )
  }

  if (hasPendingPaymentState) {
    return (
      <WorkspaceShell
        currentStep="activate"
        isReturningToLogin={isReturningToLogin}
        onReturnToLogin={onReturnToLogin}
      >
        <section className="workspace-surface-card workspace-payment-wait-shell">
          <div className="workspace-payment-wait-orb" aria-hidden="true">
            <span className="workspace-payment-wait-spinner" />
          </div>

          <span className="workspace-section-kicker">Activation in progress</span>
          <h1 className="workspace-payment-wait-title">{paymentHeadline}</h1>
          <p className="workspace-payment-wait-copy">{paymentDescription}</p>

          <div className="workspace-payment-progress-head">
            <span>{paymentProgressLabel}</span>
            <strong>{paymentStatusLabel}</strong>
          </div>
          <div className="workspace-payment-progress-track" aria-hidden="true">
            <span
              className={`workspace-payment-progress-indicator workspace-payment-progress-indicator-${paymentStatusTone}`}
            />
          </div>

          <div className="workspace-payment-meta-grid">
            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Order</span>
              <strong className="workspace-payment-meta-value">{paymentOrderLabel}</strong>
              <small>Hosted checkout order</small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Provider</span>
              <strong className="workspace-payment-meta-value">Monobank</strong>
              <small>
                {pendingPayment
                  ? `${PLAN_PRESENTATION[pendingPayment.planType].title} / ${formatWorkspacePlanAmount(pendingPayment.amountMinor)} ${pendingPayment.currency}`
                  : 'Secure hosted payment page'}
              </small>
            </article>

            <article className="workspace-payment-meta-card">
              <span className="workspace-payment-meta-label">Status</span>
              <strong className={`workspace-payment-status-badge workspace-payment-status-badge-${paymentStatusTone}`}>
                {paymentStatusLabel}
              </strong>
              <small>{isFinalizingActivation ? 'Opening onboarding next' : 'Auto-refresh enabled'}</small>
            </article>
          </div>

          <div className="workspace-payment-footnote">
            {isFinalizingActivation
              ? 'Workspace permissions, billing state, and onboarding access are syncing securely.'
              : 'Secure hosted checkout with automatic payment status synchronization.'}
          </div>
        </section>

        {paymentError && <div className="workspace-feedback workspace-feedback-error">{paymentError}</div>}
      </WorkspaceShell>
    )
  }

  return (
    <WorkspaceShell
      currentStep="activate"
      isReturningToLogin={isReturningToLogin}
      onReturnToLogin={onReturnToLogin}
    >
      <section className="workspace-pricing-hero">
        <span className="workspace-section-kicker">Step 02 - Activation</span>
        <h1 className="workspace-hero-title">Choose the workspace that matches your operation.</h1>
        <p className="workspace-hero-copy">
          Activate your own workspace, or if a team lead already paid for the workspace, join it with shared
          credentials after registration. Email invites continue to work automatically for matching accounts.
        </p>
      </section>

      <section className="workspace-pricing-grid">
        {plans.map((plan) => {
          const presentation = PLAN_PRESENTATION[plan.type]
          const isSelected = selectedPlan.type === plan.type
          const PlanIcon = presentation.icon
          const amountDisplay = formatWorkspacePlanAmount(plan.amountMinor)

          return (
            <article
              key={plan.type}
              className={`workspace-plan-card ${presentation.badge ? 'workspace-plan-card-has-badge' : ''} ${isSelected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onPlanChange(plan.type)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onPlanChange(plan.type)
                }
              }}
              aria-pressed={isSelected}
            >
              {presentation.badge && <span className="workspace-plan-badge">{presentation.badge}</span>}

              <div className="workspace-plan-selection" aria-hidden="true">
                <span className="workspace-plan-selection-ring">
                  {isSelected && <Check size={12} />}
                </span>
              </div>

              <div className={`workspace-plan-icon workspace-plan-icon-${presentation.tone}`}>
                <PlanIcon size={18} />
              </div>

              <div className="workspace-plan-copy">
                <h2>{presentation.title}</h2>
                <p>{presentation.subtitle}</p>
              </div>

              <div className="workspace-plan-price-row">
                <div className="workspace-plan-price-main">
                  <span className="workspace-plan-price">{amountDisplay}</span>
                  <span className="workspace-plan-price-currency">{plan.currency}</span>
                </div>
                <span className="workspace-plan-price-cycle">one-time</span>
              </div>

              <div className="workspace-plan-section">
                <div className="workspace-plan-section-kicker">
                  <Sparkles size={12} />
                  Advantages
                </div>
                <ul className="workspace-plan-list workspace-plan-list-positive">
                  {presentation.benefits.map((benefit) => (
                    <li key={benefit}>
                      <Check size={13} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="workspace-plan-divider" />

              <div className="workspace-plan-section">
                <div className="workspace-plan-section-kicker workspace-plan-section-kicker-muted">
                  <ShieldCheck size={12} />
                  Trade-offs
                </div>
                <ul className="workspace-plan-list workspace-plan-list-subtle">
                  {presentation.drawbacks.map((drawback) => (
                    <li key={drawback}>
                      <span className="workspace-plan-bullet" />
                      <span>{drawback}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="workspace-plan-cta">
                <button
                  type="button"
                  className={`workspace-primary-button workspace-plan-button ${isSelected ? 'workspace-plan-button-selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handlePlanCheckout(plan.type)
                  }}
                  disabled={isStartingCheckout}
                >
                  <CreditCard size={15} />
                  {isStartingCheckout && isSelected ? 'Preparing checkout...' : `Activate ${amountDisplay} ${plan.currency}`}
                  {!isStartingCheckout && <ArrowRight size={15} />}
                </button>
                <button
                  type="button"
                  className="workspace-test-payment-button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handlePlanTestPayment(plan.type)
                  }}
                  disabled={isStartingCheckout || isStartingTestPayment}
                >
                  {isStartingTestPayment && isSelected ? 'Activating test...' : 'Test payment'}
                </button>
              </div>
            </article>
          )
        })}
      </section>

      <section className="workspace-surface-card workspace-join-card">
        <div className="workspace-surface-head workspace-surface-head-inline">
          <div>
            <span className="workspace-section-kicker">Join an existing workspace</span>
            <h2>Already have workspace credentials?</h2>
          </div>
          <span className="workspace-pill workspace-pill-neutral">No extra payment</span>
        </div>

        <p className="workspace-surface-copy">
          If your team lead already activated a corporate workspace, register or sign in first and then enter the
          workspace login and password below. Email invites still grant access automatically after sign-in with the
          same address.
        </p>

        <form className="workspace-invite-form workspace-join-form" onSubmit={handleWorkspaceJoinSubmit}>
          <div className="workspace-form-group">
            <label htmlFor="workspaceJoinLogin">Workspace login</label>
            <input
              id="workspaceJoinLogin"
              type="text"
              value={workspaceJoinLogin}
              onChange={(event) => setWorkspaceJoinLogin(event.target.value)}
              placeholder="aurora-corporate-1a2b3c4d"
              disabled={isJoiningWorkspace}
              required
            />
          </div>

          <div className="workspace-form-group">
            <label htmlFor="workspaceJoinPassword">Workspace password</label>
            <input
              id="workspaceJoinPassword"
              type="password"
              value={workspaceJoinPassword}
              onChange={(event) => setWorkspaceJoinPassword(event.target.value)}
              placeholder="Enter the shared workspace password"
              disabled={isJoiningWorkspace}
              required
            />
          </div>

          <button type="submit" className="workspace-primary-button" disabled={isJoiningWorkspace}>
            {isJoiningWorkspace ? 'Joining workspace...' : 'Join workspace'}
            {!isJoiningWorkspace && <ArrowRight size={15} />}
          </button>
        </form>

        {workspaceJoinError && <div className="workspace-feedback workspace-feedback-error">{workspaceJoinError}</div>}
        {workspaceJoinSuccess && (
          <div className="workspace-feedback workspace-feedback-success">{workspaceJoinSuccess}</div>
        )}
      </section>

      {paymentError && <div className="workspace-feedback workspace-feedback-error">{paymentError}</div>}
    </WorkspaceShell>
  )
}

export default WorkspaceOnboardingView

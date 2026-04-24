import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User, X } from 'lucide-react'
import { signIn, signUp } from '../../../services/authService'
import type { WorkspacePlanType } from '../../../features/workspaceOnboarding/types'
import './GuestCheckoutAuthModal.css'

type GuestCheckoutAuthMode = 'register' | 'signin'

interface GuestCheckoutAuthModalProps {
  planType?: WorkspacePlanType
  continuation?: 'checkout' | 'workspaceJoin'
  workspaceLogin?: string
  onAuthSuccess: (options?: { continuePendingWorkspaceAction?: boolean }) => Promise<unknown>
  onContinueToCheckout?: (planType: WorkspacePlanType, authenticatedUser: unknown) => Promise<void>
  onContinueToWorkspaceJoin?: (authenticatedUser: unknown) => Promise<void>
  onCancel: (options?: { preservePendingAction?: boolean }) => void | Promise<void>
}

const PLAN_COPY: Record<WorkspacePlanType, { label: string; price: string }> = {
  personal: {
    label: 'Solo Workspace',
    price: '1 UAH one-time'
  },
  team: {
    label: 'Corporate Workspace',
    price: '2 UAH one-time'
  }
}

/**
 * Displays the authentication gate that guests must complete before paid workspace checkout.
 *
 * @param {GuestCheckoutAuthModalProps} props
 * @returns {JSX.Element}
 */
const GuestCheckoutAuthModal = ({
  planType,
  continuation = 'checkout',
  workspaceLogin,
  onAuthSuccess,
  onContinueToCheckout,
  onContinueToWorkspaceJoin,
  onCancel
}: GuestCheckoutAuthModalProps) => {
  const [mode, setMode] = useState<GuestCheckoutAuthMode>('register')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [hasSentConfirmationEmail, setHasSentConfirmationEmail] = useState(false)

  const isWorkspaceJoin = continuation === 'workspaceJoin'
  const planDetails = planType ? PLAN_COPY[planType] : null
  const actionCopy = isWorkspaceJoin
    ? {
        eyebrow: 'Secure workspace access',
        title: 'Create an account before joining',
        description:
          'Workspace credentials can only be used by registered users. Once you finish authentication, we will join the workspace automatically.',
        status: mode === 'register' ? 'Creating your account and joining workspace...' : 'Signing you in and joining workspace...',
        submit: 'Joining workspace...',
        error: 'Unable to continue workspace join.'
      }
    : {
        eyebrow: 'Secure activation required',
        title: 'Create an account before checkout',
        description:
          'Guests can browse projects, but paid workspace activation requires a registered account. Once you finish authentication, checkout for the selected plan starts automatically.',
        status: mode === 'register' ? 'Creating your account and preparing checkout...' : 'Signing you in and preparing checkout...',
        submit: 'Preparing checkout...',
        error: 'Unable to continue to checkout.'
      }

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSubmitting) {
        return
      }

      try {
        await onCancel({ preservePendingAction: hasSentConfirmationEmail })
      } catch (closeError) {
        setError(closeError instanceof Error ? closeError.message : 'Unable to close the registration dialog.')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasSentConfirmationEmail, isSubmitting, onCancel])

  const handleModeChange = (nextMode: GuestCheckoutAuthMode) => {
    try {
      setMode(nextMode)
      setError('')
      setMessage('')
      setHasSentConfirmationEmail(false)
    } catch (modeError) {
      setError(modeError instanceof Error ? modeError.message : 'Unable to switch the authentication mode.')
    }
  }

  const handleOverlayClick = async (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isSubmitting) {
      return
    }

    try {
      await onCancel({ preservePendingAction: hasSentConfirmationEmail })
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Unable to close the registration dialog.')
    }
  }

  const handleCancelClick = async () => {
    try {
      await onCancel({ preservePendingAction: hasSentConfirmationEmail })
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Unable to close the registration dialog.')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim()
    const normalizedFullName = fullName.trim()

    try {
      setIsSubmitting(true)
      setError('')
      setMessage(actionCopy.status)

      if (mode === 'register') {
        const registration = await signUp(normalizedEmail, password, normalizedFullName || null)

        setHasSentConfirmationEmail(true)
        setPassword('')
        setMessage(
          registration?.requiresEmailConfirmation === false
            ? 'Account created. Sign in to continue.'
            : 'Confirmation email sent. Open the link from your inbox, then sign in here to continue automatically.'
        )
        setMode('signin')
        return
      }

      await signIn(normalizedEmail, password)
      const authenticatedUser = await onAuthSuccess({ continuePendingWorkspaceAction: false })

      if (!authenticatedUser) {
        throw new Error('Unable to verify your session. Please try again.')
      }

      if (isWorkspaceJoin) {
        if (!onContinueToWorkspaceJoin) {
          throw new Error('Workspace join continuation is not configured.')
        }

        await onContinueToWorkspaceJoin(authenticatedUser)
      } else {
        if (!planType || !onContinueToCheckout) {
          throw new Error('Checkout continuation is not configured.')
        }

        await onContinueToCheckout(planType, authenticatedUser)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : actionCopy.error)
      setMessage('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="guest-checkout-auth-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="guest-checkout-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-checkout-auth-title"
        aria-describedby="guest-checkout-auth-description"
        aria-busy={isSubmitting}
      >
        <div className="guest-checkout-auth-header">
          <div className="guest-checkout-auth-header-copy">
            <span className="guest-checkout-auth-eyebrow">{actionCopy.eyebrow}</span>
            <h2 id="guest-checkout-auth-title" className="guest-checkout-auth-title">
              {actionCopy.title}
            </h2>
            <p id="guest-checkout-auth-description" className="guest-checkout-auth-description">
              {actionCopy.description}
            </p>
          </div>

          <button
            type="button"
            className="guest-checkout-auth-close"
            onClick={() => {
              void handleCancelClick()
            }}
            disabled={isSubmitting}
            aria-label="Close registration dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="guest-checkout-auth-plan">
          <div className="guest-checkout-auth-plan-icon" aria-hidden="true">
            <ShieldCheck size={16} />
          </div>
          <div className="guest-checkout-auth-plan-copy">
            <span className="guest-checkout-auth-plan-label">
              {isWorkspaceJoin ? 'Corporate workspace access' : planDetails?.label}
            </span>
            <strong>{isWorkspaceJoin ? workspaceLogin || 'Shared credentials' : planDetails?.price}</strong>
          </div>
        </div>

        <div className="guest-checkout-auth-switch" role="tablist" aria-label="Guest checkout authentication mode">
          <button
            type="button"
            className={`guest-checkout-auth-switch-button ${mode === 'register' ? 'active' : ''}`}
            onClick={() => handleModeChange('register')}
            disabled={isSubmitting}
          >
            Create account
          </button>
          <button
            type="button"
            className={`guest-checkout-auth-switch-button ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => handleModeChange('signin')}
            disabled={isSubmitting}
          >
            Sign in
          </button>
        </div>

        <form className="guest-checkout-auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="guest-checkout-auth-field">
              <span>Full name</span>
              <div className="guest-checkout-auth-input-shell">
                <User size={14} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Aurora Vance"
                  autoComplete="name"
                  disabled={isSubmitting}
                  required={mode === 'register'}
                />
              </div>
            </label>
          )}

          <label className="guest-checkout-auth-field">
            <span>Email</span>
            <div className="guest-checkout-auth-input-shell">
              <Mail size={14} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@studio.co"
                autoComplete="email"
                disabled={isSubmitting}
                required
              />
            </div>
          </label>

          <label className="guest-checkout-auth-field">
            <span>Password</span>
            <div className="guest-checkout-auth-input-shell guest-checkout-auth-input-shell-password">
              <Lock size={14} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="************"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={6}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="guest-checkout-auth-password-toggle"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                disabled={isSubmitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {error && <div className="guest-checkout-auth-feedback guest-checkout-auth-feedback-error">{error}</div>}
          {message && <div className="guest-checkout-auth-feedback guest-checkout-auth-feedback-info">{message}</div>}

          <button type="submit" className="guest-checkout-auth-submit" disabled={isSubmitting}>
            <span>
              {isSubmitting
                ? actionCopy.submit
                : mode === 'register'
                  ? 'Create account and continue'
                  : 'Sign in and continue'}
            </span>
            {!isSubmitting && <ArrowRight size={14} />}
          </button>
        </form>
      </div>
    </div>
  )
}

export default GuestCheckoutAuthModal

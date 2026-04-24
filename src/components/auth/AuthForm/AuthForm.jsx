import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  GitBranch,
  Layers3,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User
} from 'lucide-react'
import { signIn, signUp } from '../../../services/authService'
import Logo from '../../shared/ui/Logo'
import './AuthForm.css'

const AUTH_HIGHLIGHTS = [
  {
    label: 'Activation',
    value: 'Spin up a solo workspace or join a paid corporate workspace in seconds with licensed access.',
    icon: Sparkles
  },
  {
    label: 'Workflow',
    value: 'Move creatives through Development, QA, Production, and Archive with confidence.',
    icon: GitBranch
  },
  {
    label: 'Access Control',
    value: 'Owner, admin, member, and guest roles with granular operational permissions.',
    icon: Shield
  }
]

const AuthForm = ({ onAuthSuccess, onGuestLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleModeChange = (nextIsLogin) => {
    setIsLogin(nextIsLogin)
    setError('')
    setMessage('')
  }

  const handleSurfacePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
    event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)
    event.currentTarget.style.setProperty('--pointer-opacity', '1')
  }

  const handleSurfacePointerLeave = (event) => {
    event.currentTarget.style.setProperty('--pointer-opacity', '0')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const startTime = performance.now()
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })

    console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Початок`, {
      isLogin,
      email,
      hasPassword: !!password,
      hasFullName: !!fullName
    })

    setError('')
    setMessage('')
    setLoading(true)
    console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Стан оновлено`, { loading: true })

    try {
      if (isLogin) {
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 - Виклик signIn`)
        const signInStartTime = performance.now()
        await signIn(email, password)
        const signInDuration = (performance.now() - signInStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 успішний (${signInDuration}ms)`)

        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 2 - Виклик onAuthSuccess`)
        const onAuthSuccessStartTime = performance.now()
        await onAuthSuccess()
        const onAuthSuccessDuration = (performance.now() - onAuthSuccessStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 2 завершено (${onAuthSuccessDuration}ms)`)

        setLoading(false)
        const totalDuration = (performance.now() - startTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Вхід завершено успішно (загалом ${totalDuration}ms)`, {
          signInDuration,
          onAuthSuccessDuration,
          totalDuration
        })
      } else {
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 - Виклик signUp`)
        const signUpStartTime = performance.now()
        const registration = await signUp(email, password, fullName.trim() || null)
        const signUpDuration = (performance.now() - signUpStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 успішний (${signUpDuration}ms)`)

        setPassword('')
        setMessage(
          registration?.requiresEmailConfirmation === false
            ? 'Account created. You can now sign in and activate a workspace.'
            : 'Confirmation email sent. Open the link from your inbox, then sign in to continue.'
        )
        setLoading(false)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Стан оновлено`, { loading: false })

        setTimeout(() => {
          setIsLogin(true)
          setMessage(
            registration?.requiresEmailConfirmation === false
              ? 'You can now sign in with your new account.'
              : 'After confirming your email, sign in with your new account.'
          )
          console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Переключено на режим входу`)
        }, 1600)
      }
    } catch (err) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Помилка при вході/реєстрації (${totalDuration}ms)`, {
        message: err?.message,
        code: err?.code,
        stack: err?.stack
      })
      setError(err?.message || 'An error occurred')
      setLoading(false)
      console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Помилка оброблена, стан оновлено`, {
        error: err?.message,
        loading: false
      })
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-ambient auth-ambient-left" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-right" aria-hidden="true" />
      <div className="auth-layout">
        <section
          className="auth-brand-panel"
          onMouseMove={handleSurfacePointerMove}
          onMouseLeave={handleSurfacePointerLeave}
        >
          <div className="auth-brand-top">
            <div className="auth-brand-lockup">
              <Logo size="sm" />
            </div>
          </div>

          <div className="auth-brand-content">
            <span className="auth-brand-eyebrow">Creative operations, live</span>
            <h1 className="auth-brand-title">The control room for visual creative production.</h1>
            <p className="auth-brand-copy">
              Activate a workspace, build creatives on a live stage, route them through a structured
              review flow, and ship finished work - all in one precise, premium environment.
            </p>

            <div className="auth-highlight-grid">
              {AUTH_HIGHLIGHTS.map((item, index) => {
                const Icon = item.icon

                return (
                  <article
                    key={item.label}
                    className="auth-highlight-card"
                    style={{ '--card-index': index }}
                    onMouseMove={handleSurfacePointerMove}
                    onMouseLeave={handleSurfacePointerLeave}
                  >
                    <div className="auth-highlight-icon">
                      <Icon size={14} />
                    </div>
                    <div className="auth-highlight-label">{item.label}</div>
                    <div className="auth-highlight-value">{item.value}</div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="auth-brand-footer">
            <span>version 0.3 BETA</span>
            <span>Trusted by 1200+ creative teams</span>
          </div>
        </section>

        <section
          className="auth-stage-panel"
          onMouseMove={handleSurfacePointerMove}
          onMouseLeave={handleSurfacePointerLeave}
        >
          <div
            className="auth-panel-card"
            onMouseMove={handleSurfacePointerMove}
            onMouseLeave={handleSurfacePointerLeave}
          >
            <div className="auth-panel-top">
              <div>
                <span className="auth-panel-eyebrow">Enter the studio</span>
                <h2 className="auth-title">{isLogin ? 'Welcome back' : 'Create account'}</h2>
              </div>
              <div className="auth-panel-orb" aria-hidden="true">
                <Layers3 size={16} />
              </div>
            </div>

            <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={`auth-mode-button ${isLogin ? 'active' : ''}`}
                onClick={() => handleModeChange(true)}
                disabled={loading}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-mode-button ${!isLogin ? 'active' : ''}`}
                onClick={() => handleModeChange(false)}
                disabled={loading}
              >
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="auth-form-group">
                  <label htmlFor="fullName" className="auth-label">
                    Full name
                  </label>
                  <div className="auth-input-shell">
                    <User className="auth-input-icon" size={14} />
                    <input
                      id="fullName"
                      type="text"
                      className="auth-input"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Aurora Vance"
                      disabled={loading}
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div className="auth-form-group">
                <label htmlFor="email" className="auth-label">
                  Email
                </label>
                <div className="auth-input-shell">
                  <Mail className="auth-input-icon" size={14} />
                  <input
                    id="email"
                    type="email"
                    className="auth-input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@studio.co"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label htmlFor="password" className="auth-label">
                  Password
                </label>
                <div className="auth-input-shell auth-input-shell-password">
                  <Lock className="auth-input-icon" size={14} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="************"
                    required
                    minLength={6}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((currentValue) => !currentValue)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="auth-meta-row">
                  <label className="auth-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={() => setRememberDevice((currentValue) => !currentValue)}
                      disabled={loading}
                    />
                    <span>Remember this device</span>
                  </label>
                  <span className="auth-meta-link">Forgot password</span>
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}
              {message && <div className="auth-message">{message}</div>}

              <button type="submit" className="auth-button" disabled={loading}>
                <span>
                  {loading
                    ? 'Please wait...'
                    : isLogin
                      ? 'Sign in to workspace'
                      : 'Create my account'}
                </span>
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>

            <div className="auth-guest-divider">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="auth-guest-button"
              onClick={() => {
                if (onGuestLogin) {
                  onGuestLogin()
                }
              }}
              disabled={loading}
            >
              <Eye size={14} />
              Continue as guest (read-only)
            </button>

            <div className="auth-trust-line">
              <span className="auth-trust-dot" />
              <span>SOC2 Type II</span>
              <span className="auth-trust-separator">/</span>
              <span>End-to-end encrypted</span>
              <span className="auth-trust-separator">/</span>
              <span>GDPR aligned</span>
            </div>
          </div>

          <p className="auth-terms-copy">By continuing you agree to the Terms and Privacy.</p>
        </section>
      </div>
    </div>
  )
}

export default AuthForm

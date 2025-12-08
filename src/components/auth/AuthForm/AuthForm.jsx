import { useState } from 'react'
import { signIn, signUp } from '../../../services/authService'
import './AuthForm.css'

const AuthForm = ({ onAuthSuccess, onGuestLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
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
        // Вхід
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 - Виклик signIn`)
        const signInStartTime = performance.now()
        await signIn(email, password)
        const signInDuration = (performance.now() - signInStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 успішний (${signInDuration}ms)`)
        
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 2 - Виклик onAuthSuccess`)
        setMessage('Sign in successful!')
        const onAuthSuccessStartTime = performance.now()
        await onAuthSuccess()
        const onAuthSuccessDuration = (performance.now() - onAuthSuccessStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 2 завершено (${onAuthSuccessDuration}ms)`)
        
        setLoading(false) // Також скидаємо локальний loading форми
        const totalDuration = (performance.now() - startTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Вхід завершено успішно (загалом ${totalDuration}ms)`, {
          signInDuration,
          onAuthSuccessDuration,
          totalDuration
        })
      } else {
        // Реєстрація
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 - Виклик signUp`)
        const signUpStartTime = performance.now()
        await signUp(email, password, fullName)
        const signUpDuration = (performance.now() - signUpStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Крок 1 успішний (${signUpDuration}ms)`)
        
        setMessage('Registration successful! Please check your email for confirmation.')
        setLoading(false) // Скидаємо loading
        console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Стан оновлено`, { loading: false })
        
        // Після реєстрації можна автоматично увійти
        setTimeout(() => {
          setIsLogin(true)
          setMessage('You can now sign in')
          console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Переключено на режим входу`)
        }, 2000)
      }
    } catch (err) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Помилка при вході/реєстрації (${totalDuration}ms)`, {
        message: err.message,
        code: err.code,
        stack: err.stack
      })
      setError(err.message || 'An error occurred')
      setLoading(false) // Скидаємо loading при помилці
      console.log(`[${time}] [БД ДЕБАГ] AuthForm.handleSubmit: Помилка оброблена, стан оновлено`, {
        error: err.message,
        loading: false
      })
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-form-wrapper">
        <div className="auth-header">
          <h1 className="auth-title">Creative Studio</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-form-group">
              <label htmlFor="fullName" className="auth-label">
                Name
              </label>
              <input
                id="fullName"
                type="text"
                className="auth-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
              />
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="email" className="auth-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password" className="auth-label">
              Password
            </label>
            <div className="auth-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <span className="auth-eye-icon">👁️</span>
                ) : (
                  <span className="auth-eye-icon">👁️‍🗨️</span>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <button
            type="button"
            className="auth-link-button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setMessage('')
            }}
            disabled={loading}
          >
            {isLogin
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
          </button>
          <div className="auth-guest-divider">
            <span>or</span>
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
            Login as Guest
          </button>
          <p className="auth-guest-note">
            Guests can only view projects
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthForm


import { useId } from 'react'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  size?: LogoSize
  withText?: boolean
  title?: string
  subtitle?: string
  onClick?: () => void
  ariaLabel?: string
}

const Logo = ({
  size = 'md',
  withText = true,
  title = 'Web Creative Studio',
  subtitle = 'Creative Control Room',
  onClick,
  ariaLabel = 'Open projects'
}: LogoProps) => {
  const gradientId = useId()
  const content = (
    <>
      <div className="ui-logo__mark">
        <div className="ui-logo__blur" />
        <div className="ui-logo__frame">
          <svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#b9cdff" />
                <stop offset="60%" stopColor="#c7b0ff" />
                <stop offset="100%" stopColor="#f4d7a1" />
              </linearGradient>
            </defs>
            <path
              d="M4 18 L10 6 L14 14 L20 4"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="10" cy="6" r="1.6" fill="#b9cdff" />
            <circle cx="20" cy="4" r="1.6" fill="#f4d7a1" />
          </svg>
        </div>
      </div>

      {withText && (
        <div className="ui-logo__copy">
          <span className="ui-logo__title">
            {title}
          </span>
          <span className="ui-logo__subtitle">{subtitle}</span>
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`ui-logo ui-logo--${size} ui-logo--button`}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`ui-logo ui-logo--${size}`}>
      {content}
    </div>
  )
}

export default Logo

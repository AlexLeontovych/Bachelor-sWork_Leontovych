import {
  CheckCheck,
  Code2,
  Crown,
  Eye,
  Palette,
  Shield,
  User
} from 'lucide-react'

type RoleBadgeSize = 'sm' | 'md'

interface RoleBadgeProps {
  role?: string | null
  label?: string
  size?: RoleBadgeSize
  className?: string
}

const ROLE_CONFIG = {
  owner: {
    label: 'Owner',
    icon: Crown,
    tone: 'owner'
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    tone: 'admin'
  },
  lead: {
    label: 'Lead',
    icon: Crown,
    tone: 'lead'
  },
  guest: {
    label: 'Guest',
    icon: Eye,
    tone: 'guest'
  },
  developer: {
    label: 'Developer',
    icon: Code2,
    tone: 'developer'
  },
  qa: {
    label: 'QA',
    icon: CheckCheck,
    tone: 'qa'
  },
  designer: {
    label: 'Designer',
    icon: Palette,
    tone: 'designer'
  },
  member: {
    label: 'Member',
    icon: User,
    tone: 'member'
  },
  user: {
    label: 'User',
    icon: User,
    tone: 'user'
  }
} as const

const normalizeRole = (role?: string | null) => {
  const normalizedRole = String(role || 'member').trim().toLowerCase()

  if (normalizedRole === 'team lead') {
    return 'lead'
  }

  return normalizedRole in ROLE_CONFIG ? normalizedRole as keyof typeof ROLE_CONFIG : 'member'
}

const joinClasses = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ')

const RoleBadge = ({ role, label, size = 'md', className }: RoleBadgeProps) => {
  const normalizedRole = normalizeRole(role)
  const configuration = ROLE_CONFIG[normalizedRole]
  const Icon = configuration.icon

  return (
    <span
      className={joinClasses(
        'ui-role-badge',
        `ui-role-badge--${size}`,
        `ui-role-badge--${configuration.tone}`,
        className
      )}
    >
      <Icon className="ui-role-badge__icon" size={size === 'sm' ? 12 : 14} />
      {label || configuration.label}
    </span>
  )
}

export default RoleBadge

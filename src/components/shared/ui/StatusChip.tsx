type StatusChipSize = 'sm' | 'md'

interface StatusChipProps {
  status?: string | null
  label?: string
  size?: StatusChipSize
  className?: string
  pulse?: boolean
}

const STATUS_CONFIG = {
  development: 'Development',
  qa: 'QA Review',
  production: 'Production',
  archived: 'Archived',
  archive: 'Archived',
  saved: 'Saved',
  unsaved: 'Unsaved',
  missing: 'QA Missing',
  assigned: 'QA Assigned',
  pending: 'On review',
  accepted: 'Accepted',
  declined: 'Declined',
  revoked: 'Revoked',
  expired: 'Expired',
  active: 'Active',
  banned: 'Banned',
  warning: 'Warning',
  danger: 'Error'
} as const

const normalizeStatus = (status?: string | null) => {
  const normalizedStatus = String(status || 'development').trim().toLowerCase()
  return normalizedStatus in STATUS_CONFIG
    ? normalizedStatus as keyof typeof STATUS_CONFIG
    : 'development'
}

const joinClasses = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ')

const StatusChip = ({ status, label, size = 'md', className, pulse = false }: StatusChipProps) => {
  const normalizedStatus = normalizeStatus(status)

  return (
    <span
      className={joinClasses(
        'ui-status-chip',
        `ui-status-chip--${size}`,
        `ui-status-chip--${normalizedStatus}`,
        className
      )}
    >
      <span className={joinClasses('ui-status-chip__dot', pulse && 'pulse')} />
      {label || STATUS_CONFIG[normalizedStatus]}
    </span>
  )
}

export default StatusChip

import type { LucideIcon } from 'lucide-react'

type MetricCardTone = 'blue' | 'violet' | 'emerald' | 'gold'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  hint?: string
  icon?: LucideIcon
  tone?: MetricCardTone
}

const MetricCard = ({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = 'blue'
}: MetricCardProps) => {
  return (
    <div className={`ui-metric-card glass-panel ui-metric-card--${tone}`}>
      <div className="ui-metric-card__glow" />
      <div className="ui-metric-card__bar" />
      <div className="ui-metric-card__inner">
        <div>
          <div className="ui-metric-card__label">{label}</div>
          <div className="ui-metric-card__value-row">
            <div className="ui-metric-card__value text-gradient-cool">{value}</div>
            {delta && <div className="ui-metric-card__delta">{delta}</div>}
          </div>
          {hint && <div className="ui-metric-card__hint">{hint}</div>}
        </div>
        {Icon && (
          <div className="ui-metric-card__icon">
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricCard

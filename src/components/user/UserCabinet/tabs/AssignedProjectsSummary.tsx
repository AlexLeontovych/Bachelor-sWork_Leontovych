import { useMemo, useState } from 'react'
import { CalendarDays, ChartNoAxesCombined } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  getProjectCreatorId,
  getProjectDeveloperId,
  getProjectQaId,
  normalizeProjectStatus
} from '../../../shared/utils/projectWorkflow'

type ChartRange = 'week' | 'month' | 'year'

interface AssignedProjectsSummaryProps {
  projects: Array<Record<string, any>>
  memberId?: string | null
  title?: string
}

const CHART_RANGES: Array<{ id: ChartRange; label: string; days: number }> = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: 'year', label: 'Year', days: 365 }
]

const getProjectDate = (project: Record<string, any>) => {
  const value = project.createdAt || project.created_at || project.updatedAt || project.updated_at
  const timestamp = value ? new Date(value).getTime() : Number.NaN

  return Number.isNaN(timestamp) ? null : new Date(timestamp)
}

const isAssignedToMember = (project: Record<string, any>, memberId?: string | null) => {
  if (!memberId) {
    return false
  }

  return (
    getProjectCreatorId(project) === memberId ||
    getProjectDeveloperId(project) === memberId ||
    getProjectQaId(project) === memberId
  )
}

const getProjectBucket = (project: Record<string, any>) => {
  const status = project.isArchived ? 'archived' : normalizeProjectStatus(project.status)
  const startValue = project.startsAt || project.starts_at || project.scheduledAt || project.scheduled_at
  const startTimestamp = startValue ? new Date(startValue).getTime() : Number.NaN

  if (!Number.isNaN(startTimestamp) && startTimestamp > Date.now()) {
    return 'future'
  }

  if (['planned', 'backlog', 'upcoming'].includes(String(project.status || '').toLowerCase())) {
    return 'future'
  }

  if (status === 'production' || status === 'archived') {
    return 'past'
  }

  return 'current'
}

const formatBucketLabel = (date: Date, range: ChartRange) => {
  if (range === 'year') {
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatTooltipLabel = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const createChartPoints = (projects: Array<Record<string, any>>, range: ChartRange) => {
  const rangeConfig = CHART_RANGES.find((item) => item.id === range) || CHART_RANGES[1]
  const now = new Date()
  const buckets = Array.from({ length: rangeConfig.days }).map((_, index) => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (rangeConfig.days - 1 - index))

    return {
      date,
      count: 0
    }
  })

  const firstBucketTime = buckets[0]?.date.getTime() || 0

  projects.forEach((project) => {
    const date = getProjectDate(project)

    if (!date) {
      return
    }

    date.setHours(0, 0, 0, 0)

    if (date.getTime() < firstBucketTime) {
      return
    }

    const bucket = buckets.find((item) => item.date.getTime() === date.getTime())

    if (bucket) {
      bucket.count += 1
    }
  })

  let cumulativeCount = 0

  return buckets.map((bucket) => {
    cumulativeCount += bucket.count

    return {
      ...bucket,
      label: formatBucketLabel(bucket.date, range),
      fullLabel: formatTooltipLabel(bucket.date),
      count: cumulativeCount
    }
  })
}

const AssignedProjectsSummary = ({
  projects,
  memberId,
  title = 'Assigned project timeline'
}: AssignedProjectsSummaryProps) => {
  const [chartRange, setChartRange] = useState<ChartRange>('month')
  const assignedProjects = useMemo(
    () => projects.filter((project) => isAssignedToMember(project, memberId)),
    [memberId, projects]
  )
  const projectCounts = useMemo(() => {
    return assignedProjects.reduce((summary, project) => {
      const bucket = getProjectBucket(project)
      summary[bucket] += 1
      return summary
    }, {
      past: 0,
      current: 0,
      future: 0
    })
  }, [assignedProjects])
  const chartPoints = useMemo(() => createChartPoints(assignedProjects, chartRange), [assignedProjects, chartRange])
  const maxCount = Math.max(1, ...chartPoints.map((point) => point.count))
  const lastPoint = chartPoints[chartPoints.length - 1]

  return (
    <section className="glass-panel cabinet-assigned-summary">
      <div className="cabinet-assigned-summary__head">
        <div>
          <div className="cabinet-panel-kicker">
            <ChartNoAxesCombined size={15} />
            Assigned scope
          </div>
          <h3 className="cabinet-panel-title">{title}</h3>
        </div>
        <div className="cabinet-assigned-summary__range">
          {CHART_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              className={chartRange === range.id ? 'active' : ''}
              onClick={() => setChartRange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cabinet-assigned-summary__stats">
        <SummaryStat label="Past" value={projectCounts.past} helper="Production or archived." />
        <SummaryStat label="Current" value={projectCounts.current} helper="Development and QA." />
        <SummaryStat label="Future" value={projectCounts.future} helper="Planned or scheduled." />
      </div>

      <div className="cabinet-assigned-chart">
        <div className="cabinet-assigned-chart__plot">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={chartPoints}
              margin={{ top: 22, right: 22, left: 0, bottom: 22 }}
            >
              <defs>
                <linearGradient id="assignedProjectsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.42} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="4 8" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={chartRange === 'year' ? 18 : 26}
                tick={{ fill: 'rgba(247, 244, 237, 0.55)', fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                domain={[0, maxCount]}
                tickLine={false}
                tick={{ fill: 'rgba(247, 244, 237, 0.55)', fontSize: 11 }}
                width={34}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(245, 158, 11, 0.42)', strokeWidth: 1 }}
                content={<AssignedProjectsTooltip />}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#f59e0b"
                strokeWidth={3}
                fill="url(#assignedProjectsGradient)"
                activeDot={{ r: 5, stroke: '#fef3c7', strokeWidth: 2, fill: '#f59e0b' }}
                dot={chartRange === 'week' ? { r: 3, strokeWidth: 0, fill: '#f59e0b' } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {lastPoint && (
            <div className="cabinet-assigned-chart__current">
              <CalendarDays size={13} />
              {lastPoint.count} assigned by {formatBucketLabel(lastPoint.date, chartRange)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

interface SummaryStatProps {
  label: string
  value: number
  helper: string
}

const SummaryStat = ({ label, value, helper }: SummaryStatProps) => (
  <div className="cabinet-assigned-summary__stat">
    <div className="cabinet-assigned-summary__stat-label">{label}</div>
    <div className="cabinet-assigned-summary__stat-value">{value}</div>
    <div className="cabinet-assigned-summary__stat-helper">{helper}</div>
  </div>
)

const AssignedProjectsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload

  return (
    <div className="cabinet-assigned-chart__tooltip">
      <div className="cabinet-assigned-chart__tooltip-label">{point?.fullLabel || label}</div>
      <div className="cabinet-assigned-chart__tooltip-value">
        {payload[0].value} assigned projects
      </div>
    </div>
  )
}

export default AssignedProjectsSummary

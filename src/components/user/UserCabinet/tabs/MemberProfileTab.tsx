import type { ReactNode } from 'react'
import { ArrowLeft, BriefcaseBusiness, Calendar, Mail, User } from 'lucide-react'
import {
  getProjectCreatorId,
  getProjectDeveloperId,
  getProjectQaId,
  getProjectStatusLabel,
  getWorkflowTeamRoleLabel,
  normalizeProjectStatus
} from '../../../shared/utils/projectWorkflow'
import RoleBadge from '../../../shared/ui/RoleBadge'
import StatusChip from '../../../shared/ui/StatusChip'
import AssignedProjectsSummary from './AssignedProjectsSummary'

interface MemberProfile {
  id: string
  email?: string | null
  full_name?: string | null
  fullName?: string | null
  role?: string | null
  team_role?: string | null
  teamRole?: string | null
  workflowRole?: string | null
  membershipRole?: string | null
  created_at?: string | null
}

interface MemberProfileTabProps {
  member: MemberProfile
  projects: Array<Record<string, any>>
  isLoadingProjects?: boolean
  onBackToMembers: () => void
}

const getInitials = (fullName?: string | null, email?: string | null) => {
  const label = fullName || email || 'Workspace User'
  const segments = label.split(' ').filter(Boolean)

  if (segments.length > 1) {
    return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase()
  }

  return label.slice(0, 2).toUpperCase()
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Not specified'
  }

  return new Date(value).toLocaleDateString('en-US')
}

const getMemberRole = (member: MemberProfile) => {
  if (member.role === 'admin' || member.membershipRole === 'owner') {
    return 'lead'
  }

  return member.team_role || member.teamRole || member.workflowRole || 'developer'
}

const getMemberProjects = (projects: Array<Record<string, any>>, memberId: string) => {
  return projects.filter((project) => (
    getProjectCreatorId(project) === memberId ||
    getProjectDeveloperId(project) === memberId ||
    getProjectQaId(project) === memberId
  ))
}

const getProjectMemberRole = (project: Record<string, any>, memberId: string) => {
  if (getProjectCreatorId(project) === memberId) {
    return 'Creator'
  }

  if (getProjectDeveloperId(project) === memberId) {
    return 'Developer'
  }

  if (getProjectQaId(project) === memberId) {
    return 'QA'
  }

  return 'Contributor'
}

const MemberProfileTab = ({ member, projects, isLoadingProjects = false, onBackToMembers }: MemberProfileTabProps) => {
  const memberName = member.full_name || member.fullName || member.email || 'Workspace member'
  const memberEmail = member.email || 'No email available'
  const memberRole = getMemberRole(member)
  const memberRoleLabel = member.role === 'admin' || member.membershipRole === 'owner'
    ? 'Team Lead'
    : getWorkflowTeamRoleLabel({ team_role: memberRole })
  const memberProjects = getMemberProjects(projects, member.id)

  return (
    <div className="cabinet-member-profile-stack">
      <button type="button" className="cabinet-secondary-button cabinet-secondary-button--compact" onClick={onBackToMembers}>
        <ArrowLeft size={14} />
        Back to members
      </button>

      <section className="glass-panel cabinet-member-profile-card">
        <div className="cabinet-profile-summary">
          <div className="ui-avatar ui-avatar--lg cabinet-profile-avatar">{getInitials(memberName, member.email)}</div>
          <div>
            <div className="cabinet-profile-name">{memberName}</div>
            <div className="cabinet-profile-meta-copy">Workspace member profile</div>
          </div>
        </div>

        <div className="cabinet-info-grid">
          <InfoRow icon={Mail} label="Email" value={memberEmail} />
          <InfoRow icon={User} label="Full name" value={memberName} />
          <InfoRow
            icon={BriefcaseBusiness}
            label="Workspace function"
            value={<RoleBadge role={memberRole} label={memberRoleLabel} size="sm" />}
          />
          <InfoRow icon={Calendar} label="Registered" value={formatDate(member.created_at)} />
        </div>
      </section>

      <AssignedProjectsSummary
        projects={projects}
        memberId={member.id}
        title={`${memberName}'s assigned project timeline`}
      />

      <section className="glass-panel cabinet-member-projects-panel">
        <div className="cabinet-panel-head">
          <div>
            <div className="cabinet-panel-kicker cabinet-panel-kicker--muted">Assigned work</div>
            <h3 className="cabinet-panel-title">Projects ({memberProjects.length})</h3>
          </div>
        </div>

        {isLoadingProjects ? (
          <div className="cabinet-empty-card">Loading member projects...</div>
        ) : memberProjects.length === 0 ? (
          <div className="cabinet-empty-card">No visible projects are assigned to this member.</div>
        ) : (
          <div className="cabinet-member-project-list">
            {memberProjects.map((project) => {
              const status = project.isArchived ? 'archived' : normalizeProjectStatus(project.status)

              return (
                <article key={String(project.id)} className="cabinet-member-project-row">
                  <div>
                    <div className="cabinet-member-project-row__name">{project.name || 'Untitled project'}</div>
                    <div className="cabinet-member-project-row__meta">
                      #{String(project.id).slice(0, 8)} · {getProjectMemberRole(project, member.id)}
                    </div>
                  </div>
                  <StatusChip
                    status={status}
                    label={project.isArchived ? 'Archived' : getProjectStatusLabel(project.status)}
                    size="sm"
                  />
                </article>
              )
            })}
          </div>
        )}
      </section>
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

export default MemberProfileTab

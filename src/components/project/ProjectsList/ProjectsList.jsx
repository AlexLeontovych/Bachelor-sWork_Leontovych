import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Eye,
  FolderKanban,
  Hammer,
  Monitor,
  MonitorSmartphone,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2
} from 'lucide-react'
import { PROJECT_FORMATS } from '../../shared/utils/constants'
import {
  canCreateProjects,
  canDeleteProject,
  canManageProject,
  getProjectAccessMessage,
  getProjectCreatorId,
  getProjectDeveloperId,
  getProjectQaId,
  getProjectStatusLabel,
  getWorkflowTeamRole,
  getWorkflowTeamRoleLabel,
  normalizeProjectStatus
} from '../../shared/utils/projectWorkflow'
import { getCurrentWorkspaceProfile, getWorkspaceMembers } from '../../../services/workspaceService'
import MetricCard from '../../shared/ui/MetricCard'
import PageHeader from '../../shared/ui/PageHeader'
import StatusChip from '../../shared/ui/StatusChip'
import WorkspaceSwitcher from '../../shared/ui/WorkspaceSwitcher'
import './ProjectsList.css'

const STAGE_FILTER_OPTIONS = [
  { id: 'all', label: 'All stages' },
  { id: 'development', label: 'Development' },
  { id: 'qa', label: 'QA' },
  { id: 'production', label: 'Production' }
]

const ORIENTATION_FILTER_OPTIONS = [
  { value: 'all', label: 'All orientations' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' }
]

const PROJECTS_PER_PAGE = 6

const getProjectOrientation = (project) =>
  String(project?.screenFormat || project?.screen_format || 'landscape').trim().toLowerCase()

const getProjectIdentifier = (project) => `#${String(project?.id || 'draft').slice(0, 8)}`

const getAssigneeData = ({ assigneeId, assignableUsers, currentUserId, fallback, roleLabel }) => {
  if (!assigneeId) {
    return {
      label: fallback,
      initials: 'NA',
      isEmpty: true,
      roleLabel
    }
  }

  const workflowUser = assignableUsers.find((item) => item.id === assigneeId)
  const label = assigneeId === currentUserId
    ? 'You'
    : (workflowUser?.full_name || workflowUser?.email || 'Assigned')
  const initialsSource = workflowUser?.full_name || workflowUser?.email || label
  const initials = String(initialsSource)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0])
    .join('')
    .toUpperCase()

  return {
    label,
    initials: initials || 'A',
    isEmpty: false,
    roleLabel
  }
}

const formatRelativeTime = (value) => {
  if (!value) {
    return 'updated recently'
  }

  try {
    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) {
      return 'updated recently'
    }

    const elapsedMs = Date.now() - timestamp
    const minutes = Math.max(1, Math.floor(elapsedMs / 60000))

    if (minutes < 60) {
      return `updated ${minutes}m ago`
    }

    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      return `updated ${hours}h ago`
    }

    const days = Math.floor(hours / 24)
    if (days < 30) {
      return `updated ${days}d ago`
    }

    const months = Math.floor(days / 30)
    return `updated ${months}mo ago`
  } catch (error) {
    return 'updated recently'
  }
}

const ProjectsList = ({
  projects,
  editingProjectId,
  onNewProject,
  onEditProject,
  onUpdateProject,
  onSetEditingId,
  onProjectPreview,
  onProjectExport,
  onDeleteProject,
  onSignOut,
  onOpenCabinet,
  onOpenWorkspaceAccess,
  onOpenWorkspaceJoin,
  activeWorkspace = null,
  accessibleWorkspaces = [],
  workflowProfile = null,
  notifications = [],
  unreadNotificationCount = 0,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onWorkspaceChange,
  isGuest = false
}) => {
  const [userProfile, setUserProfile] = useState(workflowProfile)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState([])
  const [stageFilter, setStageFilter] = useState('all')
  const [orientationFilter, setOrientationFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(null)
  const [sortOrder, setSortOrder] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const boardRef = useRef(null)

  useEffect(() => {
    if (workflowProfile) {
      setUserProfile(workflowProfile)
    }
  }, [workflowProfile])

  useEffect(() => {
    const loadProfile = async () => {
      if (isGuest || !activeWorkspace?.workspaceId) {
        setUserProfile(null)
        setIsAdminUser(false)
        setAssignableUsers([])
        return
      }

      try {
        const [profile, members] = await Promise.all([
          getCurrentWorkspaceProfile(activeWorkspace.workspaceId),
          getWorkspaceMembers(activeWorkspace.workspaceId)
        ])

        setUserProfile(profile)

        const adminStatus =
          profile?.role === 'admin' ||
          profile?.workspace_role === 'owner' ||
          profile?.workspaceRole === 'owner'

        setIsAdminUser(adminStatus)
        setAssignableUsers(
          (members || [])
            .filter((workflowUser) => !workflowUser.banned)
            .map((workflowUser) => ({
              id: workflowUser.userId,
              email: workflowUser.email,
              full_name: workflowUser.fullName,
              role: workflowUser.membershipRole === 'owner' ? 'admin' : (workflowUser.profileRole || 'user'),
              workspace_role: workflowUser.membershipRole,
              team_role: workflowUser.workflowRole || 'developer'
            }))
        )
      } catch (error) {
        console.error('Error loading projects dashboard profile:', error)
        setUserProfile(null)
        setIsAdminUser(false)
        setAssignableUsers([])
      }
    }

    void loadProfile()
  }, [isGuest, activeWorkspace?.workspaceId])

  const developerUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => (
      workflowUser.role !== 'admin' && getWorkflowTeamRole(workflowUser) === 'developer'
    ))
  ), [assignableUsers])

  const qaUsers = useMemo(() => (
    assignableUsers.filter((workflowUser) => (
      workflowUser.role !== 'admin' && getWorkflowTeamRole(workflowUser) === 'qa'
    ))
  ), [assignableUsers])

  const formatFilterOptions = useMemo(() => {
    const workspaceFormats = projects
      .map((project) => String(project.format || '').trim())
      .filter(Boolean)

    const uniqueFormats = Array.from(new Set([...PROJECT_FORMATS, ...workspaceFormats]))

    return [
      { value: 'all', label: 'All formats' },
      ...uniqueFormats.map((format) => ({
        value: format,
        label: format
      }))
    ]
  }, [projects])

  const filteredProjects = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase()

    return projects.filter((project) => {
      const projectOrientation = getProjectOrientation(project)
      const projectStatus = project.isArchived ? 'archived' : normalizeProjectStatus(project.status)
      const projectDeveloperData = getAssigneeData({
        assigneeId: getProjectDeveloperId(project),
        assignableUsers,
        currentUserId: userProfile?.id,
        fallback: getProjectCreatorId(project) === userProfile?.id ? 'You' : 'Unassigned',
        roleLabel: 'Developer'
      })
      const projectQaData = getAssigneeData({
        assigneeId: getProjectQaId(project),
        assignableUsers,
        currentUserId: userProfile?.id,
        fallback: 'Unassigned',
        roleLabel: 'QA'
      })
      const searchContent = [
        project.name,
        getProjectIdentifier(project),
        project.format,
        getProjectStatusLabel(project.status),
        projectOrientation,
        projectDeveloperData.label,
        projectQaData.label
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = normalizedSearchQuery === '' || searchContent.includes(normalizedSearchQuery)
      const matchesStage = stageFilter === 'all' || projectStatus === stageFilter
      const matchesOrientation = orientationFilter === 'all' || projectOrientation === orientationFilter
      const matchesFormat = formatFilter === 'all' || String(project.format || '').trim() === formatFilter

      return matchesSearch && matchesStage && matchesOrientation && matchesFormat
    })
  }, [assignableUsers, formatFilter, orientationFilter, projects, searchQuery, stageFilter, userProfile?.id])

  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((leftProject, rightProject) => {
      if (!sortBy) {
        return 0
      }

      let leftValue = ''
      let rightValue = ''

      switch (sortBy) {
        case 'name':
          leftValue = String(leftProject.name || '').toLowerCase()
          rightValue = String(rightProject.name || '').toLowerCase()
          break
        case 'status':
          leftValue = leftProject.isArchived ? 'archived' : normalizeProjectStatus(leftProject.status)
          rightValue = rightProject.isArchived ? 'archived' : normalizeProjectStatus(rightProject.status)
          break
        case 'format':
          leftValue = String(leftProject.format || '').toLowerCase()
          rightValue = String(rightProject.format || '').toLowerCase()
          break
        case 'orientation':
          leftValue = getProjectOrientation(leftProject)
          rightValue = getProjectOrientation(rightProject)
          break
        default:
          return 0
      }

      if (leftValue < rightValue) {
        return sortOrder === 'asc' ? -1 : 1
      }

      if (leftValue > rightValue) {
        return sortOrder === 'asc' ? 1 : -1
      }

      return 0
    })
  }, [filteredProjects, sortBy, sortOrder])

  const projectStats = useMemo(() => {
    return projects.reduce((summary, project) => {
      const normalizedStatus = normalizeProjectStatus(project.status)

      summary.total += 1
      if (project.isArchived) {
        summary.archived += 1
      } else {
        summary[normalizedStatus] += 1
      }

      return summary
    }, {
      total: 0,
      development: 0,
      qa: 0,
      production: 0,
      archived: 0
    })
  }, [projects])

  const headerSearchResults = useMemo(() => {
    const normalizedQuery = headerSearchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return []
    }

    const projectResults = projects
      .map((project) => {
        const projectStatus = project.isArchived ? 'archived' : normalizeProjectStatus(project.status)
        const projectStatusLabel = project.isArchived ? 'Archived' : getProjectStatusLabel(project.status)
        const projectIdentifier = getProjectIdentifier(project)
        const searchableProjectContent = [
          project.name,
          project.id,
          projectIdentifier,
          projectStatus,
          projectStatusLabel
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchableProjectContent.includes(normalizedQuery)) {
          return null
        }

        return {
          id: `project-${project.id}`,
          type: 'project',
          title: project.name || 'Untitled project',
          description: `${projectIdentifier} · ${projectStatusLabel}`,
          meta: project.format || 'Project',
          project
        }
      })
      .filter(Boolean)

    const memberResults = assignableUsers
      .map((workflowUser) => {
        const memberName = workflowUser.full_name || workflowUser.email || 'Workspace member'
        const memberEmail = workflowUser.email || ''
        const memberRoleLabel = workflowUser.role === 'admin'
          ? 'Admin'
          : getWorkflowTeamRoleLabel(workflowUser)
        const searchableMemberContent = [
          memberName,
          memberEmail,
          workflowUser.role,
          workflowUser.workspace_role,
          memberRoleLabel
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchableMemberContent.includes(normalizedQuery)) {
          return null
        }

        return {
          id: `member-${workflowUser.id}`,
          type: 'member',
          title: memberName,
          description: memberEmail && memberEmail !== memberName ? memberEmail : memberRoleLabel,
          meta: memberRoleLabel,
          member: workflowUser
        }
      })
      .filter(Boolean)

    return [...projectResults.slice(0, 6), ...memberResults.slice(0, 6)].slice(0, 8)
  }, [assignableUsers, headerSearchQuery, projects])

  const activeUserLabel = isGuest
    ? 'Guest access'
    : (userProfile?.full_name || userProfile?.email || 'Workspace user')
  const isSoloWorkspace = !isGuest && activeWorkspace?.workspaceType === 'personal'
  const identityRole = isGuest
    ? 'guest'
    : isSoloWorkspace
      ? null
      : (userProfile ? getWorkflowTeamRole(userProfile) : 'member')
  const identityRoleLabel = isGuest
    ? 'Guest'
    : isSoloWorkspace
      ? null
      : (userProfile ? getWorkflowTeamRoleLabel(userProfile) : 'Workspace user')
  const canLaunchNewCreative = !isGuest && canCreateProjects(userProfile)
  const canManageWorkspaceAccess =
    !isGuest && activeWorkspace?.workspaceType === 'team' && activeWorkspace?.workspaceRole === 'owner'
  const shouldShowWorkspaceAccessButton = isGuest || canManageWorkspaceAccess
  const visibleWorkspaces = !isGuest && activeWorkspace
    ? (accessibleWorkspaces.length > 0 ? accessibleWorkspaces : [activeWorkspace])
    : []
  const totalProjectPages = Math.max(1, Math.ceil(sortedProjects.length / PROJECTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalProjectPages)
  const paginatedProjects = sortedProjects.slice(
    (safeCurrentPage - 1) * PROJECTS_PER_PAGE,
    safeCurrentPage * PROJECTS_PER_PAGE
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, stageFilter, orientationFilter, formatFilter, sortBy, sortOrder, projects.length])

  useEffect(() => {
    if (currentPage > totalProjectPages) {
      setCurrentPage(totalProjectPages)
    }
  }, [currentPage, totalProjectPages])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((previousOrder) => previousOrder === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortBy(column)
    setSortOrder('asc')
  }

  const handleHeaderSearchResultSelect = (result) => {
    try {
      if (result.type === 'project' && result.project) {
        const canEditProject = canManageProject(result.project, userProfile)

        if (!canEditProject) {
          alert(getProjectAccessMessage(result.project, userProfile, 'edit'))
          return
        }

        onEditProject?.(result.project)
        return
      }

      if (result.type === 'member') {
        onOpenCabinet?.('member', {
          member: {
            userId: result.member.id,
            id: result.member.id,
            email: result.member.email,
            fullName: result.member.full_name,
            profileRole: result.member.role,
            workflowRole: result.member.team_role,
            membershipRole: result.member.workspace_role,
            created_at: result.member.created_at
          }
        })
      }
    } catch (error) {
      console.error('Failed to open header search result:', error)
      alert('Unable to open the selected search result. Please try again.')
    }
  }

  return (
    <div className="projects-view">
      <PageHeader
        identity={isGuest || userProfile ? {
          name: activeUserLabel,
          email: isGuest ? 'Read-only review session' : (userProfile?.full_name || userProfile?.email || null),
          role: identityRole,
          roleLabel: identityRoleLabel
        } : null}
        onSignOut={onSignOut}
        signOutLabel={isGuest ? 'Exit guest mode' : 'Sign out'}
        searchPlaceholder="Jump to project, member, scene..."
        searchValue={headerSearchQuery}
        searchResults={headerSearchResults}
        onSearchChange={setHeaderSearchQuery}
        onSearchResultSelect={handleHeaderSearchResultSelect}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onNotificationSelect={onNotificationSelect}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        onClearNotifications={onClearNotifications}
        onIdentityClick={!isGuest ? onOpenCabinet : undefined}
        actions={(shouldShowWorkspaceAccessButton || onOpenWorkspaceJoin) ? (
          <div className="ui-page-header__workspace-actions">
            {shouldShowWorkspaceAccessButton && (
              <button
                type="button"
                className="ui-page-header__workspace-settings-button"
                onClick={onOpenWorkspaceAccess}
                aria-label={isGuest ? 'Open payment and workspace access' : 'Open workspace access settings'}
                title={isGuest ? 'Payment and workspace access' : 'Workspace access settings'}
              >
                <Settings size={16} />
              </button>
            )}
            {onOpenWorkspaceJoin && (
              <button
                type="button"
                className="ui-page-header__workspace-settings-button ui-page-header__workspace-settings-button--join"
                onClick={onOpenWorkspaceJoin}
                aria-label="Join a team workspace"
                title="Join a team workspace"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        ) : null}
      />

      <div className="projects-page app-page">
        <div className="app-shell projects-shell">
          <section className="projects-hero">
            <div className="projects-hero-top">
              <div className="projects-hero-workspace-row">
                {visibleWorkspaces.length > 0 ? (
                  <WorkspaceSwitcher
                    workspaces={visibleWorkspaces}
                    active={activeWorkspace?.workspaceId || null}
                    onChange={onWorkspaceChange}
                  />
                ) : (
                  <div className="projects-guest-pill">
                    <span className="projects-guest-pill__dot" />
                    Guest session
                  </div>
                )}

                {!isGuest && (
                  <div className="projects-sync-pill">
                    <span className="projects-sync-pill__dot" />
                    Synced · just now
                  </div>
                )}

              </div>
            </div>

            <div className="projects-hero-copy">
              <div className="projects-hero-eyebrow">Operations / Portfolio</div>
              <h1 className="projects-hero-title text-gradient-cool">Creative projects</h1>
              <p className="projects-hero-description">
                Everything your workspace is currently producing. Move work through stages, reassign developers and QA,
                and ship finished creatives.
              </p>
            </div>
          </section>

          <section className="projects-dashboard-stats">
            <MetricCard
              label="Total projects"
              value={projectStats.total}
              hint="Across all visible projects."
              icon={FolderKanban}
              tone="blue"
            />
            <MetricCard
              label="In development"
              value={projectStats.development}
              hint="Actively being built."
              icon={Hammer}
              tone="violet"
            />
            <MetricCard
              label="QA review"
              value={projectStats.qa}
              hint="Awaiting sign-off."
              icon={ShieldCheck}
              tone="gold"
            />
            <MetricCard
              label="Production"
              value={projectStats.production}
              hint="Released live."
              icon={Rocket}
              tone="emerald"
            />
          </section>

          <section ref={boardRef} className="glass-panel projects-board">
            <div className="projects-toolbar">
              <div className="projects-toolbar-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search by name, identifier, assignee..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="projects-stage-pills">
                {STAGE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`projects-stage-pill ${stageFilter === option.id ? 'active' : ''}`}
                    onClick={() => setStageFilter(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="projects-toolbar-selects">
                <FilterSelect
                  label="Orientation"
                  value={orientationFilter}
                  options={ORIENTATION_FILTER_OPTIONS}
                  onChange={setOrientationFilter}
                  icon={MonitorSmartphone}
                />
                <FilterSelect
                  label="Format"
                  value={formatFilter}
                  options={formatFilterOptions}
                  onChange={setFormatFilter}
                  icon={FolderKanban}
                />
              </div>

              {canLaunchNewCreative && (
                <button
                  type="button"
                  className="projects-hero-action projects-hero-action-primary projects-toolbar-new-creative glow-blue"
                  onClick={onNewProject}
                >
                  + New creative
                </button>
              )}

              <div className="projects-toolbar-summary">
                <span>{sortedProjects.length}</span> of <span>{projects.length}</span> results
              </div>
            </div>

            <div className="projects-table-shell">
              <div className="projects-table projects-table--header">
                <SortHeader label="Project" sortBy={sortBy} sortOrder={sortOrder} column="name" onSort={handleSort} />
                <SortHeader label="Status" sortBy={sortBy} sortOrder={sortOrder} column="status" onSort={handleSort} />
                <SortHeader label="Format" sortBy={sortBy} sortOrder={sortOrder} column="format" onSort={handleSort} />
                <SortHeader label="Orientation" sortBy={sortBy} sortOrder={sortOrder} column="orientation" onSort={handleSort} />
                <div>Developer</div>
                <div>QA reviewer</div>
                <div className="align-right">Actions</div>
              </div>

              {sortedProjects.length === 0 ? (
                <div className="projects-empty-state">
                  <h3>No matching projects</h3>
                  <p>
                    {projects.length === 0
                      ? 'No projects are available yet. Create a new creative to get started.'
                      : 'Adjust the current search or filters to see more projects.'}
                  </p>
                </div>
              ) : (
                <div className="projects-table-rows">
                  {paginatedProjects.map((project) => {
                    const canEdit = canManageProject(project, userProfile)
                    const canDelete = canDeleteProject(project, userProfile)
                    const editTitle = getProjectAccessMessage(project, userProfile, 'edit')
                    const inlineEditTitle = canEdit
                      ? 'Open the project and use workflow buttons in the editor to change the stage.'
                      : getProjectAccessMessage(project, userProfile, 'status')
                    const deleteTitle = getProjectAccessMessage(project, userProfile, 'delete')
                    const projectStatusLabel = project.isArchived ? 'Archived' : getProjectStatusLabel(project.status)
                    const projectStatus = project.isArchived ? 'archived' : normalizeProjectStatus(project.status)
                    const projectCreatorId = getProjectCreatorId(project)
                    const projectDeveloperId = getProjectDeveloperId(project)
                    const projectQaId = getProjectQaId(project)
                    const projectOrientation = getProjectOrientation(project)
                    const hasAssets = Array.isArray(project.images) && project.images.length > 0
                    const projectDeveloperData = getAssigneeData({
                      assigneeId: projectDeveloperId,
                      assignableUsers,
                      currentUserId: userProfile?.id,
                      fallback: projectCreatorId === userProfile?.id ? 'You' : 'Unassigned',
                      roleLabel: 'Developer'
                    })
                    const projectQaData = getAssigneeData({
                      assigneeId: projectQaId,
                      assignableUsers,
                      currentUserId: userProfile?.id,
                      fallback: 'Unassigned',
                      roleLabel: 'QA'
                    })

                    return (
                      <div key={String(project.id)} className="projects-table projects-table--row">
                        <div className="projects-project-cell">
                          <div className="projects-project-icon">
                            {projectOrientation === 'portrait'
                              ? <Smartphone size={16} />
                              : <Monitor size={16} />}
                          </div>

                          <div className="projects-project-copy">
                            {editingProjectId === project.id && canEdit ? (
                              <input
                                type="text"
                                className="projects-inline-input"
                                value={project.name}
                                onChange={(event) => onUpdateProject(project.id, 'name', event.target.value)}
                                onBlur={() => onSetEditingId(null)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    onSetEditingId(null)
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                className={`projects-name-button ${!canEdit ? 'locked' : ''}`}
                                onClick={() => {
                                  if (canEdit) {
                                    onSetEditingId(project.id)
                                  }
                                }}
                                title={inlineEditTitle}
                              >
                                {project.name}
                              </button>
                            )}
                            <div className="projects-project-meta">
                              {getProjectIdentifier(project)} · {formatRelativeTime(project.updatedAt || project.updated_at || project.createdAt || project.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="projects-status-cell">
                          <StatusChip
                            status={projectStatus}
                            label={projectStatusLabel}
                            size="sm"
                          />
                        </div>

                        <div className="projects-format-cell">
                          <span className="projects-format-badge">{project.format || 'Banner'}</span>
                        </div>

                        <div className="projects-orientation-cell">
                          <MonitorSmartphone size={14} />
                          {projectOrientation}
                        </div>

                        <div className="projects-assignee-cell">
                          {isSoloWorkspace ? (
                            <div className="projects-solo-assignee">{activeUserLabel}</div>
                          ) : isAdminUser ? (
                            <select
                              className="projects-inline-select"
                              value={projectDeveloperId || ''}
                              onChange={(event) => onUpdateProject(project.id, 'developerId', event.target.value || null)}
                            >
                              <option value="">Unassigned</option>
                              {developerUsers.map((workflowUser) => (
                                <option key={workflowUser.id} value={workflowUser.id}>
                                  {workflowUser.full_name || workflowUser.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <AssigneeCard {...projectDeveloperData} />
                          )}
                        </div>

                        <div className="projects-assignee-cell">
                          {isSoloWorkspace ? (
                            <div className="projects-solo-assignee">{activeUserLabel}</div>
                          ) : isAdminUser ? (
                            <select
                              className="projects-inline-select"
                              value={projectQaId || ''}
                              onChange={(event) => onUpdateProject(project.id, 'qaId', event.target.value || null)}
                            >
                              <option value="">Unassigned</option>
                              {qaUsers.map((workflowUser) => (
                                <option key={workflowUser.id} value={workflowUser.id}>
                                  {workflowUser.full_name || workflowUser.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <AssigneeCard {...projectQaData} />
                          )}
                        </div>

                        <div className="projects-actions-cell">
                          <IconActionButton
                            icon={Eye}
                            label="Preview"
                            disabled={!hasAssets}
                            onClick={() => {
                              if (hasAssets) {
                                onProjectPreview?.(project, projectOrientation)
                              }
                            }}
                          />
                          <IconActionButton
                            icon={Download}
                            label="Export"
                            disabled={!hasAssets}
                            onClick={() => {
                              if (hasAssets) {
                                onProjectExport?.(project)
                              }
                            }}
                          />
                          {!isGuest && (
                            <IconActionButton
                              icon={ArrowUpRight}
                              label="Open"
                              primary
                              disabled={!canEdit}
                              title={editTitle}
                              onClick={() => {
                                if (canEdit) {
                                  onEditProject?.(project)
                                }
                              }}
                            />
                          )}
                          {!isGuest && (
                            <IconActionButton
                              icon={Trash2}
                              label="Delete"
                              danger
                              disabled={!canDelete}
                              title={deleteTitle}
                              onClick={() => {
                                if (canDelete) {
                                  onDeleteProject?.(project.id)
                                } else {
                                  alert(deleteTitle)
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {sortedProjects.length > PROJECTS_PER_PAGE && (
              <div className="projects-pagination" aria-label="Projects pagination">
                <button
                  type="button"
                  className="projects-pagination__button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  ←
                </button>

                <div className="projects-pagination__pages">
                  {Array.from({ length: totalProjectPages }, (_, index) => {
                    const page = index + 1

                    return (
                      <button
                        key={page}
                        type="button"
                        className={`projects-pagination__page ${page === safeCurrentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                        aria-current={page === safeCurrentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="projects-pagination__button"
                  onClick={() => setCurrentPage((page) => Math.min(totalProjectPages, page + 1))}
                  disabled={safeCurrentPage === totalProjectPages}
                >
                  →
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const SortHeader = ({ label, sortBy, sortOrder, column, onSort }) => {
  const isActive = sortBy === column
  const suffix = isActive ? (sortOrder === 'asc' ? ' (asc)' : ' (desc)') : ''

  return (
    <button
      type="button"
      className={`projects-sort-header ${isActive ? 'active' : ''}`}
      onClick={() => onSort(column)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {suffix}
    </button>
  )
}

const AssigneeCard = ({ label, initials, isEmpty, roleLabel }) => {
  if (isEmpty) {
    return (
      <div className="projects-assignee-card projects-assignee-card--empty">
        {label}
      </div>
    )
  }

  return (
    <div className="projects-assignee-card">
      <div className="ui-avatar ui-avatar--sm">{initials}</div>
      <div className="projects-assignee-card__copy">
        <div className="projects-assignee-card__name">{label}</div>
        <div className="projects-assignee-card__role">{roleLabel}</div>
      </div>
    </div>
  )
}

const IconActionButton = ({
  icon: Icon,
  label,
  disabled = false,
  title,
  primary = false,
  danger = false,
  onClick
}) => {
  return (
    <button
      type="button"
      title={title || label}
      aria-label={title || label}
      className={[
        'projects-action-icon',
        primary ? 'primary' : '',
        danger ? 'danger' : ''
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} />
    </button>
  )
}

const FilterSelect = ({ label, value, options, onChange, icon: Icon }) => {
  const selectedOption = options.find((option) => option.value === value) || options[0]
  const displayLabel = value === 'all' ? label : selectedOption?.label || label

  return (
    <label className="projects-filter-select">
      <span className="projects-filter-select__chrome">
        <span className="projects-filter-select__copy">
          {Icon && <Icon size={14} />}
          <span>{displayLabel}</span>
        </span>
        <ChevronDown size={14} />
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default ProjectsList

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Building2,
  FolderKanban,
  Hammer,
  Rocket,
  Settings,
  Shield,
  User as UserIcon,
  Users
} from 'lucide-react'
import { getCurrentProfile, banUser, unbanUser } from '../../../services/authService'
import { getCurrentWorkspaceProfile } from '../../../services/workspaceService'
import {
  getWorkflowTeamRole,
  getWorkflowTeamRoleLabel,
  normalizeProjectStatus
} from '../../shared/utils/projectWorkflow'
import { supabase } from '../../../lib/supabase'
import PageHeader from '../../shared/ui/PageHeader'
import MetricCard from '../../shared/ui/MetricCard'
import TabBar from '../../shared/ui/TabBar'
import WorkspaceSwitcher from '../../shared/ui/WorkspaceSwitcher'
import ProfileTab from './tabs/ProfileTab'
import WorkspaceTab from './tabs/WorkspaceTab'
import ProjectsTab from './tabs/ProjectsTab'
import UsersTab from './tabs/UsersTab'
import MemberProfileTab from './tabs/MemberProfileTab'
import './UserCabinet.css'

const UserCabinet = ({
  projects: projectsFromProps,
  activeWorkspace,
  accessibleWorkspaces = [],
  workspaceMembers = [],
  workspaceInvites = [],
  workspaceJoinCredentials = null,
  workspaceJoinSecret = null,
  initialActiveTab = 'profile',
  initialSelectedMember = null,
  notifications = [],
  unreadNotificationCount = 0,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onWorkspaceChange,
  onOpenWorkspaceJoin,
  onCreateWorkspaceInvite,
  onRevokeWorkspaceInvite,
  onUpdateWorkspaceMemberRole,
  onRemoveWorkspaceMember,
  onRotateWorkspaceCredentials,
  onRefreshWorkspaceData,
  onBack,
  onSignOut,
  onEditProject,
  onProjectPreview,
  onProjectExport,
  onDeleteProject
}) => {
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState(projectsFromProps || [])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialActiveTab)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [isBanning, setIsBanning] = useState(false)
  const [workspaceInviteEmail, setWorkspaceInviteEmail] = useState('')
  const [workspaceInviteRole, setWorkspaceInviteRole] = useState('developer')
  const [workspaceInviteError, setWorkspaceInviteError] = useState('')
  const [workspaceInviteSuccess, setWorkspaceInviteSuccess] = useState('')
  const [isWorkspaceInviteLoading, setIsWorkspaceInviteLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [selectedWorkspaceMember, setSelectedWorkspaceMember] = useState(null)
  const [selectedWorkspaceMemberProjects, setSelectedWorkspaceMemberProjects] = useState([])
  const [loadingSelectedWorkspaceMemberProjects, setLoadingSelectedWorkspaceMemberProjects] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    void loadData()
  }, [activeWorkspace?.workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (projectsFromProps && Array.isArray(projectsFromProps)) {
      setProjects(projectsFromProps)
    }
  }, [projectsFromProps])

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab)
    }
  }, [initialActiveTab])

  useEffect(() => {
    setSelectedWorkspaceMember(null)
    setSelectedWorkspaceMemberProjects([])
  }, [activeWorkspace?.workspaceId])

  useEffect(() => {
    if ((!activeWorkspace || activeWorkspace.workspaceType === 'personal') && activeTab === 'workspace') {
      setActiveTab('profile')
    }
  }, [activeTab, activeWorkspace])

  useEffect(() => {
    if (profile?.role !== 'admin' && activeTab === 'users') {
      setActiveTab('profile')
    }
  }, [activeTab, profile?.role])

  useEffect(() => {
    if (activeTab === 'member' && !selectedWorkspaceMember) {
      setActiveTab('workspace')
    }
  }, [activeTab, selectedWorkspaceMember])

  useEffect(() => {
    if (loading || !contentRef.current) {
      return
    }

    const scrollFrame = window.requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(scrollFrame)
  }, [loading, activeTab])

  const loadData = async () => {
    try {
      setLoading(true)

      try {
        const userProfile = activeWorkspace?.workspaceId
          ? await getCurrentWorkspaceProfile(activeWorkspace.workspaceId)
          : await getCurrentProfile()

        setProfile(userProfile)

        if (userProfile?.role === 'admin') {
          await loadAllUsers()
        }
      } catch (error) {
        console.error('Error loading cabinet profile:', error)
        setProfile(null)
      }

      try {
        const { getUserProjects, transformProjectFromDB } = await import('../../../services/projectService')
        const projectsData = activeWorkspace?.workspaceId
          ? await getUserProjects(activeWorkspace.workspaceId)
          : []

        setProjects((projectsData || []).map(transformProjectFromDB))
      } catch (error) {
        console.error('Error loading cabinet projects:', error)
        setProjects([])
      }
    } catch (error) {
      console.error('Unexpected cabinet loading error:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    if (loadingUsers) {
      return
    }

    try {
      setLoadingUsers(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setAllUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const refreshOwnProfile = async () => {
    const updatedProfile = activeWorkspace?.workspaceId
      ? await getCurrentWorkspaceProfile(activeWorkspace.workspaceId)
      : await getCurrentProfile()

    setProfile(updatedProfile)
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const nextTeamRole = newRole === 'admin'
        ? null
        : (allUsers.find((user) => user.id === userId)?.team_role || 'developer')

      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          team_role: nextTeamRole
        })
        .eq('id', userId)

      if (error) {
        throw error
      }

      setAllUsers((previousUsers) => previousUsers.map((user) => (
        user.id === userId
          ? { ...user, role: newRole, team_role: nextTeamRole }
          : user
      )))

      if (userId === profile?.id) {
        await refreshOwnProfile()
      }
    } catch (error) {
      console.error('Error updating access role:', error)
      alert(`Error changing role: ${error.message}`)
    }
  }

  const handleTeamRoleChange = async (userId, newTeamRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_role: newTeamRole })
        .eq('id', userId)

      if (error) {
        throw error
      }

      setAllUsers((previousUsers) => previousUsers.map((user) => (
        user.id === userId ? { ...user, team_role: newTeamRole } : user
      )))

      if (userId === profile?.id) {
        await refreshOwnProfile()
      }
    } catch (error) {
      console.error('Error updating team role:', error)
      alert(`Error changing team role: ${error.message}`)
    }
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    try {
      setChangingPassword(true)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email,
        password: currentPassword
      })

      if (signInError) {
        setPasswordError('Invalid current password')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Error changing password:', error)
      setPasswordError(error.message || 'Error changing password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleWorkspaceInviteSubmit = async (event) => {
    event.preventDefault()
    setWorkspaceInviteError('')
    setWorkspaceInviteSuccess('')

    if (!onCreateWorkspaceInvite) {
      setWorkspaceInviteError('Workspace invite management is unavailable.')
      return
    }

    try {
      setIsWorkspaceInviteLoading(true)
      await onCreateWorkspaceInvite(workspaceInviteEmail, workspaceInviteRole)

      if (onRefreshWorkspaceData) {
        await onRefreshWorkspaceData()
      }

      setWorkspaceInviteEmail('')
      setWorkspaceInviteRole('developer')
      setWorkspaceInviteSuccess('Invitation saved successfully.')
    } catch (error) {
      console.error('Error creating workspace invite:', error)
      setWorkspaceInviteError(error.message || 'Unable to create the workspace invite.')
    } finally {
      setIsWorkspaceInviteLoading(false)
    }
  }

  const handleWorkspaceInviteRevoke = async (inviteId) => {
    if (!onRevokeWorkspaceInvite) {
      return
    }

    try {
      setWorkspaceInviteError('')
      setWorkspaceInviteSuccess('')
      await onRevokeWorkspaceInvite(inviteId)

      if (onRefreshWorkspaceData) {
        await onRefreshWorkspaceData()
      }
    } catch (error) {
      console.error('Error revoking workspace invite:', error)
      setWorkspaceInviteError(error.message || 'Unable to revoke the workspace invite.')
    }
  }

  const handleToggleBan = async (user) => {
    if (isBanning) {
      return
    }

    const action = user.banned ? 'unban' : 'ban'
    const confirmationAccepted = window.confirm(`Are you sure you want to ${action} account ${user.email || 'this user'}?`)

    if (!confirmationAccepted) {
      return
    }

    try {
      setIsBanning(true)

      if (user.banned) {
        await unbanUser(user.id)
      } else {
        await banUser(user.id)
      }

      const nextBannedState = !user.banned
      setAllUsers((previousUsers) => previousUsers.map((listedUser) => (
        listedUser.id === user.id ? { ...listedUser, banned: nextBannedState } : listedUser
      )))

      void loadAllUsers()
      alert(`User ${user.banned ? 'unbanned' : 'banned'}`)
    } catch (error) {
      console.error('Error changing user ban state:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsBanning(false)
    }
  }

  const handleProjectRemovedLocally = (projectId) => {
    setProjects((previousProjects) => previousProjects.filter((project) => String(project.id) !== String(projectId)))
  }

  const openWorkspaceMemberProfile = async (member) => {
    const memberUserId = member.userId || member.id

    if (!memberUserId) {
      alert('Unable to open this member profile: missing user identifier.')
      return
    }

    setSelectedWorkspaceMember({
      id: memberUserId,
      email: member.email,
      full_name: member.fullName,
      role: member.profileRole,
      team_role: member.workflowRole,
      workflowRole: member.workflowRole,
      membershipRole: member.membershipRole,
      created_at: member.created_at
    })
    setSelectedWorkspaceMemberProjects([])
    setActiveTab('member')

    try {
      setLoadingSelectedWorkspaceMemberProjects(true)
      const { getWorkspaceMemberProjects, transformProjectFromDB } = await import('../../../services/projectService')
      const memberProjects = activeWorkspace?.workspaceId
        ? await getWorkspaceMemberProjects(activeWorkspace.workspaceId, memberUserId)
        : []

      setSelectedWorkspaceMemberProjects((memberProjects || []).map(transformProjectFromDB))
    } catch (error) {
      console.error('Error loading selected member projects:', error)
      setSelectedWorkspaceMemberProjects([])
      alert(error.message || 'Unable to load this member projects.')
    } finally {
      setLoadingSelectedWorkspaceMemberProjects(false)
    }
  }

  const handleViewWorkspaceMember = (member) => {
    void openWorkspaceMemberProfile(member)
  }

  const handleViewUser = (user) => {
    void openWorkspaceMemberProfile({
      userId: user.id,
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      profileRole: user.role,
      workflowRole: user.team_role,
      membershipRole: user.role === 'admin' ? 'owner' : 'member',
      created_at: user.created_at
    })
  }

  useEffect(() => {
    if (initialActiveTab !== 'member' || !initialSelectedMember) {
      return
    }

    void openWorkspaceMemberProfile(initialSelectedMember)
  }, [initialActiveTab, initialSelectedMember, activeWorkspace?.workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const cabinetStats = useMemo(() => {
    return projects.reduce((summary, project) => {
      const normalizedStatus = normalizeProjectStatus(project.status)

      summary.total += 1
      summary[normalizedStatus] += 1

      return summary
    }, {
      total: 0,
      development: 0,
      qa: 0,
      production: 0
    })
  }, [projects])

  const workflowRole = getWorkflowTeamRole(profile)
  const workflowRoleLabel = getWorkflowTeamRoleLabel(profile)
  const isSoloWorkspace = activeWorkspace?.workspaceType === 'personal'
  const headerRole = isSoloWorkspace ? null : workflowRole
  const headerRoleLabel = isSoloWorkspace ? null : workflowRoleLabel
  const tabItems = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    activeWorkspace && activeWorkspace.workspaceType !== 'personal'
      ? { id: 'workspace', label: 'Workspace', icon: Building2 }
      : null,
    { id: 'projects', label: `Projects (${projects.length})`, icon: FolderKanban },
    selectedWorkspaceMember
      ? { id: 'member', label: 'Member profile', icon: UserIcon }
      : null,
    profile?.role === 'admin'
      ? { id: 'users', label: `User Management (${allUsers.length})`, icon: Shield }
      : null
  ].filter(Boolean)

  if (loading) {
    return (
      <div className="user-cabinet-loading">
        <div className="app-loading-panel">
          <div className="app-loading-eyebrow">Workspace profile</div>
          <h1 className="app-loading-title">Loading your operating profile</h1>
          <p className="app-loading-copy">
            We are preparing your profile, permissions, and project activity.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="user-cabinet-view">
      <PageHeader
        backLabel="Return to projects"
        onBack={onBack}
        identity={{
          name: profile?.full_name || profile?.email || 'Workspace user',
          email: profile?.full_name || profile?.email || 'No profile name',
          role: headerRole,
          roleLabel: headerRoleLabel
        }}
        workspaceSwitcher={activeWorkspace && accessibleWorkspaces.length > 1 ? (
          <WorkspaceSwitcher
            workspaces={accessibleWorkspaces}
            active={activeWorkspace.workspaceId}
            onChange={onWorkspaceChange}
          />
        ) : null}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onLogoClick={onBack}
        onNotificationSelect={onNotificationSelect}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        onClearNotifications={onClearNotifications}
        searchPlaceholder={null}
        actions={onOpenWorkspaceJoin ? (
          <button
            type="button"
            className="ui-page-header__workspace-settings-button ui-page-header__workspace-settings-button--join"
            onClick={onOpenWorkspaceJoin}
            aria-label="Join a team workspace"
            title="Join a team workspace"
          >
            <Settings size={16} />
          </button>
        ) : null}
      />

      <div className="user-cabinet app-page">
        <div className="app-shell user-cabinet-shell">
          <section className="user-cabinet-metrics">
            <MetricCard
              label="Assigned projects"
              value={cabinetStats.total}
              hint="Projects currently visible in your cabinet."
              icon={Boxes}
              tone="blue"
            />
            <MetricCard
              label="In development"
              value={cabinetStats.development}
              hint="Creatives still being actively built."
              icon={Hammer}
              tone="violet"
            />
            <MetricCard
              label="In QA"
              value={cabinetStats.qa}
              hint="Projects waiting for verification or feedback."
              icon={Users}
              tone="gold"
            />
            <MetricCard
              label="Production"
              value={cabinetStats.production}
              hint="Released or finalized project deliveries."
              icon={Rocket}
              tone="emerald"
            />
          </section>

          <section className="user-cabinet-tabs-wrap">
            <TabBar
              items={tabItems}
              active={activeTab}
              onChange={setActiveTab}
            />
          </section>

          <section ref={contentRef} className="user-cabinet-content">
            {activeTab === 'profile' && (
              <ProfileTab
                profile={profile}
                projects={projects}
                workflowRoleLabel={workflowRoleLabel}
                currentPassword={currentPassword}
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                changingPassword={changingPassword}
                passwordError={passwordError}
                passwordSuccess={passwordSuccess}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onSubmit={handlePasswordChange}
                onSignOut={onSignOut}
              />
            )}

            {activeTab === 'workspace' && activeWorkspace && (
              <WorkspaceTab
                activeWorkspace={activeWorkspace}
                accessibleWorkspaces={accessibleWorkspaces}
                workspaceMembers={workspaceMembers}
                workspaceInvites={workspaceInvites}
                workspaceJoinCredentials={workspaceJoinCredentials}
                workspaceJoinSecret={workspaceJoinSecret}
                workspaceInviteEmail={workspaceInviteEmail}
                workspaceInviteRole={workspaceInviteRole}
                workspaceInviteError={workspaceInviteError}
                workspaceInviteSuccess={workspaceInviteSuccess}
                isWorkspaceInviteLoading={isWorkspaceInviteLoading}
                onWorkspaceChange={onWorkspaceChange}
                onRotateWorkspaceCredentials={onRotateWorkspaceCredentials}
                onUpdateMemberRole={onUpdateWorkspaceMemberRole}
                onRemoveMember={onRemoveWorkspaceMember}
                onViewMember={handleViewWorkspaceMember}
                onInviteEmailChange={setWorkspaceInviteEmail}
                onInviteRoleChange={setWorkspaceInviteRole}
                onInviteSubmit={handleWorkspaceInviteSubmit}
                onInviteRevoke={handleWorkspaceInviteRevoke}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsTab
                projects={projects}
                profile={profile}
                onBack={onBack}
                onEditProject={onEditProject}
                onProjectPreview={onProjectPreview}
                onProjectExport={onProjectExport}
                onDeleteProject={onDeleteProject}
                onRemoveProjectLocally={handleProjectRemovedLocally}
              />
            )}

            {activeTab === 'member' && selectedWorkspaceMember && (
              <MemberProfileTab
                member={selectedWorkspaceMember}
                projects={selectedWorkspaceMemberProjects}
                isLoadingProjects={loadingSelectedWorkspaceMemberProjects}
                onBackToMembers={() => {
                  setActiveTab(activeWorkspace?.workspaceType === 'personal' ? 'profile' : 'workspace')
                }}
              />
            )}

            {activeTab === 'users' && profile?.role === 'admin' && (
              <UsersTab
                loadingUsers={loadingUsers}
                allUsers={allUsers}
                editingUserId={editingUserId}
                setEditingUserId={setEditingUserId}
                profile={profile}
                isBanning={isBanning}
                onViewUser={handleViewUser}
                onRoleChange={handleRoleChange}
                onTeamRoleChange={handleTeamRoleChange}
                onToggleBan={handleToggleBan}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default UserCabinet

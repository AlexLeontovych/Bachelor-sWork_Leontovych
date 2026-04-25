import {
  DEFAULT_PROJECT_STATUS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  TEAM_ROLE_LABELS
} from './constants'

/**
 * Normalizes project status to the supported workflow values.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 *
 * @example
 * normalizeProjectStatus('QA')
 */
export const normalizeProjectStatus = (status) => {
  try {
    const normalizedStatus = String(status || DEFAULT_PROJECT_STATUS).trim().toLowerCase()

    if (normalizedStatus === 'active' || normalizedStatus === 'paused') {
      return DEFAULT_PROJECT_STATUS
    }

    return PROJECT_STATUSES.includes(normalizedStatus) ? normalizedStatus : DEFAULT_PROJECT_STATUS
  } catch (error) {
    console.error('Error normalizing project status:', error)
    return DEFAULT_PROJECT_STATUS
  }
}

/**
 * Returns the readable label for a workflow status.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 *
 * @example
 * getProjectStatusLabel('production')
 */
export const getProjectStatusLabel = (status) => {
  try {
    const normalizedStatus = normalizeProjectStatus(status)
    return PROJECT_STATUS_LABELS[normalizedStatus] || PROJECT_STATUS_LABELS[DEFAULT_PROJECT_STATUS]
  } catch (error) {
    console.error('Error getting project status label:', error)
    return PROJECT_STATUS_LABELS[DEFAULT_PROJECT_STATUS]
  }
}

/**
 * Returns the workflow team role for the current profile.
 *
 * @param {{ role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {'developer' | 'qa' | 'lead'}
 *
 * @example
 * getWorkflowTeamRole(profile)
 */
export const getWorkflowTeamRole = (profile) => {
  try {
    if (profile?.role === 'admin' || profile?.workspace_role === 'owner' || profile?.workspaceRole === 'owner') {
      return 'lead'
    }

    const teamRole =
      profile?.workflow_role ||
      profile?.workflowRole ||
      profile?.team_role ||
      profile?.teamRole

    if (teamRole === 'lead' || teamRole === 'team_lead' || teamRole === 'admin') {
      return 'lead'
    }

    return teamRole === 'qa' ? 'qa' : 'developer'
  } catch (error) {
    console.error('Error getting workflow team role:', error)
    return 'developer'
  }
}

/**
 * Returns the readable team role label for the current profile.
 *
 * @param {{ role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {string}
 *
 * @example
 * getWorkflowTeamRoleLabel(profile)
 */
export const getWorkflowTeamRoleLabel = (profile) => {
  try {
    const workflowTeamRole = getWorkflowTeamRole(profile)
    return workflowTeamRole === 'lead' ? 'Team Lead' : TEAM_ROLE_LABELS[workflowTeamRole]
  } catch (error) {
    console.error('Error getting workflow team role label:', error)
    return 'Developer'
  }
}

/**
 * Reports whether the current profile belongs to a personal solo workspace.
 *
 * @param {{ workspace_type?: string, workspaceType?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * isSoloWorkspaceProfile(profile)
 */
export const isSoloWorkspaceProfile = (profile) => {
  try {
    const workspaceType = profile?.workspace_type || profile?.workspaceType
    return workspaceType === 'personal'
  } catch (error) {
    console.error('Error checking solo workspace profile:', error)
    return false
  }
}

/**
 * Returns the creator identifier of a project.
 *
 * @param {Object | null | undefined} project
 * @returns {string | null}
 *
 * @example
 * getProjectCreatorId(project)
 */
export const getProjectCreatorId = (project) => {
  try {
    return project?.userId || project?.user_id || null
  } catch (error) {
    console.error('Error getting project creator id:', error)
    return null
  }
}

/**
 * Returns the assigned developer identifier of a project.
 *
 * @param {Object | null | undefined} project
 * @returns {string | null}
 *
 * @example
 * getProjectDeveloperId(project)
 */
export const getProjectDeveloperId = (project) => {
  try {
    return project?.developerId || project?.developer_id || null
  } catch (error) {
    console.error('Error getting project developer id:', error)
    return null
  }
}

/**
 * Returns the assigned QA identifier of a project.
 *
 * @param {Object | null | undefined} project
 * @returns {string | null}
 *
 * @example
 * getProjectQaId(project)
 */
export const getProjectQaId = (project) => {
  try {
    return project?.qaId || project?.qa_id || null
  } catch (error) {
    console.error('Error getting project QA id:', error)
    return null
  }
}

/**
 * Returns the latest developer handoff note for QA.
 *
 * @param {Object | null | undefined} project
 * @returns {string}
 *
 * @example
 * getProjectQaHandoffNote(project)
 */
export const getProjectQaHandoffNote = (project) => {
  try {
    return project?.qaHandoffNote || project?.qa_handoff_note || ''
  } catch (error) {
    console.error('Error getting QA handoff note:', error)
    return ''
  }
}

/**
 * Returns the latest QA feedback note.
 *
 * @param {Object | null | undefined} project
 * @returns {string}
 *
 * @example
 * getProjectQaFeedbackNote(project)
 */
export const getProjectQaFeedbackNote = (project) => {
  try {
    return project?.qaFeedbackNote || project?.qa_feedback_note || ''
  } catch (error) {
    console.error('Error getting QA feedback note:', error)
    return ''
  }
}

/**
 * Returns whether the project is archived.
 *
 * @param {Object | null | undefined} project
 * @returns {boolean}
 *
 * @example
 * isProjectArchived(project)
 */
export const isProjectArchived = (project) => {
  try {
    return Boolean(project?.isArchived ?? project?.is_archived ?? false)
  } catch (error) {
    console.error('Error checking archived project state:', error)
    return false
  }
}

/**
 * Returns whether the project already has an assigned QA user.
 *
 * @param {Object | null | undefined} project
 * @returns {boolean}
 *
 * @example
 * hasAssignedQa(project)
 */
export const hasAssignedQa = (project) => {
  try {
    return Boolean(getProjectQaId(project))
  } catch (error) {
    console.error('Error checking assigned QA:', error)
    return false
  }
}

/**
 * Returns whether the profile can create projects.
 *
 * @param {{ role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canCreateProjects(profile)
 */
export const canCreateProjects = (profile) => {
  try {
    if (isSoloWorkspaceProfile(profile)) {
      return true
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)
    return profile?.role === 'admin' || workflowTeamRole === 'developer' || workflowTeamRole === 'lead'
  } catch (error) {
    console.error('Error checking project creation access:', error)
    return false
  }
}

/**
 * Returns whether the profile can edit project data on the current stage.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canManageProject(project, profile)
 */
export const canManageProject = (project, profile) => {
  try {
    if (!project || !profile?.id) {
      return false
    }

    if (isProjectArchived(project)) {
      return profile.role === 'admin' || isSoloWorkspaceProfile(profile)
    }

    if (profile.role === 'admin' || isSoloWorkspaceProfile(profile)) {
      return true
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)
    const projectStatus = normalizeProjectStatus(project.status)

    if (workflowTeamRole === 'lead') {
      return true
    }

    if (workflowTeamRole === 'developer') {
      return getProjectDeveloperId(project) === profile.id && projectStatus === 'development'
    }

    if (workflowTeamRole === 'qa') {
      return getProjectQaId(project) === profile.id && projectStatus === 'qa'
    }

    return false
  } catch (error) {
    console.error('Error checking project management access:', error)
    return false
  }
}

/**
 * Returns whether the profile can delete a project on the current stage.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canDeleteProject(project, profile)
 */
export const canDeleteProject = (project, profile) => {
  try {
    return canManageProject(project, profile)
  } catch (error) {
    console.error('Error checking project deletion access:', error)
    return false
  }
}

/**
 * Returns the workflow statuses that the current profile can set.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {string[]}
 *
 * @example
 * getAvailableStatusTransitions(project, profile)
 */
export const getAvailableStatusTransitions = (project, profile) => {
  try {
    if (!project || !profile) {
      return [normalizeProjectStatus(project?.status)]
    }

    const currentStatus = normalizeProjectStatus(project.status)

    if (profile.role === 'admin' || isSoloWorkspaceProfile(profile)) {
      return PROJECT_STATUSES
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)

    if (workflowTeamRole === 'developer' && getProjectDeveloperId(project) === profile.id && currentStatus === 'development') {
      return ['development', 'qa']
    }

    if (workflowTeamRole === 'qa' && getProjectQaId(project) === profile.id && currentStatus === 'qa') {
      return ['development', 'qa', 'production']
    }

    return [currentStatus]
  } catch (error) {
    console.error('Error getting available project status transitions:', error)
    return [DEFAULT_PROJECT_STATUS]
  }
}

/**
 * Returns whether the profile can move a project to the provided workflow status.
 *
 * @param {Object | null | undefined} project
 * @param {string} nextStatus
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canChangeProjectStatus(project, 'qa', profile)
 */
export const canChangeProjectStatus = (project, nextStatus, profile) => {
  try {
    const normalizedNextStatus = normalizeProjectStatus(nextStatus)
    return getAvailableStatusTransitions(project, profile).includes(normalizedNextStatus)
  } catch (error) {
    console.error('Error checking project status transition access:', error)
    return false
  }
}

/**
 * Returns whether the profile can send the project from Development to QA.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @param {{ isSaved?: boolean }} [options]
 * @returns {boolean}
 *
 * @example
 * canSendProjectToQa(project, profile, { isSaved: true })
 */
export const canSendProjectToQa = (project, profile, options = {}) => {
  try {
    if (!project || !profile?.id || isProjectArchived(project)) {
      return false
    }

    if (options.isSaved === false) {
      return false
    }

    if (isSoloWorkspaceProfile(profile)) {
      return normalizeProjectStatus(project.status) === 'development'
    }

    if (!hasAssignedQa(project)) {
      return false
    }

    const projectStatus = normalizeProjectStatus(project.status)
    if (projectStatus !== 'development') {
      return false
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)

    if (workflowTeamRole === 'lead') {
      return true
    }

    return workflowTeamRole === 'developer' && getProjectDeveloperId(project) === profile.id
  } catch (error) {
    console.error('Error checking Send to QA access:', error)
    return false
  }
}

/**
 * Returns whether the profile can return the project from QA to Development.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canReturnProjectToDevelopment(project, profile)
 */
export const canReturnProjectToDevelopment = (project, profile) => {
  try {
    if (!project || !profile?.id || isProjectArchived(project)) {
      return false
    }

    const projectStatus = normalizeProjectStatus(project.status)
    if (projectStatus !== 'qa') {
      return false
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)

    if (workflowTeamRole === 'lead' || isSoloWorkspaceProfile(profile)) {
      return true
    }

    return workflowTeamRole === 'qa' && getProjectQaId(project) === profile.id
  } catch (error) {
    console.error('Error checking Return to Development access:', error)
    return false
  }
}

/**
 * Returns whether the profile can approve the project from QA to Production.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @returns {boolean}
 *
 * @example
 * canApproveProjectToProduction(project, profile)
 */
export const canApproveProjectToProduction = (project, profile) => {
  try {
    if (!project || !profile?.id || isProjectArchived(project)) {
      return false
    }

    const projectStatus = normalizeProjectStatus(project.status)
    if (projectStatus !== 'qa') {
      return false
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)

    if (workflowTeamRole === 'lead' || isSoloWorkspaceProfile(profile)) {
      return true
    }

    return workflowTeamRole === 'qa' && getProjectQaId(project) === profile.id
  } catch (error) {
    console.error('Error checking Approve to Production access:', error)
    return false
  }
}

/**
 * Returns whether the profile can reopen a production project.
 *
 * @param {Object | null | undefined} project
 * @param {{ role?: string }} profile
 * @returns {boolean}
 *
 * @example
 * canReopenProjectFromProduction(project, profile)
 */
export const canReopenProjectFromProduction = (project, profile) => {
  try {
    return Boolean(
      project &&
      (getWorkflowTeamRole(profile) === 'lead' || isSoloWorkspaceProfile(profile)) &&
      normalizeProjectStatus(project.status) === 'production'
    )
  } catch (error) {
    console.error('Error checking production reopen access:', error)
    return false
  }
}

/**
 * Returns whether the profile can archive a production project.
 *
 * @param {Object | null | undefined} project
 * @param {{ role?: string }} profile
 * @returns {boolean}
 *
 * @example
 * canArchiveProject(project, profile)
 */
export const canArchiveProject = (project, profile) => {
  try {
    return Boolean(
      project &&
      (getWorkflowTeamRole(profile) === 'lead' || isSoloWorkspaceProfile(profile)) &&
      normalizeProjectStatus(project.status) === 'production' &&
      !isProjectArchived(project)
    )
  } catch (error) {
    console.error('Error checking archive access:', error)
    return false
  }
}

/**
 * Returns whether the profile can unarchive a project.
 *
 * @param {Object | null | undefined} project
 * @param {{ role?: string }} profile
 * @returns {boolean}
 *
 * @example
 * canUnarchiveProject(project, profile)
 */
export const canUnarchiveProject = (project, profile) => {
  try {
    return Boolean(project && (getWorkflowTeamRole(profile) === 'lead' || isSoloWorkspaceProfile(profile)) && isProjectArchived(project))
  } catch (error) {
    console.error('Error checking unarchive access:', error)
    return false
  }
}

/**
 * Returns the UI message that explains why a project is locked.
 *
 * @param {Object | null | undefined} project
 * @param {{ id?: string, role?: string, team_role?: string, teamRole?: string } | null | undefined} profile
 * @param {'edit' | 'delete' | 'status' | 'view'} [action='edit']
 * @returns {string}
 *
 * @example
 * getProjectAccessMessage(project, profile, 'edit')
 */
export const getProjectAccessMessage = (project, profile, action = 'edit') => {
  try {
    if (!profile?.id) {
      return 'Sign in to manage projects.'
    }

    if (isSoloWorkspaceProfile(profile)) {
      return action === 'delete' ? 'Delete project' : 'Edit project'
    }

    if (isProjectArchived(project) && profile.role !== 'admin') {
      return 'Archived projects are read-only for your role.'
    }

    if (profile.role === 'admin') {
      return action === 'delete' ? 'Delete project' : 'Edit project'
    }

    const workflowTeamRole = getWorkflowTeamRole(profile)
    const projectStatus = normalizeProjectStatus(project?.status)

    if (workflowTeamRole === 'developer') {
      if (getProjectDeveloperId(project) !== profile.id) {
        return 'Only the assigned developer or team lead can manage this project.'
      }

      if (projectStatus !== 'development') {
        return 'Developers can only manage projects in Development.'
      }
    }

    if (workflowTeamRole === 'qa') {
      if (getProjectQaId(project) !== profile.id) {
        return 'Only the assigned QA or team lead can manage this project.'
      }

      if (projectStatus !== 'qa') {
        return 'QA can only manage projects in QA.'
      }
    }

    return action === 'delete' ? 'Delete project' : 'Edit project'
  } catch (error) {
    console.error('Error getting project access message:', error)
    return 'You do not have access to this project action.'
  }
}

import { describe, expect, it } from 'vitest'
import {
  canApproveProjectToProduction,
  canArchiveProject,
  canCreateProjects,
  canManageProject,
  canReopenProjectFromProduction,
  canReturnProjectToDevelopment,
  canSendProjectToQa,
  isProjectArchived
} from '../projectWorkflow'

const developerProfile = {
  id: 'developer-1',
  role: 'user',
  team_role: 'developer'
}

const qaProfile = {
  id: 'qa-1',
  role: 'user',
  team_role: 'qa'
}

const leadProfile = {
  id: 'lead-1',
  role: 'admin',
  team_role: 'lead'
}

const workspaceOwnerProfile = {
  id: 'workspace-owner-1',
  role: 'user',
  workspace_role: 'owner',
  team_role: 'developer'
}

const soloWorkspaceProfile = {
  id: 'solo-owner-1',
  role: 'user',
  workspace_role: 'owner',
  workspace_type: 'personal',
  team_role: 'developer'
}

describe('projectWorkflow', () => {
  it('requires an assigned QA and a saved project before sending to QA', () => {
    const project = {
      status: 'development',
      developer_id: developerProfile.id,
      qa_id: null
    }

    expect(canSendProjectToQa(project, developerProfile, { isSaved: true })).toBe(false)

    const assignedProject = {
      ...project,
      qa_id: qaProfile.id
    }

    expect(canSendProjectToQa(assignedProject, developerProfile, { isSaved: false })).toBe(false)
    expect(canSendProjectToQa(assignedProject, developerProfile, { isSaved: true })).toBe(true)
  })

  it('allows assigned QA to return the project to Development with feedback', () => {
    const project = {
      status: 'qa',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id
    }

    expect(canReturnProjectToDevelopment(project, qaProfile)).toBe(true)
    expect(canReturnProjectToDevelopment(project, developerProfile)).toBe(false)
  })

  it('allows assigned QA to approve the project to Production', () => {
    const project = {
      status: 'qa',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id
    }

    expect(canApproveProjectToProduction(project, qaProfile)).toBe(true)
    expect(canApproveProjectToProduction(project, developerProfile)).toBe(false)
  })

  it('allows only the team lead to reopen a production project', () => {
    const project = {
      status: 'production',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id
    }

    expect(canReopenProjectFromProduction(project, leadProfile)).toBe(true)
    expect(canReopenProjectFromProduction(project, qaProfile)).toBe(false)
  })

  it('allows only the team lead to archive a production project', () => {
    const project = {
      status: 'production',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id
    }

    expect(canArchiveProject(project, leadProfile)).toBe(true)
    expect(canArchiveProject(project, qaProfile)).toBe(false)
  })

  it('treats a workspace owner as the team lead for workflow permissions', () => {
    const project = {
      status: 'production',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id
    }

    expect(canReopenProjectFromProduction(project, workspaceOwnerProfile)).toBe(true)
    expect(canArchiveProject(project, workspaceOwnerProfile)).toBe(true)
  })

  it('allows developers and team leads to create projects', () => {
    expect(canCreateProjects(developerProfile)).toBe(true)
    expect(canCreateProjects(leadProfile)).toBe(true)
    expect(canCreateProjects(workspaceOwnerProfile)).toBe(true)
    expect(canCreateProjects(soloWorkspaceProfile)).toBe(true)
    expect(canCreateProjects(qaProfile)).toBe(false)
  })

  it('treats archived projects as read-only for regular users', () => {
    const archivedProject = {
      status: 'production',
      developer_id: developerProfile.id,
      qa_id: qaProfile.id,
      is_archived: true
    }

    expect(isProjectArchived(archivedProject)).toBe(true)
    expect(canManageProject(archivedProject, developerProfile)).toBe(false)
    expect(canManageProject(archivedProject, leadProfile)).toBe(true)
  })

  it('allows solo workspace owners to use the full project workflow without assignments', () => {
    const developmentProject = {
      status: 'development',
      developer_id: null,
      qa_id: null
    }
    const qaProject = {
      status: 'qa',
      developer_id: null,
      qa_id: null
    }
    const productionProject = {
      status: 'production',
      developer_id: null,
      qa_id: null
    }
    const archivedProject = {
      ...productionProject,
      is_archived: true
    }

    expect(canManageProject(developmentProject, soloWorkspaceProfile)).toBe(true)
    expect(canSendProjectToQa(developmentProject, soloWorkspaceProfile, { isSaved: true })).toBe(true)
    expect(canReturnProjectToDevelopment(qaProject, soloWorkspaceProfile)).toBe(true)
    expect(canApproveProjectToProduction(qaProject, soloWorkspaceProfile)).toBe(true)
    expect(canReopenProjectFromProduction(productionProject, soloWorkspaceProfile)).toBe(true)
    expect(canArchiveProject(productionProject, soloWorkspaceProfile)).toBe(true)
    expect(canManageProject(archivedProject, soloWorkspaceProfile)).toBe(true)
  })
})

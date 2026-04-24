import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceInviteEmail, validateWorkspaceInviteCandidate } from '../workspaceInviteUtils'

const workspaceMembers = [
  {
    id: 'member-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    email: 'owner@example.com',
    fullName: 'Owner',
    membershipRole: 'owner',
    workflowRole: null,
    profileRole: 'user',
    banned: false
  },
  {
    id: 'member-2',
    workspaceId: 'workspace-1',
    userId: 'user-2',
    email: 'qa@example.com',
    fullName: 'QA',
    membershipRole: 'member',
    workflowRole: 'qa',
    profileRole: 'user',
    banned: false
  }
]

describe('workspaceInviteUtils', () => {
  it('normalizes invite emails to lowercase', () => {
    expect(normalizeWorkspaceInviteEmail(' Team@Example.com ')).toBe('team@example.com')
  })

  it('returns the normalized email when the invite can be created', () => {
    const result = validateWorkspaceInviteCandidate({
      email: 'developer@example.com',
      members: workspaceMembers
    })

    expect(result.normalizedEmail).toBe('developer@example.com')
  })

  it('rejects emails that already belong to a workspace member', () => {
    expect(() =>
      validateWorkspaceInviteCandidate({
        email: 'QA@example.com',
        members: workspaceMembers
      })
    ).toThrow('This email already belongs to a workspace member.')
  })
})

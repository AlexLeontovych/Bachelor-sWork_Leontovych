import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceJoinLogin, validateWorkspaceJoinRequest } from '../workspaceJoinCredentials'

describe('workspaceJoinCredentials', () => {
  it('normalizes workspace logins case-insensitively', () => {
    expect(normalizeWorkspaceJoinLogin(' Aurora-Team-01 ')).toBe('aurora-team-01')
  })

  it('returns a validated join payload with normalized login', () => {
    expect(
      validateWorkspaceJoinRequest({
        workspaceLogin: ' Creative-Hub-99 ',
        workspacePassword: 'SecretPass123!'
      })
    ).toEqual({
      workspaceLogin: 'creative-hub-99',
      workspacePassword: 'SecretPass123!'
    })
  })

  it('rejects invalid short logins and passwords', () => {
    expect(() =>
      validateWorkspaceJoinRequest({
        workspaceLogin: 'ab',
        workspacePassword: 'SecretPass123!'
      })
    ).toThrow('Workspace login must contain at least 3 characters.')

    expect(() =>
      validateWorkspaceJoinRequest({
        workspaceLogin: 'creative-hub-99',
        workspacePassword: 'short'
      })
    ).toThrow('Workspace password must contain at least 8 characters.')
  })
})

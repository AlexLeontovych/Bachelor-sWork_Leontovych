import { describe, expect, it } from 'vitest'
import {
  createWorkspaceJoinLogin,
  createWorkspaceJoinPassword,
  hashWorkspaceJoinPassword,
  verifyWorkspaceJoinPassword
} from '../workspaceCredentials'

describe('workspaceCredentials helper', () => {
  it('creates a deterministic workspace login from the workspace name and id', () => {
    expect(
      createWorkspaceJoinLogin({
        workspaceName: 'Aurora Creative Hub',
        workspaceId: '11111111-2222-3333-4444-abcdef123456'
      })
    ).toBe('aurora-creative-hub-ef123456')
  })

  it('generates a copyable workspace password', () => {
    const password = createWorkspaceJoinPassword()

    expect(password).toHaveLength(16)
    expect(password).toMatch(/^[A-Za-z0-9!@$%*]+$/)
  })

  it('hashes and verifies a workspace password', async () => {
    const password = 'WorkspaceSecret123!'
    const passwordHash = await hashWorkspaceJoinPassword(password)

    await expect(
      verifyWorkspaceJoinPassword({
        password,
        passwordHash
      })
    ).resolves.toBe(true)

    await expect(
      verifyWorkspaceJoinPassword({
        password: 'WrongPassword123!',
        passwordHash
      })
    ).resolves.toBe(false)
  })

  it('rejects malformed password hashes', async () => {
    await expect(
      verifyWorkspaceJoinPassword({
        password: 'WorkspaceSecret123!',
        passwordHash: 'invalid-hash'
      })
    ).rejects.toThrow('The workspace password hash format is invalid.')
  })
})

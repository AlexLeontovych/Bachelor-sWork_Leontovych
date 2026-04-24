import { describe, expect, it } from 'vitest'
import {
  clearPendingWorkspaceAction,
  createPendingCheckoutAction,
  createPendingWorkspaceJoinAction,
  getStoredPendingWorkspaceAction,
  storePendingWorkspaceAction
} from '../pendingWorkspaceAction'

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
}

describe('pendingWorkspaceAction', () => {
  it('stores and reads a pending checkout action', () => {
    const storage = createMemoryStorage()
    const action = createPendingCheckoutAction('team', 1000)

    storePendingWorkspaceAction(storage, action)

    expect(getStoredPendingWorkspaceAction(storage, 2000)).toEqual(action)
  })

  it('stores and reads a trimmed pending workspace join action', () => {
    const storage = createMemoryStorage()
    const action = createPendingWorkspaceJoinAction(
      {
        workspaceLogin: '  team-alpha  ',
        workspacePassword: 'shared-secret'
      },
      1000
    )

    storePendingWorkspaceAction(storage, action)

    expect(getStoredPendingWorkspaceAction(storage, 2000)).toMatchObject({
      type: 'workspaceJoin',
      workspaceLogin: 'team-alpha',
      workspacePassword: 'shared-secret'
    })
  })

  it('clears expired actions', () => {
    const storage = createMemoryStorage()
    const action = createPendingCheckoutAction('personal', 1000)

    storePendingWorkspaceAction(storage, action)

    expect(getStoredPendingWorkspaceAction(storage, action.expiresAt + 1)).toBeNull()
    expect(storage.length).toBe(0)
  })

  it('clears malformed actions', () => {
    const storage = createMemoryStorage()

    storage.setItem('lumen.pendingWorkspaceAction', '{broken-json')

    expect(getStoredPendingWorkspaceAction(storage, 1000)).toBeNull()
    expect(storage.length).toBe(0)
  })

  it('clears a pending action explicitly', () => {
    const storage = createMemoryStorage()

    storePendingWorkspaceAction(storage, createPendingCheckoutAction('team', 1000))
    clearPendingWorkspaceAction(storage)

    expect(getStoredPendingWorkspaceAction(storage, 2000)).toBeNull()
  })
})


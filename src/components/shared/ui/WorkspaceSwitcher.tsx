import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, User, Users } from 'lucide-react'

interface WorkspaceLike {
  id?: string
  name?: string
  type?: string
  accessLevel?: string
  access_level?: string
  workspaceId?: string
  workspaceName?: string
  workspaceType?: string
  workspaceRole?: string
  workspace_role?: string
}

interface WorkspaceSwitcherProps {
  workspaces?: WorkspaceLike[]
  active?: string | null
  onChange?: (workspaceId: string) => void
}

const resolveWorkspaceId = (workspace: WorkspaceLike) => workspace.workspaceId || workspace.id || ''
const resolveWorkspaceName = (workspace: WorkspaceLike) => workspace.workspaceName || workspace.name || 'Workspace'
const resolveWorkspaceType = (workspace: WorkspaceLike) => workspace.workspaceType || workspace.type || 'personal'
const resolveWorkspaceAccess = (workspace: WorkspaceLike) =>
  workspace.workspaceRole ||
  workspace.workspace_role ||
  workspace.accessLevel ||
  workspace.access_level ||
  'member'

const WorkspaceSwitcher = ({
  workspaces = [],
  active,
  onChange
}: WorkspaceSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const currentWorkspace = useMemo(() => {
    if (workspaces.length === 0) {
      return null
    }

    return workspaces.find((workspace) => resolveWorkspaceId(workspace) === active) || workspaces[0]
  }, [active, workspaces])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  if (!currentWorkspace) {
    return null
  }

  const workspaceType = resolveWorkspaceType(currentWorkspace)
  const CurrentIcon = workspaceType === 'team' ? Users : User

  return (
    <div className="ui-workspace-switcher" ref={rootRef}>
      <button
        type="button"
        className="ui-workspace-switcher__trigger"
        onClick={() => setIsOpen((previousValue) => !previousValue)}
      >
        <div className={`ui-workspace-switcher__icon ${workspaceType === 'team' ? 'team' : 'personal'}`}>
          <CurrentIcon size={16} />
        </div>
        <div className="ui-workspace-switcher__trigger-copy">
          <div className="ui-workspace-switcher__label">Workspace</div>
          <div className="ui-workspace-switcher__name">{resolveWorkspaceName(currentWorkspace)}</div>
        </div>
        <ChevronDown size={16} color="currentColor" />
      </button>

      {isOpen && (
        <div className="ui-workspace-switcher__menu glass-elevated">
          {workspaces.map((workspace) => {
            const workspaceId = resolveWorkspaceId(workspace)
            const optionType = resolveWorkspaceType(workspace)
            const OptionIcon = optionType === 'team' ? Users : User
            const isCurrent = workspaceId === resolveWorkspaceId(currentWorkspace)

            return (
              <button
                key={workspaceId}
                type="button"
                className="ui-workspace-switcher__option"
                onClick={() => {
                  setIsOpen(false)
                  if (workspaceId) {
                    onChange?.(workspaceId)
                  }
                }}
              >
                <div className={`ui-workspace-switcher__icon ${optionType === 'team' ? 'team' : 'personal'}`}>
                  <OptionIcon size={16} />
                </div>
                <div className="ui-workspace-switcher__option-copy">
                  <div className="ui-workspace-switcher__option-name">{resolveWorkspaceName(workspace)}</div>
                  <div className="ui-workspace-switcher__option-meta">
                    {optionType} / {resolveWorkspaceAccess(workspace)}
                  </div>
                </div>
                {isCurrent && (
                  <Check className="ui-workspace-switcher__check" size={16} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher

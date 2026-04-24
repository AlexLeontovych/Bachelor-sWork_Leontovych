import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { AlertTriangle, Image as ImageIcon, Type, X } from 'lucide-react'
import ProjectModal from './components/project/ProjectModal/ProjectModal'
import ProjectsList from './components/project/ProjectsList/ProjectsList'
import MenuBar from './components/studio/MenuBar/MenuBar'
import InspectorPanel from './components/studio/InspectorPanel/InspectorPanel'
import Canvas from './components/studio/Canvas/Canvas'
import DocumentPanel from './components/studio/DocumentPanel/DocumentPanel'
import UnsavedChangesModal from './components/studio/UnsavedChangesModal/UnsavedChangesModal'
import JSEditor from './components/editors/JSEditor/JSEditor'
import CSSEditor from './components/editors/CSSEditor/CSSEditor'
import LayersWindow from './components/layers/LayersWindow/LayersWindow'
import AuthForm from './components/auth/AuthForm/AuthForm'
import GuestCheckoutAuthModal from './components/auth/GuestCheckoutAuthModal/GuestCheckoutAuthModal'
import UserCabinet from './components/user/UserCabinet/UserCabinet'
import WorkspaceInviteModal from './components/workspace/WorkspaceInviteModal/WorkspaceInviteModal'
import WorkspaceJoinModal from './components/workspace/WorkspaceJoinModal/WorkspaceJoinModal'
import WorkspaceJoinRequestModal from './components/workspace/WorkspaceJoinRequestModal/WorkspaceJoinRequestModal'
import WorkspaceOnboardingView from './features/workspaceOnboarding/WorkspaceOnboardingView'
import { DEFAULT_CODE, DEFAULT_PROJECT_STATUS } from './components/shared/utils/constants'
import { getWorkspacePlan } from './features/workspaceOnboarding/workspacePlans'
import {
  canApproveProjectToProduction,
  canChangeProjectStatus,
  canReturnProjectToDevelopment,
  canReopenProjectFromProduction,
  canSendProjectToQa,
  canUnarchiveProject,
  canArchiveProject,
  canCreateProjects,
  canDeleteProject as canDeleteProjectByWorkflow,
  canManageProject,
  getProjectAccessMessage,
  getProjectQaId
} from './components/shared/utils/projectWorkflow'
import { getCurrentProfile, getSession, onAuthStateChange, signOut } from './services/authService'
import { createProject, deleteProject, getAccessibleProjects, updateProject, transformProjectFromDB } from './services/projectService'
import {
  claimPendingWorkspaceInvites,
  createWorkspaceCheckoutSession,
  createWorkspaceInvite,
  getCurrentWorkspaceProfile,
  getWorkspaceInviteDetails,
  getWorkspaceJoinRequestDetails,
  getWorkspaceJoinCredentialsSummary,
  getWorkspaceInvites,
  getWorkspaceMembers,
  getWorkspacePaymentStatus,
  joinWorkspaceWithCredentials,
  listAccessibleWorkspaces,
  removeWorkspaceMember,
  respondToWorkspaceJoinRequest,
  respondToWorkspaceInvite,
  rotateWorkspaceJoinCredentials,
  revokeWorkspaceInvite,
  updateWorkspaceMemberRole
} from './services/workspaceService'
import {
  clearProjectNotifications,
  listProjectNotifications,
  markAllProjectNotificationsRead,
  markProjectNotificationRead
} from './services/notificationService'
import {
  getStoredPendingPaymentStartedAt,
  getStoredActiveWorkspaceId,
  getStoredPendingPaymentOrderId,
  isWorkspacePaymentFailureStatus,
  resolvePostAuthDestination,
  resolveWorkspaceCheckoutAccess,
  storeActiveWorkspaceId,
  storePendingPaymentOrderId,
  storePendingPaymentStartedAt
} from './features/workspaceOnboarding/workspaceAccess'
import {
  clearPendingWorkspaceAction,
  createPendingCheckoutAction,
  createPendingWorkspaceJoinAction,
  getStoredPendingWorkspaceAction,
  storePendingWorkspaceAction
} from './features/workspaceOnboarding/pendingWorkspaceAction'
import { supabase } from './lib/supabase'
import { ROUTES } from './app/routes'

const getViewFromPath = (pathname) => {
  if (pathname === ROUTES.auth || pathname === ROUTES.root) {
    return 'login'
  }

  if (pathname === ROUTES.onboarding) {
    return 'onboarding'
  }

  if (pathname === ROUTES.cabinet) {
    return 'cabinet'
  }

  if (/^\/projects\/[^/]+\/editor$/.test(pathname)) {
    return 'editor'
  }

  if (pathname === ROUTES.projects || pathname.startsWith('/projects')) {
    return 'projects'
  }

  return 'login'
}

const getEditorProjectIdFromPath = (pathname) => {
  const match = pathname.match(/^\/projects\/([^/]+)\/editor$/)
  return match ? decodeURIComponent(match[1]) : null
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [view, setView] = useState(() => getViewFromPath(location.pathname))
  const [user, setUser] = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)
  const isSigningOutRef = useRef(false) // Прапорець для запобігання циклів при виході
  const isGuestRef = useRef(false)
  const userRef = useRef(null)
  const activeWorkspaceRef = useRef(null)
  const pendingWorkspacePaymentOrderIdRef = useRef(getStoredPendingPaymentOrderId())
  const pendingWorkspacePaymentStartedAtRef = useRef(getStoredPendingPaymentStartedAt())
  const workspaceActivationSuccessRef = useRef(false)
  const workspaceContextLoadIdRef = useRef(0)
  const isContinuingPendingWorkspaceActionRef = useRef(false)
  const realtimeRefreshTimeoutRef = useRef(null)
  const accessibleWorkspacesRefreshTimeoutRef = useRef(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projects, setProjects] = useState([])
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [projectStatus, setProjectStatus] = useState(DEFAULT_PROJECT_STATUS)
  const [projectFormat, setProjectFormat] = useState('')
  const [projectScreenFormat, setProjectScreenFormat] = useState('landscape')
  const [projectDeveloperId, setProjectDeveloperId] = useState('')
  const [projectQaId, setProjectQaId] = useState('')
  const [currentProject, setCurrentProject] = useState(null)
  const [code, setCode] = useState(DEFAULT_CODE)
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [compiled, setCompiled] = useState(false)
  const [activeTab, setActiveTab] = useState('Document')
  const [showLayersModal, setShowLayersModal] = useState(false)
  const [draggedLayerIndex, setDraggedLayerIndex] = useState(null)
  const [editingLayerId, setEditingLayerId] = useState(null)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [draggingImageId, setDraggingImageId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [editingTextId, setEditingTextId] = useState(null)
  const [resizingImageId, setResizingImageId] = useState(null)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [showDocumentMenu, setShowDocumentMenu] = useState(false)
  const [showJSEditor, setShowJSEditor] = useState(false)
  const [showCSSEditor, setShowCSSEditor] = useState(false)
  const [cssCode, setCssCode] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [studioNoticeModal, setStudioNoticeModal] = useState(null)
  const [sceneBackground, setSceneBackground] = useState('#ffffff')
  const [sceneBorderStyle, setSceneBorderStyle] = useState('none')
  const [sceneBorderColor, setSceneBorderColor] = useState('#000000')
  const [isSaved, setIsSaved] = useState(true)
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [isLeavingEditor, setIsLeavingEditor] = useState(false)
  const [workflowProfile, setWorkflowProfile] = useState(null)
  const [accessibleWorkspaces, setAccessibleWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [workspaceInvites, setWorkspaceInvites] = useState([])
  const [workspaceJoinCredentials, setWorkspaceJoinCredentials] = useState(null)
  const [workspaceJoinSecret, setWorkspaceJoinSecret] = useState(null)
  const [projectNotifications, setProjectNotifications] = useState([])
  const [workspaceInviteModal, setWorkspaceInviteModal] = useState(null)
  const [isWorkspaceInviteModalSubmitting, setIsWorkspaceInviteModalSubmitting] = useState(false)
  const [isWorkspaceJoinModalOpen, setIsWorkspaceJoinModalOpen] = useState(false)
  const [workspaceJoinRequestModal, setWorkspaceJoinRequestModal] = useState(null)
  const [isWorkspaceJoinRequestSubmitting, setIsWorkspaceJoinRequestSubmitting] = useState(false)
  const [selectedWorkspacePlan, setSelectedWorkspacePlan] = useState('team')
  const [guestCheckoutPlan, setGuestCheckoutPlan] = useState(null)
  const [guestWorkspaceJoinRequest, setGuestWorkspaceJoinRequest] = useState(null)
  const [pendingWorkspacePayment, setPendingWorkspacePayment] = useState(null)
  const [pendingWorkspacePaymentStartedAt, setPendingWorkspacePaymentStartedAt] = useState(
    pendingWorkspacePaymentStartedAtRef.current
  )
  const [workspacePaymentError, setWorkspacePaymentError] = useState('')
  const [isStartingWorkspaceCheckout, setIsStartingWorkspaceCheckout] = useState(false)
  const [isRefreshingWorkspacePayment, setIsRefreshingWorkspacePayment] = useState(false)
  const [isFinalizingWorkspaceActivation, setIsFinalizingWorkspaceActivation] = useState(false)
  const [isReturningToLogin, setIsReturningToLogin] = useState(false)
  const [isResolvingWorkspaceContext, setIsResolvingWorkspaceContext] = useState(false)
  const [showWorkspaceActivationSuccess, setShowWorkspaceActivationSuccess] = useState(false)
  const [cabinetInitialTab, setCabinetInitialTab] = useState('profile')
  const [cabinetInitialMember, setCabinetInitialMember] = useState(null)
  const [isWorkflowActionLoading, setIsWorkflowActionLoading] = useState(false)
  const [screenFormat, setScreenFormat] = useState('landscape') // 'landscape' або 'portrait'
  const [layersWindowPosition, setLayersWindowPosition] = useState({ x: 50, y: 100 })
  const [draggingLayersWindow, setDraggingLayersWindow] = useState(false)
  const [layersWindowDragOffset, setLayersWindowDragOffset] = useState({ x: 0, y: 0 })
  const [expandedSections, setExpandedSections] = useState({
    scenes: true,
    sceneProperties: true,
    creativeSize: false
  })

  // Функція для форматування розміру
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
  }

  // Обчислюємо загальний розмір всіх зображень
  const totalCreativeSize = images.reduce((total, img) => total + (img.size || 0), 0)
  const previewRef = useRef(null)
  const timelineRef = useRef(null)

  const syncGuestMode = (nextIsGuest) => {
    isGuestRef.current = nextIsGuest
    setIsGuest(nextIsGuest)
  }

  const syncPendingWorkspacePaymentOrderId = (nextOrderId) => {
    pendingWorkspacePaymentOrderIdRef.current = nextOrderId
    storePendingPaymentOrderId(nextOrderId)
  }

  const syncPendingWorkspacePaymentStartedAt = (nextStartedAt) => {
    pendingWorkspacePaymentStartedAtRef.current = nextStartedAt
    setPendingWorkspacePaymentStartedAt(nextStartedAt)
    storePendingPaymentStartedAt(nextStartedAt)
  }

  const syncWorkspaceActivationSuccess = (nextValue) => {
    workspaceActivationSuccessRef.current = nextValue
    setShowWorkspaceActivationSuccess(nextValue)
  }

  const navigateToView = (nextView, options = {}) => {
    const { replace = false, state, projectId = currentProject?.id } = options
    const nextPath = (() => {
      switch (nextView) {
        case 'login':
          return ROUTES.auth
        case 'onboarding':
          return ROUTES.onboarding
        case 'projects':
          return ROUTES.projects
        case 'cabinet':
          return ROUTES.cabinet
        case 'editor':
          return projectId ? ROUTES.editor(projectId) : ROUTES.projects
        default:
          return ROUTES.auth
      }
    })()

    setView(nextView)

    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace, state })
    }
  }

  const goBackFromOnboarding = () => {
    const fromPath = typeof location.state?.from === 'string' ? location.state.from : ''
    const safeFromPath = fromPath && fromPath !== ROUTES.onboarding ? fromPath : ''

    setWorkspacePaymentError('')

    if (safeFromPath) {
      navigate(safeFromPath, { replace: true })
      setView(getViewFromPath(safeFromPath))
      return
    }

    if (!isGuestRef.current && activeWorkspace?.workspaceId) {
      navigateToView('projects', { replace: true })
      return
    }

    navigateToView('login', { replace: true })
  }

  const savePendingWorkspaceAction = (action) => {
    if (typeof window === 'undefined') {
      return
    }

    storePendingWorkspaceAction(window.localStorage, action)
  }

  const clearSavedPendingWorkspaceAction = () => {
    if (typeof window === 'undefined') {
      return
    }

    clearPendingWorkspaceAction(window.localStorage)
  }

  const readSavedPendingWorkspaceAction = () => {
    if (typeof window === 'undefined') {
      return null
    }

    return getStoredPendingWorkspaceAction(window.localStorage)
  }

  const beginWorkspaceContextResolution = () => {
    const nextLoadId = workspaceContextLoadIdRef.current + 1
    workspaceContextLoadIdRef.current = nextLoadId
    setIsResolvingWorkspaceContext(true)
    return nextLoadId
  }

  const completeWorkspaceContextResolution = (loadId) => {
    if (workspaceContextLoadIdRef.current === loadId) {
      setIsResolvingWorkspaceContext(false)
    }
  }

  const resetWorkspaceState = () => {
    workspaceContextLoadIdRef.current += 1
    setIsResolvingWorkspaceContext(false)
    setAccessibleWorkspaces([])
    setActiveWorkspace(null)
    setWorkspaceMembers([])
    setWorkspaceInvites([])
    setWorkspaceJoinCredentials(null)
    setWorkspaceJoinSecret(null)
    setProjectNotifications([])
    setGuestCheckoutPlan(null)
    setGuestWorkspaceJoinRequest(null)
    setPendingWorkspacePayment(null)
    setWorkspacePaymentError('')
    setIsFinalizingWorkspaceActivation(false)
    syncWorkspaceActivationSuccess(false)
    storeActiveWorkspaceId(null)
    syncPendingWorkspacePaymentOrderId(null)
    syncPendingWorkspacePaymentStartedAt(null)
  }

  const loadProjectNotifications = async () => {
    try {
      if (!userRef.current || isGuestRef.current) {
        setProjectNotifications([])
        return []
      }

      const notifications = await listProjectNotifications(20)
      setProjectNotifications(notifications)
      return notifications
    } catch (error) {
      console.error('Error loading project notifications:', error)
      setProjectNotifications([])
      return []
    }
  }

  useEffect(() => {
    isGuestRef.current = isGuest
  }, [isGuest])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace
  }, [activeWorkspace])

  useEffect(() => {
    if (!user || isGuest || !activeWorkspace?.workspaceId) {
      setProjectNotifications([])
      return undefined
    }

    void loadProjectNotifications()

    const notificationsRefreshInterval = window.setInterval(() => {
      void loadProjectNotifications()
    }, 15000)

    const notificationsChannel = supabase
      .channel(`project-notifications-${activeWorkspace.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_notifications'
        },
        () => {
          void loadProjectNotifications()
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(notificationsRefreshInterval)
      void supabase.removeChannel(notificationsChannel)
    }
  }, [user?.id, isGuest, activeWorkspace?.workspaceId])

  useEffect(() => {
    if (!user || isGuest || !activeWorkspace?.workspaceId) {
      return undefined
    }

    const scheduleRealtimeRefresh = (options = {}) => {
      if (realtimeRefreshTimeoutRef.current) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current)
      }

      realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null
        const workspace = activeWorkspaceRef.current

        if (!workspace?.workspaceId || isGuestRef.current) {
          return
        }

        void loadProjects(workspace.workspaceId)

        if (options.refreshWorkspaceSupport) {
          void loadWorkspaceSupportData(workspace)
        }
      }, 250)
    }

    const workspaceRealtimeChannel = supabase
      .channel(`workspace-live-${activeWorkspace.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `workspace_id=eq.${activeWorkspace.workspaceId}`
        },
        () => {
          scheduleRealtimeRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${activeWorkspace.workspaceId}`
        },
        () => {
          scheduleRealtimeRefresh({ refreshWorkspaceSupport: true })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_invites',
          filter: `workspace_id=eq.${activeWorkspace.workspaceId}`
        },
        () => {
          scheduleRealtimeRefresh({ refreshWorkspaceSupport: true })
        }
      )
      .subscribe()

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current)
        realtimeRefreshTimeoutRef.current = null
      }

      void supabase.removeChannel(workspaceRealtimeChannel)
    }
  }, [user?.id, isGuest, activeWorkspace?.workspaceId])

  useEffect(() => {
    if (!user || isGuest) {
      return undefined
    }

    const refreshAccessibleWorkspaces = async () => {
      try {
        const workspaces = await listAccessibleWorkspaces()
        setAccessibleWorkspaces(workspaces)

        const currentWorkspace = activeWorkspaceRef.current
        const currentWorkspaceAccess = currentWorkspace?.workspaceId
          ? workspaces.find((workspace) => workspace.workspaceId === currentWorkspace.workspaceId)
          : null

        if (currentWorkspaceAccess) {
          setActiveWorkspace(currentWorkspaceAccess)
          storeActiveWorkspaceId(currentWorkspaceAccess.workspaceId)
          await loadWorkspaceSupportData(currentWorkspaceAccess)
          await loadProjects(currentWorkspaceAccess.workspaceId)
          return
        }

        if (workspaces.length > 0) {
          const nextWorkspace = resolvePostAuthDestination({
            workspaces,
            preferredWorkspaceId: getStoredActiveWorkspaceId()
          }).workspace || workspaces[0]

          setActiveWorkspace(nextWorkspace)
          storeActiveWorkspaceId(nextWorkspace.workspaceId)
          await loadWorkspaceSupportData(nextWorkspace)
          await loadProjects(nextWorkspace.workspaceId)

          if (view !== 'onboarding') {
            navigateToView('projects', { replace: true })
          }
          return
        }

        setActiveWorkspace(null)
        setWorkspaceMembers([])
        setWorkspaceInvites([])
        setWorkspaceJoinCredentials(null)
        setWorkspaceJoinSecret(null)
        setProjects([])
        setCurrentProject(null)
        storeActiveWorkspaceId(null)
        navigateToView('onboarding', { replace: true })
      } catch (error) {
        console.error('Error refreshing accessible workspaces from realtime:', error)
      }
    }

    const scheduleAccessibleWorkspacesRefresh = () => {
      if (accessibleWorkspacesRefreshTimeoutRef.current) {
        window.clearTimeout(accessibleWorkspacesRefreshTimeoutRef.current)
      }

      accessibleWorkspacesRefreshTimeoutRef.current = window.setTimeout(() => {
        accessibleWorkspacesRefreshTimeoutRef.current = null
        void refreshAccessibleWorkspaces()
      }, 250)
    }

    const userWorkspaceAccessChannel = supabase
      .channel(`user-workspace-access-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          scheduleAccessibleWorkspacesRefresh()
        }
      )
      .subscribe()

    const accessRefreshInterval = window.setInterval(() => {
      scheduleAccessibleWorkspacesRefresh()
    }, 5000)

    return () => {
      window.clearInterval(accessRefreshInterval)

      if (accessibleWorkspacesRefreshTimeoutRef.current) {
        window.clearTimeout(accessibleWorkspacesRefreshTimeoutRef.current)
        accessibleWorkspacesRefreshTimeoutRef.current = null
      }

      void supabase.removeChannel(userWorkspaceAccessChannel)
    }
  }, [user?.id, isGuest, view])

  useEffect(() => {
    const nextView = getViewFromPath(location.pathname)

    if (nextView === 'editor' && !currentProject) {
      const routeProjectId = getEditorProjectIdFromPath(location.pathname)
      const routeProject = projects.find((project) => String(project.id) === routeProjectId)

      if (!routeProject) {
        navigateToView('projects', { replace: true })
        return
      }
    }

    if (nextView !== view) {
      setView(nextView)
    }
  }, [location.pathname])

  useEffect(() => {
    let isMounted = true

    const loadWorkflowProfile = async () => {
      if (!user || isGuest || !activeWorkspace?.workspaceId) {
        setWorkflowProfile(null)
        return
      }

      try {
        const profile = await getCurrentWorkspaceProfile(activeWorkspace.workspaceId)

        if (!isMounted) {
          return
        }

        setWorkflowProfile(
          profile
            ? {
                ...profile,
                workspaceId: activeWorkspace.workspaceId
              }
            : {
                id: user.id,
                role: 'user',
                workspace_role: 'member',
                workspace_type: activeWorkspace.workspaceType,
                team_role: 'developer',
                email: user.email,
                workspaceId: activeWorkspace.workspaceId
              }
        )
      } catch (error) {
        console.error('Error loading workflow profile:', error)

        if (!isMounted) {
          return
        }

        setWorkflowProfile({
          id: user.id,
          role: 'user',
          workspace_role: 'member',
          workspace_type: activeWorkspace.workspaceType,
          team_role: 'developer',
          email: user.email,
          workspaceId: activeWorkspace.workspaceId
        })
      }
    }

    loadWorkflowProfile()

    return () => {
      isMounted = false
    }
  }, [user, isGuest, activeWorkspace?.workspaceId, activeWorkspace?.workspaceType])


  // Закриваємо меню при кліку поза ним
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDocumentMenu && !e.target.closest('.studio-menu-item')) {
        setShowDocumentMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDocumentMenu])

  // Оновлюємо ID елементів в DOM при зміні elementId
  useEffect(() => {
    if (previewRef.current) {
      images.forEach(image => {
        const imgElement = previewRef.current.querySelector(`img[data-image-index="${images.indexOf(image)}"]`)
        if (imgElement && image.elementId) {
          imgElement.id = image.elementId
        }
      })
    }
  }, [images])

  // Обробники для переміщення вікна шарів
  useEffect(() => {
    if (draggingLayersWindow) {
      const handleMouseMove = (e) => {
        if (!draggingLayersWindow) return
        e.preventDefault()
        
        const newX = e.clientX - layersWindowDragOffset.x
        const newY = e.clientY - layersWindowDragOffset.y
        
        // Обмежуємо позицію межами вікна
        const maxX = window.innerWidth - 350
        const maxY = window.innerHeight - 100
        
        setLayersWindowPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY))
        })
      }
      const handleMouseUp = () => {
        setDraggingLayersWindow(false)
        setLayersWindowDragOffset({ x: 0, y: 0 })
      }
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingLayersWindow, layersWindowDragOffset])

  const handleFiles = files => {
    const fileArray = Array.from(files || []).filter(file => file.type.startsWith('image/'))
    if (!fileArray.length) return

    const mapped = fileArray.map((file, index) => {
      // Використовуємо ім'я файлу як ім'я шару
      const fileName = file.name.replace(/\.[^/.]+$/, '') // Прибираємо розширення
      const originalName = fileName || `image-${Date.now()}-${index}`
      
      // Створюємо чистий ID з імені (прибираємо спецсимволи)
      const cleanId = originalName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || `image-${Date.now()}-${index}`
      
      // Перевіряємо унікальність ID
      let uniqueId = cleanId
      let counter = 1
      while (images.some(img => img.id === uniqueId || img.elementId === uniqueId)) {
        uniqueId = `${cleanId}-${counter}`
        counter++
      }
      
      return {
        id: uniqueId,
        name: originalName, // Ім'я = оригінальне ім'я файлу
        url: URL.createObjectURL(file),
        zIndex: images.length + index,
        x: 0,
        y: 0,
        width: null,
        height: null,
        elementId: uniqueId, // ID для GSAP = очищене ім'я
        className: '',
        trackingId: uniqueId,
        size: file.size, // Розмір файлу в байтах
        opacity: 1, // Прозорість від 0 до 1
        rotation: 0 // Поворот у градусах від 0 до 360
      }
    })

    setImages(prev => [...prev, ...mapped].map((img, idx) => ({ ...img, zIndex: idx })))
    setIsSaved(false) // Позначаємо проєкт як незбережений при додаванні зображень
  }

  const handleAddText = () => {
    const textId = `text-${Date.now()}`
    const newText = {
      id: textId,
      name: 'Text',
      type: 'text',
      text: 'New text',
      url: null, // Для тексту URL не потрібен
      zIndex: images.length,
      x: 100,
      y: 100,
      width: 200,
      height: null,
      elementId: textId,
      className: '',
      trackingId: textId,
      size: 0,
      opacity: 1,
      rotation: 0,
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000',
      fontWeight: 'normal',
      textAlign: 'left'
    }
    setImages(prev => [...prev, newText].map((img, idx) => ({ ...img, zIndex: idx })))
    setSelectedImageId(textId)
    setIsSaved(false) // Позначаємо проєкт як незбережений при додаванні тексту
  }

  const moveLayer = (fromZIndex, toZIndex) => {
    if (fromZIndex === toZIndex) return
    
    const sortedImages = [...images].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    const fromIndex = sortedImages.findIndex(img => img.zIndex === fromZIndex)
    const toIndex = sortedImages.findIndex(img => img.zIndex === toZIndex)
    
    if (fromIndex === -1 || toIndex === -1) return
    
    const [moved] = sortedImages.splice(fromIndex, 1)
    sortedImages.splice(toIndex, 0, moved)
    
    // Оновлюємо z-index для всіх зображень (зворотний порядок - верхній шар має більший z-index)
    const updatedImages = sortedImages.map((img, idx) => ({ 
      ...img, 
      zIndex: sortedImages.length - 1 - idx 
    }))
    
    setImages(updatedImages)
  }

  const handleLayerDragStart = (e, zIndex) => {
    setDraggedLayerIndex(zIndex)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleLayerDragOver = (e, zIndex) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedLayerIndex === null || draggedLayerIndex === zIndex) return
    
    moveLayer(draggedLayerIndex, zIndex)
    setDraggedLayerIndex(zIndex)
  }

  const handleLayerDragEnd = () => {
    setDraggedLayerIndex(null)
  }

  const handleDrop = event => {
    event.preventDefault()
    handleFiles(event.dataTransfer.files)
  }

  const handleDragOver = event => {
    event.preventDefault()
  }

  const handleFileInputChange = event => {
    handleFiles(event.target.files)
  }

  const resetTimeline = () => {
    if (timelineRef.current && timelineRef.current.kill) {
      timelineRef.current.kill()
      timelineRef.current = null
    }
  }

  // Скидаємо тільки анімаційні GSAP властивості елементів на сцені, зберігаючи розміри, позиції, opacity і rotation
  const resetSceneElements = () => {
    if (previewRef.current) {
      const elements = previewRef.current.querySelectorAll('[data-image-index]')
      elements.forEach((element) => {
        const dataIndex = element.getAttribute('data-image-index')
        if (dataIndex !== null) {
          const index = parseInt(dataIndex, 10)
          const image = images[index]
          
          if (image) {
            // Вбиваємо всі активні твіни для цього елемента
            gsap.killTweensOf(element)
            
            // Зберігаємо поточні значення зі state перед скиданням
            const savedWidth = image.width ? `${image.width}px` : 'auto'
            const savedHeight = image.height ? `${image.height}px` : 'auto'
            const savedOpacity = image.opacity !== undefined ? image.opacity : 1
            const savedRotation = image.rotation || 0
            
            // Скидаємо тільки анімаційні властивості GSAP, НЕ чіпаючи width, height, opacity і rotation
            // Використовуємо clearProps з конкретними властивостями, виключаючи користувацькі налаштування
            gsap.set(element, { 
              clearProps: 'scale,x,y,z,rotationX,rotationY,rotationZ,skewX,skewY'
            })
            
            // Примусово відновлюємо розміри, opacity і rotation зі state після скидання
            // Використовуємо setTimeout щоб переконатись, що clearProps виконався
            setTimeout(() => {
              element.style.width = savedWidth
              element.style.height = savedHeight
              element.style.opacity = savedOpacity
              element.style.transform = savedRotation ? `rotate(${savedRotation}deg)` : 'none'
              element.style.transformOrigin = 'center center'
              
              // Також відновлюємо позицію wrapper
              const wrapper = element.parentElement
              if (wrapper && wrapper.classList.contains('canvas-image-wrapper')) {
                wrapper.style.left = `${image.x || 0}px`
                wrapper.style.top = `${image.y || 0}px`
              }
            }, 0)
          } else {
            // Якщо не знайшли image, просто вбиваємо твіни і скидаємо анімаційні властивості
            gsap.killTweensOf(element)
            gsap.set(element, { 
              clearProps: 'scale,x,y,z,rotationX,rotationY,rotationZ'
            })
          }
        }
      })
    }
  }

  const compileCode = (playOnScene = false) => {
    setError('')

    // Якщо не потрібно програвати на сцені, просто валідуємо синтаксис без створення timeline
    if (!playOnScene) {
      try {
        // Перевіряємо тільки синтаксис коду, не створюючи timeline
        // Це запобігає застосуванню GSAP анімації до елементів на сцені
        const wrapperBody = `
          const timeline = gsap.timeline({ paused: true })
          timeline${code}
          return timeline
        `
        
        // Просто перевіряємо, що функція може бути створена (синтаксис правильний)
        // Але НЕ викликаємо її, щоб не застосовувати анімацію до елементів
        new Function('gsap', 'images', 'container', wrapperBody)
        
        // Перевіряємо наявність елементів на сцені (тільки для інформації)
        if (previewRef.current) {
          const elements = previewRef.current.querySelectorAll('[data-image-index]')
          if (elements.length === 0 && images.length > 0) {
            setError('Images are not yet loaded in DOM. Try again after loading.')
            setCompiled(false)
            return
          }
        }
        
        setCompiled(true)
      } catch (err) {
        console.error(err)
        setError(err.message)
        setCompiled(false)
      }
      return
    }
    
    // Якщо потрібно програвати на сцені, створюємо і застосовуємо timeline
    resetTimeline()

    try {
      const wrapperBody = `
        const timeline = gsap.timeline()
        timeline${code}
        return timeline
      `
      
      const factory = new Function('gsap', 'images', 'container', wrapperBody)
      const timeline = factory(gsap, images, previewRef.current)
      
      // Перевіряємо наявність елементів перед застосуванням анімації
      if (previewRef.current) {
        const elements = previewRef.current.querySelectorAll('[data-image-index]')
        if (elements.length === 0 && images.length > 0) {
          setError('Зображення ще не завантажені в DOM. Спробуйте знову після завантаження.')
          setCompiled(false)
          return
        }
      }
      
      timelineRef.current = timeline
      setCompiled(true)
    } catch (err) {
      console.error(err)
      setError(err.message)
      setCompiled(false)
    }
  }

  const handlePreview = () => {
    if (!compiled) {
      compileCode()
      return
    }

    if (timelineRef.current && timelineRef.current.restart) {
      timelineRef.current.restart()
    }
  }

  const getProfileForWorkflow = async () => {
    try {
      if (!user || !activeWorkspace?.workspaceId) {
        return null
      }

      if (workflowProfile?.id === user.id && workflowProfile?.workspaceId === activeWorkspace.workspaceId) {
        return workflowProfile
      }

      const profile = await getCurrentWorkspaceProfile(activeWorkspace.workspaceId)
      const resolvedProfile = profile || {
        id: user.id,
        role: 'user',
        workspace_role: 'member',
        workspace_type: activeWorkspace.workspaceType,
        team_role: 'developer',
        email: user.email,
        workspaceId: activeWorkspace.workspaceId
      }

      setWorkflowProfile({
        ...resolvedProfile,
        workspaceId: activeWorkspace.workspaceId
      })
      return resolvedProfile
    } catch (error) {
      console.error('Error loading workflow profile:', error)
      return user
        ? {
            id: user.id,
            role: 'user',
            workspace_role: 'member',
            workspace_type: activeWorkspace?.workspaceType,
            team_role: 'developer',
            email: user.email,
            workspaceId: activeWorkspace?.workspaceId || null
          }
        : null
    }
  }

  const ensureProjectManagementAccess = async (project, action = 'edit', nextStatus = null) => {
    try {
      if (!project) {
        alert('Project not found.')
        return false
      }

      const profile = await getProfileForWorkflow()
      if (!profile) {
        alert('Sign in to manage projects.')
        return false
      }

      if (action === 'delete') {
        if (!canDeleteProjectByWorkflow(project, profile)) {
          alert(getProjectAccessMessage(project, profile, 'delete'))
          return false
        }

        return true
      }

      if (action === 'status') {
        if (!canChangeProjectStatus(project, nextStatus, profile)) {
          alert(getProjectAccessMessage(project, profile, 'status'))
          return false
        }

        return true
      }

      if (!canManageProject(project, profile)) {
        alert(getProjectAccessMessage(project, profile, action))
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking project permissions:', error)
      alert('Failed to verify project permissions. Please try again.')
      return false
    }
  }

  const syncProjectState = (nextProject) => {
    setProjects(prevProjects => {
      const hasProject = prevProjects.some(project => project.id === nextProject.id)

      if (!hasProject) {
        return [...prevProjects, nextProject]
      }

      return prevProjects.map(project => (project.id === nextProject.id ? nextProject : project))
    })

    setCurrentProject(prevProject => (
      prevProject?.id === nextProject.id ? nextProject : prevProject
    ))
  }

  const handleClearImages = () => {
    images.forEach(image => URL.revokeObjectURL(image.url))
    setImages([])
    resetTimeline()
    setCompiled(false)
  }

  const handleCreateProject = async (openStudio = false) => {
    if (!projectName.trim() || !projectStatus || !projectFormat) {
      return false
    }
    
    if (isGuest) {
      alert('Гості не можуть створювати проєкти')
      return false
    }

    try {
      const profile = await getProfileForWorkflow()
      if (!canCreateProjects(profile)) {
        alert('Only team leads and developers can create projects.')
        return false
      }

      const isArchivedProject = false
      const resolvedProjectStatus = DEFAULT_PROJECT_STATUS

      const projectData = {
        name: projectName,
        status: resolvedProjectStatus,
        format: projectFormat,
        screenFormat: projectScreenFormat,
        images: [],
        code: DEFAULT_CODE,
        cssCode: '',
        sceneBackground: '#ffffff',
        sceneBorderStyle: 'none',
        sceneBorderColor: '#000000',
        developerId: projectDeveloperId || null,
        qaId: projectQaId || null,
        isArchived: isArchivedProject,
        archivedAt: isArchivedProject ? new Date().toISOString() : null,
        archivedBy: isArchivedProject ? user?.id || null : null
      }

      if (!activeWorkspace?.workspaceId) {
        throw new Error('Select a workspace before creating a project.')
      }

      const dbProject = await createProject(projectData, activeWorkspace.workspaceId)
      const newProject = transformProjectFromDB(dbProject)
      
      setProjects(prev => [...prev, newProject])
      setProjectName('')
      setProjectStatus(DEFAULT_PROJECT_STATUS)
      setProjectFormat('Banner')
      setProjectScreenFormat('landscape')
      setProjectDeveloperId('')
      setProjectQaId('')
      
      if (openStudio) {
        setCurrentProject(newProject)
        navigateToView('editor', { projectId: newProject.id })
        // Очищаємо дані при створенні нового проєкту
        setImages([])
        setCode(DEFAULT_CODE)
        setCssCode('')
        setSceneBackground('#ffffff')
        setSceneBorderStyle('none')
        setSceneBorderColor('#000000')
        setScreenFormat(projectScreenFormat) // Встановлюємо формат з проєкту
        setIsSaved(true) // Новий проєкт вважається збереженим (порожній проєкт)
      }
      
      return true
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project: ' + error.message)
      return false
    }
  }

  const handleRenameLayer = (layerId, newName) => {
    if (!newName.trim()) return
    const trimmedName = newName.trim()
    // Очищаємо ім'я для використання як ID (прибираємо спецсимволи)
    const cleanId = trimmedName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || trimmedName
    
    // Перевіряємо унікальність нового ID
    let uniqueId = cleanId
    let counter = 1
    const currentImages = images.filter(img => img.id !== layerId)
    while (currentImages.some(img => img.id === uniqueId || img.elementId === uniqueId)) {
      uniqueId = `${cleanId}-${counter}`
      counter++
    }
    
    setImages(prev => prev.map(img => {
      if (img.id === layerId) {
        const updated = { ...img, name: trimmedName, id: uniqueId, elementId: uniqueId, trackingId: uniqueId }
        // Оновлюємо ID елемента в DOM
        setTimeout(() => {
          if (previewRef.current) {
            const element = previewRef.current.querySelector(`[data-image-index="${prev.indexOf(img)}"]`)
            if (element) {
              element.id = uniqueId
            }
          }
        }, 0)
        setIsSaved(false) // Позначаємо проєкт як незбережений при перейменуванні шару
        return updated
      }
      return img
    }))
    setEditingLayerId(null)
    
    // Оновлюємо selectedImageId якщо перейменували вибраний елемент
    if (selectedImageId === layerId) {
      setSelectedImageId(uniqueId)
    }
  }

  const handleUpdateImageProperty = (imageId, property, value) => {
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updated = { ...img, [property]: value }
        // Якщо оновлюється elementId, оновлюємо також trackingId і ID в DOM
        if (property === 'elementId') {
          updated.trackingId = value
          // Оновлюємо ID елемента в DOM (для зображень і тексту)
          setTimeout(() => {
            if (previewRef.current) {
              const element = previewRef.current.querySelector(`[id="${img.elementId || img.id}"]`)
              if (element) {
                element.id = value
              }
            }
          }, 0)
        }
        // Якщо оновлюємо текст, знімаємо режим редагування
        if (property === 'text' && editingTextId === imageId) {
          setEditingTextId(null)
        }
        setIsSaved(false) // Позначаємо проєкт як незбережений при зміні властивостей
        return updated
      }
      return img
    }))
  }

  const handleDeleteLayer = (layerId) => {
    if (window.confirm('Delete this layer?')) {
      const image = images.find(img => img.id === layerId)
      if (image) {
        URL.revokeObjectURL(image.url)
      }
      setImages(prev => prev.filter(img => img.id !== layerId))
      if (selectedImageId === layerId) {
        setSelectedImageId(null)
      }
    }
  }

  const handleLayersWindowDragStart = (e) => {
    if (e.target.closest('.layers-window-close') || e.target.closest('.layers-window-filter') || e.target.closest('.layers-window-item')) {
      return
    }
    setDraggingLayersWindow(true)
    const rect = e.currentTarget.closest('.layers-window').getBoundingClientRect()
    setLayersWindowDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    e.preventDefault()
  }

  const handleImageDragStart = (e, imageId) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedImageId(imageId)
    setDraggingImageId(imageId)
    const image = images.find(img => img.id === imageId)
    if (image && previewRef.current) {
      const canvasRect = previewRef.current.getBoundingClientRect()
      const imageRect = e.currentTarget.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - canvasRect.left - (image.x || 0),
        y: e.clientY - canvasRect.top - (image.y || 0)
      })
    }
  }

  const handleImageDrag = (e) => {
    if (!draggingImageId || !previewRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    const canvasRect = previewRef.current.getBoundingClientRect()
    const canvasDimensions = screenFormat === 'portrait' 
      ? { width: 390, height: 884 }
      : { width: 1024, height: 600 }
    const newX = Math.max(0, Math.min(canvasDimensions.width, e.clientX - canvasRect.left - dragOffset.x))
    const newY = Math.max(0, Math.min(canvasDimensions.height, e.clientY - canvasRect.top - dragOffset.y))
    
    setImages(prev => prev.map(img => 
      img.id === draggingImageId ? { ...img, x: newX, y: newY } : img
    ))
    setIsSaved(false) // Позначаємо проєкт як незбережений при переміщенні елементів
  }

  const handleImageDragEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingImageId(null)
    setDragOffset({ x: 0, y: 0 })
  }

  const handleScaleImage = (scale) => {
    if (!selectedImageId) return
    
    const image = images.find(img => img.id === selectedImageId)
    if (!image) return
    
    const img = new Image()
    img.src = image.url
    img.onload = () => {
      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight
      
      // Якщо розміри не задані, використовуємо природні розміри
      const currentWidth = image.width || naturalWidth
      const currentHeight = image.height || naturalHeight
      
      const newWidth = Math.max(10, Math.round(currentWidth * scale))
      const newHeight = Math.max(10, Math.round(currentHeight * scale))
      
      setImages(prev => prev.map(img => 
        img.id === selectedImageId ? { 
          ...img, 
          width: newWidth, 
          height: newHeight 
        } : img
      ))
    }
    img.onerror = () => {
      // Якщо зображення не завантажилось, використовуємо поточні розміри
      const currentWidth = image.width || 100
      const currentHeight = image.height || 100
      
      const newWidth = Math.max(10, Math.round(currentWidth * scale))
      const newHeight = Math.max(10, Math.round(currentHeight * scale))
      
      setImages(prev => prev.map(img => 
        img.id === selectedImageId ? { 
          ...img, 
          width: newWidth, 
          height: newHeight 
        } : img
      ))
    }
  }

  const handleResizeStart = (e, imageId, handle) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingImageId(imageId)
    setResizeHandle(handle)
    
    const image = images.find(img => img.id === imageId)
    if (image) {
      const rect = e.currentTarget.getBoundingClientRect()
      const canvasRect = previewRef.current?.getBoundingClientRect()
      if (canvasRect) {
        setResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: image.width || rect.width,
          height: image.height || rect.height,
          startX: image.x || 0,
          startY: image.y || 0
        })
      }
    }
  }

  const handleResize = (e) => {
    if (!resizingImageId || !resizeHandle || !previewRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const canvasRect = previewRef.current.getBoundingClientRect()
    const deltaX = (e.clientX - resizeStart.x) / (window.devicePixelRatio || 1)
    const deltaY = (e.clientY - resizeStart.y) / (window.devicePixelRatio || 1)
    
    const image = images.find(img => img.id === resizingImageId)
    if (!image) return
    
    let newWidth = resizeStart.width
    let newHeight = resizeStart.height
    let newX = resizeStart.startX
    let newY = resizeStart.startY
    
    // Обробка зміни розміру по горизонталі
    if (resizeHandle.includes('e')) {
      newWidth = Math.max(10, resizeStart.width + deltaX)
    }
    if (resizeHandle.includes('w')) {
      const oldWidth = resizeStart.width
      newWidth = Math.max(10, resizeStart.width - deltaX)
      newX = resizeStart.startX + (oldWidth - newWidth)
    }
    
    // Обробка зміни розміру по вертикалі
    if (resizeHandle.includes('s')) {
      newHeight = Math.max(10, resizeStart.height + deltaY)
    }
    if (resizeHandle.includes('n')) {
      const oldHeight = resizeStart.height
      newHeight = Math.max(10, resizeStart.height - deltaY)
      newY = resizeStart.startY + (oldHeight - newHeight)
    }
    
    // Обмежуємо позицію межами канваса
    const canvasDimensions = screenFormat === 'portrait' 
      ? { width: 390, height: 884 }
      : { width: 1024, height: 600 }
    newX = Math.max(0, Math.min(canvasDimensions.width - newWidth, newX))
    newY = Math.max(0, Math.min(canvasDimensions.height - newHeight, newY))
    
    setImages(prev => prev.map(img => 
      img.id === resizingImageId ? { 
        ...img, 
        width: Math.round(newWidth), 
        height: Math.round(newHeight),
        x: Math.round(newX),
        y: Math.round(newY)
      } : img
    ))
    setIsSaved(false) // Позначаємо проєкт як незбережений при зміні розміру елементів
  }

  const handleResizeEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingImageId(null)
    setResizeHandle(null)
  }

  const handleSave = async () => {
    if (!currentProject) return false
    
    if (isGuest) {
      alert('Гості не можуть зберігати проєкти')
      return false
    }

    const hasProjectAccess = await ensureProjectManagementAccess(currentProject, 'edit')
    if (!hasProjectAccess) {
      return false
    }

    try {
      // Конвертуємо blob URLs в base64 перед збереженням
      const imagesWithBase64 = await Promise.all(
        images.map(async (img) => {
          if (img.type === 'text') {
            // Текстові елементи не потребують конвертації
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation,
              text: img.text,
              fontSize: img.fontSize,
              fontFamily: img.fontFamily,
              color: img.color,
              fontWeight: img.fontWeight,
              textAlign: img.textAlign
            }
          }
          
          // Якщо вже є base64, використовуємо його
          if (img.base64) {
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: img.base64, // Зберігаємо base64 як url для зворотної сумісності
              base64: img.base64,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          }
          
          // Конвертуємо blob URL в base64
          try {
            const base64 = await blobToBase64(img.url)
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: base64, // Зберігаємо base64 як url
              base64: base64,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          } catch (err) {
            console.error('Error converting image to base64:', err)
            // Якщо не вдалося конвертувати, зберігаємо як є
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: img.url,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          }
        })
      )

      // Зберігаємо дані проєкту
      const updatedProject = {
        ...currentProject,
        images: imagesWithBase64,
        code: code,
        cssCode: cssCode,
        sceneBackground: sceneBackground,
        sceneBorderStyle: sceneBorderStyle,
        sceneBorderColor: sceneBorderColor,
        screenFormat: screenFormat,
        updatedAt: new Date().toISOString()
      }

      // Зберігаємо в БД
      const dbProject = await updateProject(currentProject.id, updatedProject)
      const transformedProject = transformProjectFromDB(dbProject)
      
      syncProjectState(transformedProject)
      setIsSaved(true) // Позначаємо проєкт як збережений
      setShowDocumentMenu(false)
      return true
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Failed to save project: ' + error.message)
      return false
    }
  }

  const handleSaveAndQuit = async () => {
    const saveSucceeded = await handleSave()
    if (saveSucceeded) {
      navigateToView('projects')
      return true
    }
    return false
  }

  const handleProjectWorkflowAction = async (projectId, action, payload = {}) => {
    try {
      if (!projectId) {
        alert('Project not found.')
        return false
      }

      if (isGuest) {
        alert('Sign in to manage project workflow.')
        return false
      }

      const project = currentProject?.id === projectId
        ? currentProject
        : projects.find(item => item.id === projectId)

      if (!project) {
        alert('Project not found.')
        return false
      }

      const profile = await getProfileForWorkflow()
      if (!profile) {
        alert('Sign in to manage project workflow.')
        return false
      }

      const isCurrentProject = currentProject?.id === projectId
      if (isCurrentProject && !isSaved) {
        alert('Save the project before changing the workflow stage.')
        return false
      }

      let updates = null
      const trimmedNote = typeof payload.note === 'string' ? payload.note.trim() : ''
      const nextTargetStatus = payload.targetStatus

      switch (action) {
        case 'send_to_qa': {
          if (!canSendProjectToQa(project, profile, { isSaved: !isCurrentProject || isSaved })) {
            alert('Only the assigned developer or team lead can send this project to QA after a QA has been assigned.')
            return false
          }

          updates = {
            status: 'qa',
            qaHandoffNote: trimmedNote || null,
            qaFeedbackNote: null,
            isArchived: false,
            archivedAt: null,
            archivedBy: null
          }
          break
        }

        case 'return_to_development': {
          if (!canReturnProjectToDevelopment(project, profile)) {
            alert('Only the assigned QA or team lead can return this project to Development.')
            return false
          }

          if (!trimmedNote) {
            alert('Feedback is required before returning the project to Development.')
            return false
          }

          updates = {
            status: 'development',
            qaFeedbackNote: trimmedNote,
            isArchived: false,
            archivedAt: null,
            archivedBy: null
          }
          break
        }

        case 'approve_to_production': {
          if (!canApproveProjectToProduction(project, profile)) {
            alert('Only the assigned QA or team lead can approve this project for Production.')
            return false
          }

          updates = {
            status: 'production',
            isArchived: false,
            archivedAt: null,
            archivedBy: null
          }
          break
        }

        case 'reopen_from_production': {
          if (!canReopenProjectFromProduction(project, profile)) {
            alert('Only the team lead can reopen a production project.')
            return false
          }

          if (!['development', 'qa'].includes(nextTargetStatus)) {
            alert('Choose whether to reopen the project in Development or QA.')
            return false
          }

          if (nextTargetStatus === 'qa' && !getProjectQaId(project)) {
            alert('Assign a QA before reopening the project directly to QA.')
            return false
          }

          updates = {
            status: nextTargetStatus,
            isArchived: false,
            archivedAt: null,
            archivedBy: null
          }
          break
        }

        case 'archive_project': {
          if (!canArchiveProject(project, profile)) {
            alert('Only the team lead can archive a project from Production.')
            return false
          }

          updates = {
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedBy: profile.id
          }
          break
        }

        case 'unarchive_project': {
          if (!canUnarchiveProject(project, profile)) {
            alert('Only the team lead can restore an archived project.')
            return false
          }

          updates = {
            isArchived: false,
            archivedAt: null,
            archivedBy: null
          }
          break
        }

        default:
          alert('Unknown workflow action.')
          return false
      }

      setIsWorkflowActionLoading(true)
      const dbProject = await updateProject(projectId, updates)
      const transformedProject = transformProjectFromDB(dbProject)
      syncProjectState(transformedProject)
      return true
    } catch (error) {
      console.error('Error applying project workflow action:', error)
      alert(`Failed to update the project workflow: ${error.message}`)
      return false
    } finally {
      setIsWorkflowActionLoading(false)
    }
  }

  const resetUnsavedEditorState = () => {
    setImages([])
    setCode(DEFAULT_CODE)
    setCssCode('')
    setSceneBackground('#ffffff')
    setSceneBorderStyle('none')
    setSceneBorderColor('#000000')
    setScreenFormat('landscape')
    setSelectedImageId(null)
    setEditingTextId(null)
    setEditingLayerId(null)
    setDraggingImageId(null)
    setDraggedLayerIndex(null)
    setResizingImageId(null)
    setResizeHandle(null)
    setShowDocumentMenu(false)
    setShowJSEditor(false)
    setShowCSSEditor(false)
    setShowAddMenu(false)
    setShowLayersModal(false)
    resetTimeline()
    setCompiled(false)
    setError('')
    setIsSaved(true)
  }

  const handleEditorBack = () => {
    try {
      if (!isSaved) {
        setShowUnsavedChangesModal(true)
        return
      }

      navigateToView('projects')
    } catch (error) {
      console.error('Error opening unsaved changes modal:', error)
      alert('Failed to open the exit confirmation dialog. Please try again.')
    }
  }

  const handleCloseUnsavedChangesModal = () => {
    try {
      if (isLeavingEditor) {
        return
      }

      setShowUnsavedChangesModal(false)
    } catch (error) {
      console.error('Error closing unsaved changes modal:', error)
      alert('Failed to close the exit confirmation dialog. Please try again.')
    }
  }

  const handleDiscardAndLeaveEditor = () => {
    try {
      if (isLeavingEditor) {
        return
      }

      resetUnsavedEditorState()
      setShowUnsavedChangesModal(false)
      navigateToView('projects')
    } catch (error) {
      console.error('Error discarding unsaved changes:', error)
      alert('Failed to discard unsaved changes. Please try again.')
    }
  }

  const handleSaveAndLeaveFromModal = async () => {
    if (isLeavingEditor) {
      return
    }

    try {
      setIsLeavingEditor(true)
      const didLeave = await handleSaveAndQuit()
      if (didLeave) {
        setShowUnsavedChangesModal(false)
      }
    } catch (error) {
      console.error('Error saving changes before leaving editor:', error)
      alert('Failed to save your changes before leaving the editor.')
    } finally {
      setIsLeavingEditor(false)
    }
  }

  // Обробка гарячих клавіш
  useEffect(() => {
    // Працюємо тільки в редакторі
    if (view !== 'editor' || !currentProject) return

    const handleKeyDown = (e) => {
      // Перевіряємо, що користувач не знаходиться в полі вводу
      const target = e.target
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable ||
                      target.closest('.code-editor-hidden') ||
                      target.closest('.css-editor') ||
                      target.closest('.js-editor')
      
      if (isInput) return

      // Перевіряємо модифікатори (⌘ на Mac = metaKey, Ctrl на Windows/Linux = ctrlKey)
      const isModifierPressed = e.metaKey || e.ctrlKey
      const isShiftPressed = e.shiftKey

      if (!isModifierPressed) return

      const key = e.key.toLowerCase()

      // ⌘P или Ctrl+P - Landscape Preview
      if (key === 'p' && !isShiftPressed && screenFormat === 'landscape') {
        e.preventDefault()
        handleLandscapePreview()
        return
      }

      // ⌘⇧P или Ctrl+Shift+P - Portrait Preview
      if (key === 'p' && isShiftPressed && screenFormat === 'portrait') {
        e.preventDefault()
        handlePortraitPreview()
        return
      }

      // ⌘E или Ctrl+E - Export
      if (key === 'e' && !isShiftPressed) {
        e.preventDefault()
        handleExport()
        return
      }

      // ⌘S или Ctrl+S - Save
      if (key === 's' && !isShiftPressed) {
        e.preventDefault()
        handleSave()
        return
      }

      // ⌘⇧Enter или Ctrl+Shift+Enter - Save and Quit
      if (e.key === 'Enter' && isShiftPressed && isModifierPressed) {
        e.preventDefault()
        handleSaveAndQuit()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [view, currentProject, screenFormat])

  // Функція для конвертації blob URL в base64
  const blobToBase64 = (blobUrlOrBlob) => {
    return new Promise((resolve, reject) => {
      // Якщо це вже Blob об'єкт, використовуємо його напрямую
      if (blobUrlOrBlob instanceof Blob) {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blobUrlOrBlob)
      } else {
        // Якщо це URL рядок, завантажуємо через fetch
        fetch(blobUrlOrBlob)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          .catch(reject)
      }
    })
  }

  // Функция для генерации HTML контента
  const generateHTMLContent = (imagesWithBase64) => {
    const canvasWidth = screenFormat === 'portrait' ? 390 : 1024
    const canvasHeight = screenFormat === 'portrait' ? 884 : 600
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>${currentProject?.name || 'Creative'}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    body {
      background: #1a1a1a;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-wrapper {
      width: 100vw;
      height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-container {
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      background-color: ${sceneBackground};
      border: ${sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none'};
      position: relative;
      overflow: hidden;
      transform-origin: center center;
    }
    .preview-image {
      position: absolute;
      object-fit: contain;
      display: block;
      max-width: ${canvasWidth}px;
      max-height: ${canvasHeight}px;
    }
    .preview-text {
      position: absolute;
      display: block;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    ${cssCode ? `/* Custom CSS */\n${cssCode}` : ''}
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div class="preview-container" id="preview-canvas">
      ${imagesWithBase64.map((image, index) => {
        if (image.type === 'text') {
          return `
            <div 
              id="${image.elementId || image.id}"
              class="preview-text"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                width: ${image.width ? image.width + 'px' : 'auto'};
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
                font-size: ${image.fontSize || 16}px;
                font-family: ${image.fontFamily || 'Arial'};
                color: ${image.color || '#000000'};
                font-weight: ${image.fontWeight || 'normal'};
                text-align: ${image.textAlign || 'left'};
              "
            >${image.text || 'New text'}</div>
          `
        } else {
          return `
            <img 
              id="${image.elementId || image.id}"
              src="${image.base64}" 
              alt="${image.name}"
              class="preview-image"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                object-fit: contain;
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            />
          `
        }
      }).join('')}
          </div>
  </div>
  <script>
    const code = ${JSON.stringify(code)};
    const container = document.getElementById('preview-canvas');
    
    function updateScale() {
      const container = document.querySelector('.preview-container');
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const canvasWidth = ${canvasWidth};
      const canvasHeight = ${canvasHeight};
      
      const scaleX = windowWidth / canvasWidth;
      const scaleY = windowHeight / canvasHeight;
      const scale = Math.min(scaleX, scaleY);
      
      container.style.width = canvasWidth + 'px';
      container.style.height = canvasHeight + 'px';
      container.style.transform = 'scale(' + scale + ')';
      container.style.transformOrigin = 'center center';
    }
    
    window.addEventListener('resize', updateScale);
    updateScale();
    
    setTimeout(() => {
      try {
        const images = container.querySelectorAll('img');
        let loadedCount = 0;
        const totalImages = images.length;
        
        if (totalImages === 0) {
          console.warn('No images found');
          return;
        }
        
        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            const wrapperBody = \`
              const timeline = gsap.timeline()
              timeline\${code}
              return timeline
            \`;
            
            try {
              const factory = new Function('gsap', 'images', 'container', wrapperBody);
              const timeline = factory(gsap, [], container);
              if (timeline && typeof timeline.play === 'function') {
                timeline.play();
              } else {
                console.error('Timeline creation failed:', timeline);
              }
            } catch (err) {
              console.error('Animation error:', err);
            }
          }
        };
        
        images.forEach((img) => {
          if (img.complete) {
            checkAllLoaded();
          } else {
            img.addEventListener('load', checkAllLoaded);
            img.addEventListener('error', checkAllLoaded);
          }
        });
      } catch (err) {
        console.error('Animation error:', err);
      }
    }, 200);
  </script>
</body>
</html>`
  }

  const handleExport = async () => {
    if (images.length === 0) {
      setStudioNoticeModal({
        title: 'Nothing to export yet',
        message: 'Add an image or text layer before exporting this creative.',
        tone: 'warning'
      })
      setShowDocumentMenu(false)
      return
    }

    try {
      // Конвертуємо зображення в base64 (текстові елементи пропускаємо)
      const imagesWithBase64 = await Promise.all(
        images.map(async (img) => {
          if (img.type === 'text') {
            return img // Текстові елементи не потребують конвертації
          }
          const base64 = await blobToBase64(img.url)
          return {
            ...img,
            base64: base64
          }
        })
      )

      // Експорт як HTML файл
      const htmlContent = generateHTMLContent(imagesWithBase64)
      
      // Створюємо blob і завантажуємо файл
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentProject?.name || 'creative'}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setShowDocumentMenu(false)
    } catch (error) {
      console.error('Помилка експорту:', error)
      setStudioNoticeModal({
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Unable to export this creative. Please try again.',
        tone: 'danger'
      })
    }
  }

  // Загальна функція для створення превью
  const createPreview = (format) => {
    // Вбиваємо timeline на сцені і скидаємо всі GSAP властивості елементів
    resetTimeline()
    resetSceneElements()
    
    // Компілюємо код якщо потрібно (тільки для валідації, не застосовуємо на сцені)
    if (!compiled) {
      compileCode(false) // Не застосовуємо анімацію на сцені
    }
    
    if (images.length === 0) {
      setStudioNoticeModal({
        title: 'Nothing to preview yet',
        message: 'Add an image or text layer before opening the preview.',
        tone: 'warning'
      })
      setShowDocumentMenu(false)
      return
    }
    
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    // Обчислюємо коефіцієнт масштабування для елементів
    // Якщо формат превью відрізняється від формату проєкту, масштабуємо елементи
    const sourceCanvasWidth = screenFormat === 'portrait' ? 390 : 1024
    const sourceCanvasHeight = screenFormat === 'portrait' ? 884 : 600
    
      // Обчислюємо коефіцієнт масштабування по ширині (основний параметр)
    const scale = canvasWidth / sourceCanvasWidth
    
    const previewWindow = window.open('', '_blank', 'fullscreen=yes')
    if (previewWindow) {
      const imagesData = images.map((img, idx) => ({
        url: img.base64 || img.url, // Використовуємо base64 якщо є, інакше url
        base64: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : null),
        name: img.name,
        id: img.id,
        type: img.type,
        elementId: img.elementId || img.id,
        zIndex: img.zIndex || idx,
        x: (img.x || 0) * scale,
        y: (img.y || 0) * scale,
        width: img.width ? img.width * scale : null,
        height: img.height ? img.height * scale : null,
        opacity: img.opacity !== undefined ? img.opacity : 1,
        rotation: img.rotation || 0,
        text: img.text,
        fontSize: img.fontSize ? img.fontSize * scale : 16,
        fontFamily: img.fontFamily,
        color: img.color,
        fontWeight: img.fontWeight,
        textAlign: img.textAlign
      }))
      
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview ${isPortrait ? 'Portrait' : 'Landscape'} - ${currentProject?.name || 'Creative'}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            body {
              background: #1a1a1a;
              font-family: system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .preview-wrapper {
              width: 100vw;
              height: 100vh;
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .preview-container {
              width: ${canvasWidth}px;
              height: ${canvasHeight}px;
              background-color: ${sceneBackground};
              border: ${sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none'};
              position: relative;
              overflow: hidden;
              transform-origin: center center;
            }
            .preview-image {
              position: absolute;
              object-fit: contain;
              display: block;
              max-width: ${canvasWidth}px;
              max-height: ${canvasHeight}px;
            }
            .preview-text {
              position: absolute;
              display: block;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            ${cssCode ? `/* Custom CSS */\n${cssCode}` : ''}
          </style>
        </head>
        <body>
          <div class="preview-wrapper">
            <div class="preview-container" id="preview-canvas">
              ${imagesData.map((image, index) => {
                if (image.type === 'text') {
                  return `
                    <div 
                      id="${image.elementId || image.id}"
                      class="preview-text"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        width: ${image.width ? image.width + 'px' : 'auto'};
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                        font-size: ${image.fontSize || 16}px;
                        font-family: ${image.fontFamily || 'Arial'};
                        color: ${image.color || '#000000'};
                        font-weight: ${image.fontWeight || 'normal'};
                        text-align: ${image.textAlign || 'left'};
                      "
                    >${image.text || 'New text'}</div>
                  `
                } else {
                  return `
                    <img 
                      id="${image.elementId || image.id}"
                      src="${image.base64 || image.url || ''}" 
                      alt="${image.name}"
                      class="preview-image"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                        ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                        object-fit: contain;
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    />
                  `
                }
              }).join('')}
            </div>
          </div>
          <script>
            const code = ${JSON.stringify(code)};
            const container = document.getElementById('preview-canvas');
            
            function updateScale() {
              const container = document.querySelector('.preview-container');
              const windowWidth = window.innerWidth;
              const windowHeight = window.innerHeight;
              const canvasWidth = ${canvasWidth};
              const canvasHeight = ${canvasHeight};
              
              const scaleX = windowWidth / canvasWidth;
              const scaleY = windowHeight / canvasHeight;
              const scale = Math.min(scaleX, scaleY);
              
              // Устанавливаем точные размеры контейнера
              container.style.width = canvasWidth + 'px';
              container.style.height = canvasHeight + 'px';
              container.style.transform = 'scale(' + scale + ')';
              container.style.transformOrigin = 'center center';
            }
            
            window.addEventListener('resize', updateScale);
            updateScale();
            
            setTimeout(() => {
              try {
                // Ждем загрузки всех элементов (изображения и текст)
                const elements = container.querySelectorAll('.preview-image, .preview-text');
                let loadedCount = 0;
                const totalElements = elements.length;
                
                if (totalElements === 0) {
                  console.warn('No elements found in preview');
                  return;
                }
                
                const checkAllLoaded = () => {
                  loadedCount++;
                  if (loadedCount === totalElements) {
                    // Все элементы загружены, запускаем анимацию
                    const wrapperBody = \`
                      const timeline = gsap.timeline()
                      timeline\${code}
                      return timeline
                    \`;
                    
                    try {
                      const factory = new Function('gsap', 'images', 'container', wrapperBody);
                      const timeline = factory(gsap, [], container);
                      if (timeline && typeof timeline.play === 'function') {
                        timeline.play();
                      } else {
                        console.error('Timeline creation failed:', timeline);
                        alert('Animation creation error. Check console for details.');
                      }
                    } catch (err) {
                      console.error('Animation error:', err);
                      alert('Animation error: ' + err.message);
                    }
                  }
                };
                
                // Проверяем загрузку каждого элемента
                elements.forEach((el) => {
                  if (el.tagName === 'IMG') {
                    if (el.complete) {
                      checkAllLoaded();
                    } else {
                      el.addEventListener('load', checkAllLoaded);
                      el.addEventListener('error', checkAllLoaded);
                    }
                  } else {
                    // Для текстових елементів вважаємо, що вони завжди "завантажені"
                    checkAllLoaded();
                  }
                });
              } catch (err) {
                console.error('Animation error:', err);
                alert('Animation error: ' + err.message);
              }
            }, 200);
          </script>
        </body>
        </html>
      `)
      previewWindow.document.close()
      
      // Спроба відкрити в повноекранному режимі
      if (previewWindow.document.documentElement.requestFullscreen) {
        previewWindow.document.documentElement.requestFullscreen().catch(() => {})
      } else if (previewWindow.document.documentElement.webkitRequestFullscreen) {
        previewWindow.document.documentElement.webkitRequestFullscreen()
      } else if (previewWindow.document.documentElement.msRequestFullscreen) {
        previewWindow.document.documentElement.msRequestFullscreen()
      }
    }
    setShowDocumentMenu(false)
  }

  const handleLandscapePreview = () => {
    createPreview('landscape')
  }

  const handlePortraitPreview = () => {
    createPreview('portrait')
  }

  // Функція для превью проєкту зі списку
  const handleProjectPreview = (project, format) => {
    if (!project.images || project.images.length === 0) {
      setStudioNoticeModal({
        title: 'Nothing to preview yet',
        message: 'This project does not have any layers to preview.',
        tone: 'warning'
      })
      return
    }

    const projectScreenFormat = project.screenFormat || 'landscape'
    const projectCode = project.code || DEFAULT_CODE
    const projectCssCode = project.cssCode || ''
    const projectImages = project.images || []
    
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    const sourceCanvasWidth = projectScreenFormat === 'portrait' ? 390 : 1024
    const sourceCanvasHeight = projectScreenFormat === 'portrait' ? 884 : 600
    const scale = canvasWidth / sourceCanvasWidth
    
    const previewWindow = window.open('', '_blank', 'fullscreen=yes')
    if (previewWindow) {
      const imagesData = projectImages.map((img, idx) => ({
        name: img.name,
        id: img.id,
        type: img.type,
        elementId: img.elementId || img.id,
        zIndex: img.zIndex || idx,
        x: (img.x || 0) * scale,
        y: (img.y || 0) * scale,
        width: img.width ? img.width * scale : null,
        height: img.height ? img.height * scale : null,
        opacity: img.opacity !== undefined ? img.opacity : 1,
        rotation: img.rotation || 0,
        text: img.text,
        fontSize: img.fontSize ? img.fontSize * scale : 16,
        fontFamily: img.fontFamily,
        color: img.color,
        fontWeight: img.fontWeight,
        textAlign: img.textAlign,
        url: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : img.url) || '',
        base64: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : null)
      }))
      
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview ${isPortrait ? 'Portrait' : 'Landscape'} - ${project.name || 'Creative'}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #1a1a1a;
              overflow: hidden;
            }
            .preview-wrapper {
              width: 100vw;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .preview-container {
              width: ${canvasWidth}px;
              height: ${canvasHeight}px;
              position: relative;
              background: ${project.sceneBackground || '#ffffff'};
              border: ${project.sceneBorderStyle === 'solid' ? `1px solid ${project.sceneBorderColor || '#000000'}` : 'none'};
              overflow: hidden;
            }
            .preview-image {
              position: absolute;
              object-fit: contain;
              display: block;
              max-width: ${canvasWidth}px;
              max-height: ${canvasHeight}px;
            }
            .preview-text {
              position: absolute;
              white-space: nowrap;
              user-select: none;
            }
            ${projectCssCode}
          </style>
        </head>
        <body>
          <div class="preview-wrapper">
            <div class="preview-container" id="preview-canvas">
              ${imagesData.map((image, index) => {
                if (image.type === 'text') {
                  return `
                    <div 
                      id="${image.elementId || image.id}"
                      class="preview-text"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        font-size: ${image.fontSize || 16}px;
                        font-family: ${image.fontFamily || 'Arial'};
                        color: ${image.color || '#000000'};
                        font-weight: ${image.fontWeight || 'normal'};
                        text-align: ${image.textAlign || 'left'};
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    >${image.text || ''}</div>
                  `
                } else {
                  return `
                    <img 
                      id="${image.elementId || image.id}"
                      src="${image.url || image.base64 || ''}" 
                      alt="${image.name}"
                      class="preview-image"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                        ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                        object-fit: contain;
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    />
                  `
                }
              }).join('')}
          </div>
          </div>
          <script>
            const code = ${JSON.stringify(projectCode)};
            const canvasWidth = ${canvasWidth};
            const canvasHeight = ${canvasHeight};
            
            function updateScale() {
              const wrapper = document.querySelector('.preview-wrapper');
              const container = document.querySelector('.preview-container');
              if (!wrapper || !container) return;
              
              const scaleX = window.innerWidth / canvasWidth;
              const scaleY = window.innerHeight / canvasHeight;
              const scale = Math.min(scaleX, scaleY);
              
              container.style.transform = \`scale(\${scale})\`;
            }
            
            window.addEventListener('resize', updateScale);
            updateScale();
            
            setTimeout(() => {
              try {
                const elements = document.querySelectorAll('[data-image-index]');
                let loadedCount = 0;
                const totalElements = elements.length;
                
                function checkAllLoaded() {
                  loadedCount++;
                  if (loadedCount >= totalElements) {
                    try {
                      const wrapperBody = \`
                        const timeline = gsap.timeline()
                        timeline\${code}
                        return timeline
                      \`;
                      const factory = new Function('gsap', 'images', 'container', wrapperBody);
                      const timeline = factory(gsap, [], document.getElementById('preview-canvas'));
                      if (timeline && timeline.play) {
                        timeline.play();
                      }
                    } catch (err) {
                      console.error('Animation error:', err);
                      alert('Animation error: ' + err.message);
                    }
                  }
                }
                
                elements.forEach((el) => {
                  if (el.tagName === 'IMG') {
                    if (el.complete) {
                      checkAllLoaded();
                    } else {
                      el.addEventListener('load', checkAllLoaded);
                      el.addEventListener('error', checkAllLoaded);
                    }
                  } else {
                    checkAllLoaded();
                  }
                });
              } catch (err) {
                console.error('Animation error:', err);
                alert('Animation error: ' + err.message);
              }
            }, 200);
          </script>
        </body>
        </html>
      `)
      previewWindow.document.close()
      
      if (previewWindow.document.documentElement.requestFullscreen) {
        previewWindow.document.documentElement.requestFullscreen().catch(() => {})
      } else if (previewWindow.document.documentElement.webkitRequestFullscreen) {
        previewWindow.document.documentElement.webkitRequestFullscreen()
      } else if (previewWindow.document.documentElement.msRequestFullscreen) {
        previewWindow.document.documentElement.msRequestFullscreen()
      }
    }
  }

  // Функція для експорту проєкту зі списку
  const handleProjectExport = async (project) => {
    if (!project.images || project.images.length === 0) {
      setStudioNoticeModal({
        title: 'Nothing to export yet',
        message: 'This project does not have any layers to export.',
        tone: 'warning'
      })
      return
    }

    try {
      const projectScreenFormat = project.screenFormat || 'landscape'
      const canvasWidth = projectScreenFormat === 'portrait' ? 390 : 1024
      const canvasHeight = projectScreenFormat === 'portrait' ? 884 : 600
      
      const imagesWithBase64 = await Promise.all(
        project.images.map(async (img) => {
          if (img.type === 'text') {
            return img
          }
          if (img.base64) {
            return { ...img, base64: img.base64 }
          }
          if (img.url) {
            try {
              const response = await fetch(img.url)
              const blob = await response.blob()
              const base64 = await blobToBase64(blob)
              return { ...img, base64 }
            } catch (err) {
              console.error('Error converting image:', err)
              return img
            }
          }
          return img
        })
      )

      const htmlContent = generateProjectHTMLContent(imagesWithBase64, project, projectScreenFormat)
      
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${project.name || 'creative'}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Помилка експорту:', error)
      setStudioNoticeModal({
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Unable to export this project. Please try again.',
        tone: 'danger'
      })
    }
  }

  // Функція для генерації HTML контенту проєкту
  const generateProjectHTMLContent = (imagesWithBase64, project, format) => {
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    const projectCode = project.code || DEFAULT_CODE
    const projectCssCode = project.cssCode || ''
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name || 'Creative'}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a1a;
      overflow: hidden;
    }
    .preview-wrapper {
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .preview-container {
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      position: relative;
      background: ${project.sceneBackground || '#ffffff'};
      border: ${project.sceneBorderStyle === 'solid' ? `1px solid ${project.sceneBorderColor || '#000000'}` : 'none'};
      overflow: hidden;
    }
    .preview-image {
      position: absolute;
      object-fit: contain;
      display: block;
      max-width: ${canvasWidth}px;
      max-height: ${canvasHeight}px;
    }
    .preview-text {
      position: absolute;
      white-space: nowrap;
      user-select: none;
    }
    ${projectCssCode}
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div class="preview-container" id="preview-canvas">
      ${imagesWithBase64.map((image, index) => {
        if (image.type === 'text') {
          return `
            <div 
              id="${image.elementId || image.id}"
              class="preview-text"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                font-size: ${image.fontSize || 16}px;
                font-family: ${image.fontFamily || 'Arial'};
                color: ${image.color || '#000000'};
                font-weight: ${image.fontWeight || 'normal'};
                text-align: ${image.textAlign || 'left'};
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            >${image.text || ''}</div>
          `
        } else {
          return `
            <img 
              id="${image.elementId || image.id}"
              src="${image.base64 || image.url || ''}" 
              alt="${image.name}"
              class="preview-image"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                object-fit: contain;
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            />
          `
        }
      }).join('')}
            </div>
  </div>
  <script>
    const code = ${JSON.stringify(projectCode)};
    const canvasWidth = ${canvasWidth};
    const canvasHeight = ${canvasHeight};
    
    function updateScale() {
      const wrapper = document.querySelector('.preview-wrapper');
      const container = document.querySelector('.preview-container');
      if (!wrapper || !container) return;
      
      const scaleX = window.innerWidth / canvasWidth;
      const scaleY = window.innerHeight / canvasHeight;
      const scale = Math.min(scaleX, scaleY);
      
      container.style.transform = \`scale(\${scale})\`;
    }
    
    window.addEventListener('resize', updateScale);
    updateScale();
    
    setTimeout(() => {
      try {
        const elements = document.querySelectorAll('[data-image-index]');
        let loadedCount = 0;
        const totalElements = elements.length;
        
        function checkAllLoaded() {
          loadedCount++;
          if (loadedCount >= totalElements) {
            try {
              const wrapperBody = \`
                const timeline = gsap.timeline()
                timeline\${code}
                return timeline
              \`;
              const factory = new Function('gsap', 'images', 'container', wrapperBody);
              const timeline = factory(gsap, [], document.getElementById('preview-canvas'));
              if (timeline && timeline.play) {
                timeline.play();
              }
            } catch (err) {
              console.error('Animation error:', err);
              alert('Ошибка анимации: ' + err.message);
            }
          }
        }
        
        elements.forEach((el) => {
          if (el.tagName === 'IMG') {
            if (el.complete) {
              checkAllLoaded();
            } else {
              el.addEventListener('load', checkAllLoaded);
              el.addEventListener('error', checkAllLoaded);
            }
          } else {
            checkAllLoaded();
          }
        });
      } catch (err) {
        console.error('Animation error:', err);
        alert('Ошибка анимации: ' + err.message);
      }
    }, 200);
  </script>
</body>
</html>`
  }

  const handleEditProject = async (project) => {
    const hasProjectAccess = await ensureProjectManagementAccess(project, 'edit')
    if (!hasProjectAccess) {
      return
    }
    
    setCurrentProject(project)
    // Відновлюємо збережені дані проєкту
    if (project.images) {
      // Відновлюємо зображення з base64 або URL
      const restoredImages = project.images.map(img => {
        if (img.type === 'text') {
          return img // Текстові елементи не потребують відновлення URL
        }
        // Якщо є base64, створюємо blob URL з нього
        if (img.base64) {
          // Конвертуємо base64 в blob URL для відображення
          try {
            const byteCharacters = atob(img.base64.split(',')[1] || img.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'image/png' })
            const blobUrl = URL.createObjectURL(blob)
            return {
              ...img,
              url: blobUrl,
              base64: img.base64 // Зберігаємо base64 для майбутнього збереження
            }
          } catch (err) {
            console.error('Error creating blob URL from base64:', err)
            return img
          }
        }
        // Якщо URL це base64 рядок (починається з data:), використовуємо її напряму
        if (img.url && img.url.startsWith('data:')) {
          return {
            ...img,
            base64: img.url
          }
        }
        // Якщо це звичайний URL, використовуємо його
        return img
      })
      setImages(restoredImages)
    } else {
      setImages([])
    }
    if (project.code) {
      setCode(project.code)
    } else {
      setCode(DEFAULT_CODE)
    }
    if (project.cssCode) {
      setCssCode(project.cssCode)
    } else {
      setCssCode('')
    }
    if (project.sceneBackground) {
      setSceneBackground(project.sceneBackground)
    } else {
      setSceneBackground('#ffffff')
    }
    if (project.sceneBorderStyle) {
      setSceneBorderStyle(project.sceneBorderStyle)
    } else {
      setSceneBorderStyle('none')
    }
    if (project.sceneBorderColor) {
      setSceneBorderColor(project.sceneBorderColor)
    } else {
      setSceneBorderColor('#000000')
    }
    if (project.screenFormat) {
      setScreenFormat(project.screenFormat)
    } else {
      setScreenFormat('landscape') // За замовчуванням landscape
    }
    setIsSaved(true) // При відкритті проєкту вважаємо його збереженим
    setCurrentProject(project)
    navigateToView('editor', { projectId: project.id })
  }

  const createWorkspaceInviteModalFallback = (notification) => {
    const notificationText = `${notification?.body || ''} ${notification?.title || ''}`.trim()
    const inviteMatch = notificationText.match(/invited to join\s+(.+?)\s+as\s+(.+?)\./i)
    const rawRoleLabel = inviteMatch?.[2]?.trim() || 'Workspace member'
    const normalizedRoleLabel = rawRoleLabel.toLowerCase()
    const workspaceId = notification.workspaceId || activeWorkspace?.workspaceId || null

    return {
      workspaceId,
      workspaceName: inviteMatch?.[1]?.trim() || activeWorkspace?.workspaceName || 'workspace',
      workflowRole: normalizedRoleLabel.includes('qa') ? 'qa' : normalizedRoleLabel.includes('developer') ? 'developer' : 'member',
      workflowRoleLabel: rawRoleLabel,
      invitedByName: null,
      invitedByEmail: null,
      isLoadingDetails: true,
      detailsError: null,
      notificationId: notification.id
    }
  }

  const createWorkspaceJoinRequestModalFallback = (notification) => {
    const notificationText = `${notification?.body || ''} ${notification?.title || ''}`.trim()
    const requestMatch = notificationText.match(/^(.+?)\s+requested access to\s+(.+?)\./i)

    return {
      requestId: notification.id,
      workspaceId: notification.workspaceId || activeWorkspace?.workspaceId || null,
      workspaceName: requestMatch?.[2]?.trim() || activeWorkspace?.workspaceName || 'workspace',
      requesterUserId: notification.actorUserId || '',
      requesterName: requestMatch?.[1]?.trim() || null,
      requesterEmail: null,
      status: 'pending',
      requestedAt: notification.createdAt || new Date().toISOString(),
      workflowRole: null,
      isLoadingDetails: true,
      detailsError: null,
      notificationId: notification.id
    }
  }

  const handleProjectNotificationSelect = async (notification) => {
    try {
      if (!notification?.id) {
        return
      }

      const isWorkspaceJoinRequestNotification = notification.type === 'workspace_join_requested'
      const isWorkspaceInviteNotification = notification.type === 'workspace_invite_received'
      const inviteWorkspaceId = notification.workspaceId || activeWorkspace?.workspaceId || null

      if (isWorkspaceJoinRequestNotification) {
        setWorkspaceJoinRequestModal(createWorkspaceJoinRequestModalFallback(notification))
        setProjectNotifications((previousNotifications) =>
          previousNotifications.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item
          )
        )

        window.setTimeout(() => {
          void (async () => {
            try {
              await markProjectNotificationRead(notification.id)
            } catch (readError) {
              console.error('Error marking workspace join request notification as read:', readError)
            }

            const requestWorkspaceId = notification.workspaceId || activeWorkspaceRef.current?.workspaceId || null
            const requesterUserId = notification.actorUserId || null

            if (!requestWorkspaceId || !requesterUserId) {
              setWorkspaceJoinRequestModal((currentRequest) => {
                if (!currentRequest || currentRequest.notificationId !== notification.id) {
                  return currentRequest
                }

                return {
                  ...currentRequest,
                  isLoadingDetails: false,
                  detailsError: 'Unable to resolve the join request details for this notification.'
                }
              })
              return
            }

            try {
              const requestDetails = await getWorkspaceJoinRequestDetails({
                workspaceId: requestWorkspaceId,
                requesterUserId
              })
              setWorkspaceJoinRequestModal((currentRequest) => {
                if (!currentRequest || currentRequest.notificationId !== notification.id) {
                  return currentRequest
                }

                return {
                  ...requestDetails,
                  notificationId: notification.id,
                  isLoadingDetails: false,
                  detailsError: null
                }
              })
            } catch (detailsError) {
              console.error('Error loading workspace join request details:', detailsError)
              setWorkspaceJoinRequestModal((currentRequest) => {
                if (!currentRequest || currentRequest.notificationId !== notification.id) {
                  return currentRequest
                }

                return {
                  ...currentRequest,
                  isLoadingDetails: false,
                  detailsError: detailsError instanceof Error
                    ? detailsError.message
                    : 'Unable to load the workspace join request details.'
                }
              })
            }
          })()
        }, 0)

        return
      }

      if (isWorkspaceInviteNotification) {
        setWorkspaceInviteModal(createWorkspaceInviteModalFallback(notification))
        setProjectNotifications((previousNotifications) =>
          previousNotifications.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item
          )
        )

        window.setTimeout(() => {
          void (async () => {
            try {
              await markProjectNotificationRead(notification.id)
            } catch (readError) {
              console.error('Error marking workspace invite notification as read:', readError)
            }

            if (!inviteWorkspaceId) {
              setWorkspaceInviteModal((currentInvite) => {
                if (!currentInvite || currentInvite.notificationId !== notification.id) {
                  return currentInvite
                }

                return {
                  ...currentInvite,
                  isLoadingDetails: false,
                  detailsError: 'Unable to resolve the workspace for this invitation.'
                }
              })
              return
            }

            try {
              const inviteDetails = await getWorkspaceInviteDetails(inviteWorkspaceId)
              setWorkspaceInviteModal((currentInvite) => {
                if (!currentInvite || currentInvite.notificationId !== notification.id) {
                  return currentInvite
                }

                return {
                  ...inviteDetails,
                  notificationId: notification.id,
                  isLoadingDetails: false,
                  detailsError: null
                }
              })
            } catch (detailsError) {
              console.error('Error loading workspace invite details:', detailsError)
              setWorkspaceInviteModal((currentInvite) => {
                if (!currentInvite || currentInvite.notificationId !== notification.id) {
                  return currentInvite
                }

                return {
                  ...currentInvite,
                  isLoadingDetails: false,
                  detailsError: detailsError instanceof Error
                    ? detailsError.message
                    : 'Unable to load the full invitation details.'
                }
              })
            }
          })()
        }, 0)

        return
      }

      await markProjectNotificationRead(notification.id)
      setProjectNotifications((previousNotifications) =>
        previousNotifications.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      )

      if (notification.type === 'workspace_join_accepted' && notification.workspaceId) {
        await loadWorkspaceContext({
          preferredWorkspaceId: notification.workspaceId
        })
        navigateToView('projects')
        return
      }

      if (notification.type === 'workspace_join_declined') {
        navigateToView('projects')
        return
      }

      if (notification.projectId) {
        const notificationProject = projects.find((project) => project.id === notification.projectId)

        if (notificationProject) {
          await handleEditProject(notificationProject)
          return
        }
      }

      navigateToView('projects')
    } catch (error) {
      console.error('Error opening project notification:', error)
      alert('Unable to open this notification. Please try again.')
    }
  }

  const handleMarkAllProjectNotificationsRead = async () => {
    try {
      await markAllProjectNotificationsRead()
      setProjectNotifications((previousNotifications) =>
        previousNotifications.map((notification) => ({ ...notification, isRead: true }))
      )
    } catch (error) {
      console.error('Error marking project notifications as read:', error)
      alert('Unable to mark notifications as read. Please try again.')
    }
  }

  const handleCloseWorkspaceInviteModal = () => {
    if (isWorkspaceInviteModalSubmitting) {
      return
    }

    setWorkspaceInviteModal(null)
  }

  const handleWorkspaceInviteModalResponse = async (action) => {
    if (!workspaceInviteModal?.workspaceId || isWorkspaceInviteModalSubmitting) {
      return
    }

    try {
      setIsWorkspaceInviteModalSubmitting(true)
      const inviteResponse = await respondToWorkspaceInvite({
        workspaceId: workspaceInviteModal.workspaceId,
        action
      })

      setWorkspaceInviteModal(null)

      if (action === 'accept') {
        await loadWorkspaceContext({
          preferredWorkspaceId: inviteResponse.workspaceId
        })
      }

      await loadProjectNotifications()
    } catch (error) {
      console.error('Error responding to workspace invitation:', error)
      alert(error instanceof Error ? error.message : 'Unable to respond to the workspace invitation. Please try again.')
    } finally {
      setIsWorkspaceInviteModalSubmitting(false)
    }
  }

  const handleCloseWorkspaceJoinRequestModal = () => {
    if (isWorkspaceJoinRequestSubmitting) {
      return
    }

    setWorkspaceJoinRequestModal(null)
  }

  const handleWorkspaceJoinRequestModalResponse = async (action, workflowRole = 'developer') => {
    if (!workspaceJoinRequestModal?.requestId || isWorkspaceJoinRequestSubmitting) {
      return
    }

    try {
      setIsWorkspaceJoinRequestSubmitting(true)
      await respondToWorkspaceJoinRequest({
        requestId: workspaceJoinRequestModal.requestId,
        action,
        workflowRole: action === 'accept' ? workflowRole : undefined
      })

      setWorkspaceJoinRequestModal(null)

      if (activeWorkspace?.workspaceId) {
        await loadWorkspaceSupportData(activeWorkspace)
      }

      await loadProjectNotifications()
    } catch (error) {
      console.error('Error responding to workspace join request:', error)
      alert(error instanceof Error ? error.message : 'Unable to respond to the workspace join request. Please try again.')
    } finally {
      setIsWorkspaceJoinRequestSubmitting(false)
    }
  }

  const handleClearProjectNotifications = async () => {
    try {
      await clearProjectNotifications()
      setProjectNotifications([])
    } catch (error) {
      console.error('Error clearing project notifications:', error)
      alert('Unable to clear notifications. Please try again.')
    }
  }

  const handleUpdateProject = async (projectId, field, value) => {
    if (isGuest) {
      alert('Гості не можуть оновлювати проєкти')
      return
    }

    // Знаходимо проєкт для перевірки статусу
    const project = projects.find(p => p.id === projectId)
    const profile = await getProfileForWorkflow()

    if ((field === 'developerId' || field === 'qaId') && profile?.role !== 'admin') {
      alert('Only team leads can update project assignments.')
      return
    }
    
    if (field === 'status') {
      alert('Use the workflow buttons in the editor to change the project stage.')
      return
    }

    const hasProjectAccess = await ensureProjectManagementAccess(project, 'edit')
    if (!hasProjectAccess) {
      return
    }

    try {
      // Оновлюємо в БД
      const updates = { [field]: value }
      const dbProject = await updateProject(projectId, updates)
      const transformedProject = transformProjectFromDB(dbProject)
      
      setProjects(prev => prev.map(project => 
        project.id === projectId ? transformedProject : project
      ))
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(transformedProject)
      }
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project: ' + error.message)
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (isGuest) {
      alert('Гості не можуть видаляти проєкти')
      return
    }

    // Знаходимо проєкт для перевірки його статусу
    const project = projects.find(p => p.id === projectId)
    if (!project) {
      alert('Проєкт не знайдено')
      return
    }

    const hasProjectAccess = await ensureProjectManagementAccess(project, 'delete')
    if (!hasProjectAccess) {
      return
    }

    if (!window.confirm('Ви впевнені, що хочете видалити цей проєкт?')) {
      return
    }

    try {
      // Видаляємо з БД
      await deleteProject(projectId)
      
      // Якщо видалюваний проєкт відкритий в редакторі, закриваємо редактор
      if (currentProject && currentProject.id === projectId) {
        navigateToView('projects')
        setCurrentProject(null)
        setImages([])
        setCode(DEFAULT_CODE)
        setCssCode('')
        setSceneBackground('#ffffff')
        setSceneBorderStyle('none')
        setSceneBorderColor('#000000')
        setScreenFormat('landscape')
        setSelectedImageId(null)
        setEditingTextId(null)
        resetTimeline()
        setCompiled(false)
        setError('')
      }
      
      // Видаляємо проєкт зі списку
      setProjects(prev => prev.filter(project => project.id !== projectId))
      
      // Якщо редагували цей проєкт, скидаємо editingProjectId
      if (editingProjectId === projectId) {
        setEditingProjectId(null)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project: ' + error.message)
    }
  }

  const handleNewProject = () => {
    setProjectName('')
    setProjectStatus(DEFAULT_PROJECT_STATUS)
    setProjectFormat('Banner')
    setProjectScreenFormat('landscape')
    setProjectDeveloperId('')
    setProjectQaId('')
    setShowProjectModal(true)
  }

  const handleCloseModal = () => {
    setShowProjectModal(false)
  }

  const loadWorkspaceSupportData = async (workspace) => {
    if (!workspace?.workspaceId || isGuestRef.current) {
      setWorkspaceMembers([])
      setWorkspaceInvites([])
      setWorkspaceJoinCredentials(null)
      setWorkspaceJoinSecret(null)
      return
    }

    setWorkspaceJoinSecret(null)

    try {
      const members = await getWorkspaceMembers(workspace.workspaceId)
      setWorkspaceMembers(members)
    } catch (error) {
      console.error('Error loading workspace members:', error)
      setWorkspaceMembers([])
    }

    if (workspace.workspaceRole === 'owner' && workspace.workspaceType === 'team') {
      try {
        const invites = await getWorkspaceInvites(workspace.workspaceId)
        setWorkspaceInvites(invites)
      } catch (error) {
        console.error('Error loading workspace invites:', error)
        setWorkspaceInvites([])
      }

      try {
        const credentialsSummary = await getWorkspaceJoinCredentialsSummary(workspace.workspaceId)
        setWorkspaceJoinCredentials(credentialsSummary)
      } catch (error) {
        console.error('Error loading workspace credentials:', error)
        setWorkspaceJoinCredentials(null)
      }
    } else {
      setWorkspaceInvites([])
      setWorkspaceJoinCredentials(null)
    }
  }

  const loadWorkspaceContext = async ({
    preferredWorkspaceId = getStoredActiveWorkspaceId(),
    showActivationSuccess = false
  } = {}) => {
    if (isGuestRef.current) {
      return null
    }

    const loadId = beginWorkspaceContextResolution()

    try {
      await claimPendingWorkspaceInvites()
    } catch (error) {
      console.error('Error claiming pending invites:', error)
    }

    try {
      const workspaces = await listAccessibleWorkspaces()
      setAccessibleWorkspaces(workspaces)

      const destination = resolvePostAuthDestination({
        workspaces,
        preferredWorkspaceId
      })
      const shouldShowActivationSuccess = Boolean(showActivationSuccess || workspaceActivationSuccessRef.current)

      if (!destination.workspace) {
        setActiveWorkspace(null)
        setWorkspaceMembers([])
        setWorkspaceInvites([])
        setWorkspaceJoinCredentials(null)
        setWorkspaceJoinSecret(null)
        setProjects([])
        if (!shouldShowActivationSuccess) {
          syncWorkspaceActivationSuccess(false)
        }
        navigateToView('onboarding', { replace: true })
        storeActiveWorkspaceId(null)
        return null
      }

      setActiveWorkspace(destination.workspace)
      storeActiveWorkspaceId(destination.workspace.workspaceId)

      await loadProjects(destination.workspace.workspaceId)
      await loadWorkspaceSupportData(destination.workspace)

      if (shouldShowActivationSuccess) {
        syncWorkspaceActivationSuccess(true)
        navigateToView('onboarding', { replace: true })
      } else {
        syncWorkspaceActivationSuccess(false)
        navigateToView(destination.nextView, { replace: true })
      }

      return destination.workspace
    } finally {
      completeWorkspaceContextResolution(loadId)
    }
  }

  const handleWorkspaceChange = async (workspaceId) => {
    const nextWorkspace = accessibleWorkspaces.find((workspace) => workspace.workspaceId === workspaceId)

    if (!nextWorkspace) {
      return
    }

    try {
      setActiveWorkspace(nextWorkspace)
      storeActiveWorkspaceId(nextWorkspace.workspaceId)
      await loadProjects(nextWorkspace.workspaceId)
      await loadWorkspaceSupportData(nextWorkspace)
      syncWorkspaceActivationSuccess(false)
      navigateToView('projects')
    } catch (error) {
      console.error('Error switching workspace:', error)
      alert('Failed to switch the workspace: ' + error.message)
    }
  }

  const handleOpenWorkspaceAccess = () => {
    setWorkspacePaymentError('')
    setIsFinalizingWorkspaceActivation(false)

    if (!isGuest && activeWorkspace?.workspaceId) {
      if (activeWorkspace.workspaceType === 'team' && activeWorkspace.workspaceRole === 'owner') {
        setCabinetInitialTab('workspace')
        navigateToView('cabinet', { state: { from: location.pathname } })
        return
      }

      syncWorkspaceActivationSuccess(true)
      navigateToView('onboarding', { state: { from: location.pathname } })
      return
    }

    syncWorkspaceActivationSuccess(false)
    setPendingWorkspacePayment(null)
    navigateToView('onboarding', { state: { from: location.pathname } })
  }

  const openGuestCheckoutAuthModal = (planType) => {
    setSelectedWorkspacePlan(planType)
    setGuestCheckoutPlan(planType)
    setGuestWorkspaceJoinRequest(null)
    savePendingWorkspaceAction(createPendingCheckoutAction(planType))
    setWorkspacePaymentError('')
    setIsFinalizingWorkspaceActivation(false)
    syncWorkspaceActivationSuccess(false)
    setPendingWorkspacePayment(null)
    syncPendingWorkspacePaymentStartedAt(null)
    navigateToView('onboarding', { state: { from: location.pathname } })
  }

  const openGuestWorkspaceJoinAuthModal = ({ workspaceLogin, workspacePassword }) => {
    setGuestWorkspaceJoinRequest({ workspaceLogin, workspacePassword })
    setGuestCheckoutPlan(null)
    savePendingWorkspaceAction(createPendingWorkspaceJoinAction({ workspaceLogin, workspacePassword }))
    setWorkspacePaymentError('')
    setIsFinalizingWorkspaceActivation(false)
    syncWorkspaceActivationSuccess(false)
    navigateToView('onboarding', { state: { from: location.pathname } })
  }

  const handleReturnToLogin = async () => {
    try {
      setIsReturningToLogin(true)
      setWorkspacePaymentError('')

      if (user && !isGuestRef.current) {
        isSigningOutRef.current = true
        await signOut()
      }

      setUser(null)
      syncGuestMode(false)
      resetWorkspaceState()
      setProjects([])
      navigateToView('login', { replace: true })
    } catch (error) {
      isSigningOutRef.current = false
      console.error('Error signing out:', error)
      setWorkspacePaymentError(error?.message || 'Unable to sign out right now.')
    } finally {
      setIsReturningToLogin(false)
    }
  }

  const handleBackFromOnboarding = async () => {
    try {
      setIsReturningToLogin(true)
      goBackFromOnboarding()
    } catch (error) {
      console.error('Error going back from onboarding:', error)
      setWorkspacePaymentError(error?.message || 'Unable to go back right now.')
    } finally {
      setIsReturningToLogin(false)
    }
  }

  const handleStartWorkspaceCheckout = async (planType, options = {}) => {
    const authenticatedUser = options.authenticatedUser || user
    const checkoutAccess = resolveWorkspaceCheckoutAccess({
      isGuest: isGuestRef.current,
      hasUser: Boolean(authenticatedUser),
      planType
    })

    try {
      setSelectedWorkspacePlan(planType)
      setIsFinalizingWorkspaceActivation(false)

      if (checkoutAccess.requiresAuth) {
        openGuestCheckoutAuthModal(planType)
        return
      }

      setIsStartingWorkspaceCheckout(true)
      setGuestCheckoutPlan(null)
      setPendingWorkspacePayment(null)
      setWorkspacePaymentError('')
      const checkoutStartedAt = Date.now()
      const workspacePlan = getWorkspacePlan(planType)
      syncPendingWorkspacePaymentStartedAt(checkoutStartedAt)

      const session = await createWorkspaceCheckoutSession(planType)
      syncPendingWorkspacePaymentOrderId(session.orderId)
      setPendingWorkspacePayment({
        id: session.paymentId,
        orderId: session.orderId,
        workspaceId: null,
        planType,
        amountMinor: workspacePlan.amountMinor,
        currency: workspacePlan.currency,
        status: 'processing',
        paidAt: null,
        createdAt: new Date(checkoutStartedAt).toISOString(),
        checkoutUrl: session.checkoutUrl
      })
      window.location.href = session.checkoutUrl
    } catch (error) {
      console.error('Error starting workspace checkout:', error)
      syncPendingWorkspacePaymentStartedAt(null)
      setWorkspacePaymentError(error.message || 'Unable to start the payment session.')
    } finally {
      setIsStartingWorkspaceCheckout(false)
    }
  }

  const handleJoinWorkspace = async ({ workspaceLogin, workspacePassword }, options = {}) => {
    const authenticatedUser = options.authenticatedUser || user

    if (isGuestRef.current || !authenticatedUser) {
      openGuestWorkspaceJoinAuthModal({ workspaceLogin, workspacePassword })
      return { requiresAuthentication: true }
    }

    setWorkspacePaymentError('')
    setGuestWorkspaceJoinRequest(null)
    setIsFinalizingWorkspaceActivation(false)
    syncWorkspaceActivationSuccess(false)

    const joinedWorkspace = await joinWorkspaceWithCredentials({
      workspaceLogin,
      workspacePassword
    })

    if (joinedWorkspace.status === 'pending_approval') {
      setWorkspacePaymentError(`Your request to join ${joinedWorkspace.workspaceName} was sent to the team lead for review.`)
      return joinedWorkspace
    }

    await loadWorkspaceContext({
      preferredWorkspaceId: joinedWorkspace.workspaceId
    })

    return joinedWorkspace
  }

  const handleJoinWorkspaceFromHeader = async ({ workspaceLogin, workspacePassword }) => {
    try {
      const joinedWorkspace = await handleJoinWorkspace({ workspaceLogin, workspacePassword })
      navigateToView('projects')
      return joinedWorkspace
    } catch (error) {
      console.error('Error joining workspace from header:', error)
      throw error instanceof Error ? error : new Error('Unable to join this workspace.')
    }
  }

  const continuePendingWorkspaceAction = async (authenticatedUser = user) => {
    if (!authenticatedUser || isGuestRef.current || isContinuingPendingWorkspaceActionRef.current) {
      return false
    }

    const pendingAction = readSavedPendingWorkspaceAction()

    if (!pendingAction) {
      return false
    }

    try {
      isContinuingPendingWorkspaceActionRef.current = true
      clearSavedPendingWorkspaceAction()

      if (pendingAction.type === 'checkout') {
        await handleStartWorkspaceCheckout(pendingAction.planType, { authenticatedUser })
        return true
      }

      if (pendingAction.type === 'workspaceJoin') {
        await handleJoinWorkspace(
          {
            workspaceLogin: pendingAction.workspaceLogin,
            workspacePassword: pendingAction.workspacePassword
          },
          { authenticatedUser }
        )
        return true
      }
    } catch (error) {
      console.error('Error continuing pending workspace action:', error)
      setWorkspacePaymentError(error?.message || 'Unable to continue the saved workspace action.')
    } finally {
      isContinuingPendingWorkspaceActionRef.current = false
    }

    return false
  }

  useEffect(() => {
    if (!user || isGuest || loading || isResolvingWorkspaceContext) {
      return
    }

    void continuePendingWorkspaceAction(user)
  }, [user, isGuest, loading, isResolvingWorkspaceContext])

  const handleRotateWorkspaceCredentials = async () => {
    if (!activeWorkspace?.workspaceId) {
      throw new Error('Select an active workspace before rotating shared credentials.')
    }

    const rotatedCredentials = await rotateWorkspaceJoinCredentials(activeWorkspace.workspaceId)
    setWorkspaceJoinCredentials({
      workspaceId: rotatedCredentials.workspaceId,
      workspaceLogin: rotatedCredentials.workspaceLogin,
      hasCredentials: rotatedCredentials.hasCredentials,
      isEnabled: rotatedCredentials.isEnabled,
      createdAt: rotatedCredentials.createdAt,
      rotatedAt: rotatedCredentials.rotatedAt
    })
    setWorkspaceJoinSecret(rotatedCredentials)

    return rotatedCredentials
  }

  const handleCreateWorkspaceInvite = async (email, workflowRole) => {
    if (!activeWorkspace?.workspaceId) {
      throw new Error('Select an active corporate workspace before adding invites.')
    }

    await createWorkspaceInvite({
      workspaceId: activeWorkspace.workspaceId,
      email,
      workflowRole
    })

    const invites = await getWorkspaceInvites(activeWorkspace.workspaceId)
    setWorkspaceInvites(invites)
  }

  const handleRevokeWorkspaceInvite = async (inviteId) => {
    if (!activeWorkspace?.workspaceId) {
      throw new Error('Select an active corporate workspace before changing invites.')
    }

    await revokeWorkspaceInvite(inviteId)
    const invites = await getWorkspaceInvites(activeWorkspace.workspaceId)
    setWorkspaceInvites(invites)
  }

  const handleUpdateWorkspaceMemberRole = async (membershipId, workflowRole) => {
    if (!activeWorkspace?.workspaceId) {
      throw new Error('Select an active corporate workspace before changing member access.')
    }

    await updateWorkspaceMemberRole({ membershipId, workflowRole })
    const members = await getWorkspaceMembers(activeWorkspace.workspaceId)
    setWorkspaceMembers(members)
  }

  const handleRemoveWorkspaceMember = async (membershipId) => {
    if (!activeWorkspace?.workspaceId) {
      throw new Error('Select an active corporate workspace before removing members.')
    }

    await removeWorkspaceMember(membershipId)
    const members = await getWorkspaceMembers(activeWorkspace.workspaceId)
    setWorkspaceMembers(members)
  }

  // Завантаження проєктів з БД
  const loadProjects = async (workspaceIdOverride = activeWorkspace?.workspaceId || null) => {
    const startTime = performance.now()
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] loadProjects: Початок завантаження проєктів з БД...`)
    console.log(`[${time}] [БД ДЕБАГ] loadProjects: Поточний стан:`, {
      currentProjectsCount: projects.length,
      hasUser: !!user,
      isGuest
    })
    
    try {
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 1 - Вибір джерела проєктів`)
      const importStartTime = performance.now()
      let projectsData = []

      if (isGuest) {
        const { getPublicProjects } = await import('./services/projectService')
        projectsData = await getPublicProjects()
      } else if (!workspaceIdOverride) {
        projectsData = []
      } else {
        projectsData = await getAccessibleProjects(workspaceIdOverride)
      }

      const importDuration = (performance.now() - importStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 1 успішний (${importDuration}ms)`)
      
      // Крок 2: Отримання даних з БД
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 2 - Отримання списку проєктів`, {
        source: isGuest ? 'public-projects' : 'workflow-accessible-projects'
      })
      const getDataStartTime = performance.now()
      const getDataDuration = (performance.now() - getDataStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 2 успішний (${getDataDuration}ms)`, {
        rawDataCount: projectsData?.length || 0,
        hasData: !!projectsData,
        isArray: Array.isArray(projectsData)
      })
      
      // Крок 3: Перетворення даних
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 3 - Перетворення проєктів`)
      const transformStartTime = performance.now()
      const transformedProjects = projectsData.map(transformProjectFromDB)
      const transformDuration = (performance.now() - transformStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 3 успішний (${transformDuration}ms)`, {
        transformedCount: transformedProjects.length,
        sampleProject: transformedProjects[0] ? {
          id: transformedProjects[0].id,
          name: transformedProjects[0].name,
          imagesCount: transformedProjects[0].images?.length || 0
        } : null
      })
      
      // Крок 4: Встановлення стану
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 4 - Встановлення стану`)
      const setStateStartTime = performance.now()
      setProjects(transformedProjects)
      setCurrentProject((previousProject) => {
        if (!previousProject) {
          return previousProject
        }

        return transformedProjects.find((project) => project.id === previousProject.id) || previousProject
      })
      const setStateDuration = (performance.now() - setStateStartTime).toFixed(2)
      const totalDuration = (performance.now() - startTime).toFixed(2)
      
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Успішно завершено (загалом ${totalDuration}ms)`, {
        projectsCount: transformedProjects.length,
        setStateDuration,
        breakdown: {
          import: importDuration,
          getData: getDataDuration,
          transform: transformDuration,
          setState: setStateDuration
        }
      })
    } catch (error) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] loadProjects: Помилка завантаження проєктів (${totalDuration}ms)`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      })
      // Якщо помилка, використовуємо порожній масив
      setProjects([])
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Встановлено порожній масив проєктів`)
    }
  }

  useEffect(() => {
    if (!user || isGuest) {
      return undefined
    }

    if (!pendingWorkspacePaymentOrderIdRef.current) {
      return undefined
    }

    let mounted = true

    const refreshPendingPayment = async () => {
      const pendingOrderId = pendingWorkspacePaymentOrderIdRef.current

      if (!pendingOrderId) {
        return
      }

      try {
        setIsRefreshingWorkspacePayment(true)
        const payment = await getWorkspacePaymentStatus(pendingOrderId)

        if (!mounted || pendingWorkspacePaymentOrderIdRef.current !== pendingOrderId) {
          return
        }

        if (!payment) {
          setPendingWorkspacePayment(null)
          setIsFinalizingWorkspaceActivation(false)
          navigateToView('onboarding', { replace: true })
          return
        }

        if (payment.status === 'paid') {
          setIsFinalizingWorkspaceActivation(true)
          syncWorkspaceActivationSuccess(true)
          setPendingWorkspacePayment(payment)
          setWorkspacePaymentError('')

          let activatedWorkspace = null

          try {
            activatedWorkspace = await loadWorkspaceContext({
              preferredWorkspaceId: payment.workspaceId || getStoredActiveWorkspaceId(),
              showActivationSuccess: true
            })
          } finally {
            if (mounted) {
              if (activatedWorkspace) {
                syncPendingWorkspacePaymentOrderId(null)
                syncPendingWorkspacePaymentStartedAt(null)
                setPendingWorkspacePayment(null)
                setIsFinalizingWorkspaceActivation(false)
              } else {
                setPendingWorkspacePayment(payment)
                navigateToView('onboarding', { replace: true })
              }
            }
          }
          return
        }

        if (isWorkspacePaymentFailureStatus(payment.status)) {
          syncPendingWorkspacePaymentOrderId(null)
          syncPendingWorkspacePaymentStartedAt(null)
          syncWorkspaceActivationSuccess(false)
          setPendingWorkspacePayment(payment)
          setIsFinalizingWorkspaceActivation(false)
          setWorkspacePaymentError(
            payment.status === 'cancelled'
              ? 'The payment was cancelled before confirmation. You can restart checkout whenever you are ready.'
              : 'The payment could not be completed. Please try again.'
          )
          navigateToView('onboarding', { replace: true })
          return
        }

        setIsFinalizingWorkspaceActivation(false)
        syncPendingWorkspacePaymentStartedAt(payment.createdAt ? new Date(payment.createdAt).getTime() : pendingWorkspacePaymentStartedAtRef.current)
        setPendingWorkspacePayment(payment)
        setWorkspacePaymentError('')
        navigateToView('onboarding', { replace: true })
      } catch (error) {
        if (mounted) {
          console.error('Error refreshing workspace payment:', error)
          setWorkspacePaymentError(error.message || 'Unable to refresh the payment status.')
        }
      } finally {
        if (mounted) {
          setIsRefreshingWorkspacePayment(false)
        }
      }
    }

    refreshPendingPayment()
    const intervalId = setInterval(refreshPendingPayment, 5000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [user, isGuest])

  // Перевірка автентифікації при завантаженні
  useEffect(() => {
    let mounted = true
    let authStateHandled = false // Прапорець, що вказує чи вже оброблено подію автентифікації
    
    // Таймаут для гарантії, що loading буде встановлено в false
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[БД ДЕБАГ] Таймаут перевірки автентифікації - встановлюємо loading в false')
        setLoading(false)
      }
    }, 5000) // 5 секунд максимум (збільшено для дачі часу onAuthStateChange)
    
    const checkAuth = async () => {
      try {
        console.log('[БД ДЕБАГ] Початок перевірки автентифікації...')
        
        // Спочатку перевіряємо, чи є збережена сесія в localStorage (швидка перевірка)
        const storedSession = localStorage.getItem('sb-' + (import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || '') + '-auth-token')
        console.log('[БД ДЕБАГ] Перевірка localStorage на наявність збереженої сесії:', {
          hasStoredSession: !!storedSession,
          storedSessionLength: storedSession?.length || 0
        })
        
        // Якщо є збережена сесія, даємо більше часу на отримання
        const timeoutDuration = storedSession ? 5000 : 3000
        
        const session = await Promise.race([
          getSession(),
          new Promise((resolve) => setTimeout(() => {
            console.warn(`[БД ДЕБАГ] Таймаут getSession (${timeoutDuration}ms) - повертаємо null`)
            resolve(null)
          }, timeoutDuration))
        ])
        console.log('[БД ДЕБАГ] Результат перевірки сесії:', session ? 'Сесію знайдено' : 'Сесію не знайдено')
        
        if (!mounted) return
        
        if (session?.user) {
          console.log('[БД ДЕБАГ] Користувач авторизований:', session.user.email)
          // Перевіряємо, чи вже оброблено подію автентифікації через onAuthStateChange
          if (!authStateHandled) {
            setUser(session.user)
            syncGuestMode(false)

            try {
              await loadWorkspaceContext({
                preferredWorkspaceId: getStoredActiveWorkspaceId()
              })
            } catch (error) {
              console.error('[БД ДЕБАГ] Помилка завантаження workspace context:', error)
            }
        } else {
            console.log('[БД ДЕБАГ] Стан автентифікації вже оброблено через onAuthStateChange, пропускаємо')
          }
        } else {
          console.log('[БД ДЕБАГ] Користувач не авторизований')
          // Перевіряємо, чи вже оброблено подію автентифікації через onAuthStateChange
          if (!authStateHandled) {
            // Явно встановлюємо null для user і false для isGuest
            setUser(null)
            syncGuestMode(false)
            resetWorkspaceState()
            // Встановлюємо view на login якщо користувач не авторизований
            if (mounted) {
              navigateToView('login', { replace: true })
            }
          } else {
            console.log('[БД ДЕБАГ] Стан автентифікації вже оброблено через onAuthStateChange, пропускаємо')
          }
        }
      } catch (error) {
        console.error('[БД ДЕБАГ] Помилка перевірки автентифікації:', error)
        console.error('[БД ДЕБАГ] Детали ошибки:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        if (mounted) {
          setUser(null)
          syncGuestMode(false)
          resetWorkspaceState()
        }
      } finally {
        clearTimeout(timeoutId)
        if (mounted) {
          console.log('[БД ДЕБАГ] Перевірка автентифікації завершена, встановлюємо loading в false')
          setLoading(false)
        }
      }
    }

    // Запускаємо перевірку автентифікації
    console.log('[БД ДЕБАГ] Запуск checkAuth...')
    checkAuth()

    // Підписка на зміни статусу автентифікації
    let subscription = null
    try {
      const subscriptionData = onAuthStateChange((event, session) => {
        if (!mounted) return
        
        console.log(`[БД ДЕБАГ] onAuthStateChange: Подія ${event} отримана`, {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          authStateHandled,
          isGuest: isGuestRef.current
        })
        
        // Обробляємо помилки refresh token
        if (event === 'SIGNED_OUT' && !session && !isSigningOutRef.current) {
          console.log('[БД ДЕБАГ] Виявлено вихід через помилку refresh token')
          authStateHandled = true
          setUser(null)
          syncGuestMode(false)
          resetWorkspaceState()
          setProjects([])
          if (mounted) {
            navigateToView('login', { replace: true })
            setLoading(false)
          }
          return
        }
        
        // Якщо користувач у гостьовому режимі, ігноруємо події автентифікації
        if (isGuestRef.current && event !== 'SIGNED_OUT') {
          console.log('[БД ДЕБАГ] onAuthStateChange: Ігноруємо подію (гостьовий режим)')
          return
        }
        
        // Якщо це подія виходу, яку ми самі викликали, не обробляємо її повторно
        if (event === 'SIGNED_OUT' && isSigningOutRef.current) {
          isSigningOutRef.current = false
          console.log('[БД ДЕБАГ] onAuthStateChange: Ігноруємо подію (самостійний вихід)')
          return
        }
        
        if (session?.user) {
          console.log(`[БД ДЕБАГ] onAuthStateChange: ШВИДКЕ встановлення користувача для події ${event}`)
          const isSameActiveSession =
            userRef.current?.id === session.user.id && Boolean(activeWorkspaceRef.current?.workspaceId)
          const shouldResolveWorkspaceContext =
            (event === 'SIGNED_IN' && !isSameActiveSession) || (event === 'INITIAL_SESSION' && !authStateHandled)

          setUser(session.user)
          syncGuestMode(false)
          if (mounted) {
            if (event === 'SIGNED_IN' && shouldResolveWorkspaceContext) {
              setIsResolvingWorkspaceContext(true)
              navigateToView('onboarding', { replace: true })
            }
            // Встановлюємо loading в false для подій входу
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
              console.log(`[БД ДЕБАГ] onAuthStateChange: Встановлюємо loading в false для події ${event}`)
              setLoading(false)
            }
          }
          
          // Встановлюємо прапорець ПІСЛЯ встановлення користувача
          authStateHandled = true
          
          if (!shouldResolveWorkspaceContext) {
            console.log(`[БД ДЕБАГ] onAuthStateChange: Пропускаємо workspace reload для події ${event}`)
            return
          }

          // Тепер виконуємо асинхронні операції (перевірка бану, завантаження проєктів)
          // в фоновому режимі - використовуємо setTimeout щоб не блокувати callback
          setTimeout(async () => {
            try {
              // Перевіряємо бан після встановлення користувача
              console.log(`[БД ДЕБАГ] onAuthStateChange: Перевірка бану для ${session.user.id}`)
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('banned')
              .eq('id', session.user.id)
              .maybeSingle()
            
            if (profileError) {
                console.warn('[БД ДЕБАГ] Помилка перевірки бану:', profileError.message)
            }
            
              if (!profileError && profile?.banned && mounted) {
                // Якщо користувач забанений, виходимо
                console.log('[БД ДЕБАГ] Користувач забанений, вихід з системи...')
                isSigningOutRef.current = true
                await signOut()
                setUser(null)
                syncGuestMode(false)
                resetWorkspaceState()
                setProjects([])
                if (mounted) {
                  navigateToView('login', { replace: true })
                  setLoading(false)
                }
                alert('Your account has been blocked. Please contact an administrator.')
                return
              }
              
              console.log(`[БД ДЕБАГ] onAuthStateChange: Завантаження workspace context для події ${event}`)
              try {
                await loadWorkspaceContext({
                  preferredWorkspaceId: getStoredActiveWorkspaceId()
                })
              } catch (error) {
                console.error(`[БД ДЕБАГ] onAuthStateChange: Помилка завантаження workspace context для події ${event}:`, error)
              }
              
              console.log(`[БД ДЕБАГ] onAuthStateChange: Обробка події ${event} завершена`, {
                event,
                userId: session.user.id,
                email: session.user.email
              })
            } catch (error) {
              console.error(`[БД ДЕБАГ] onAuthStateChange: Помилка при обробці події ${event}:`, error)
            }
          }, 0)
        } else {
          // Скидаємо стан тільки при явному виході
          if (event === 'SIGNED_OUT') {
            setUser(null)
            syncGuestMode(false)
            resetWorkspaceState()
            setProjects([])
            if (mounted) {
              navigateToView('login', { replace: true })
              setLoading(false) // Убеждаемся, что loading сброшен
            }
          }
          // Для інших подій (наприклад, TOKEN_REFRESHED без користувача) не скидаємо стан
          // щоб не скидати стан гостя
        }
      })
      subscription = subscriptionData?.data?.subscription || subscriptionData?.subscription
    } catch (error) {
      console.error('Error setting up auth state change:', error)
      // Якщо не вдалося підписатися, все одно продовжуємо
      if (mounted) {
        setLoading(false)
      }
    }

    return () => {
      mounted = false
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (error) {
          console.error('Error unsubscribing:', error)
        }
      }
    }
  }, [])

  // Періодична перевірка бану для залогінених користувачів
  useEffect(() => {
    if (!user || isGuest || loading) return
    
    let mounted = true // Прапорець для відстеження монтування компонента
    let isCheckingBan = false // Прапорець для запобігання множинних одночасних перевірок

    const checkBanStatus = async () => {
      // Запобігаємо множинним одночасним перевіркам
      if (isCheckingBan) {
        console.log('[БД ДЕБАГ] Перевірка бану вже виконується, пропускаємо...')
        return
      }
      
      try {
        isCheckingBan = true
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('banned')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profileError) {
          console.warn('[БД ДЕБАГ] Помилка періодичної перевірки бану:', profileError.message)
        }
        
        if (!profileError && profile?.banned && mounted) {
          // Якщо користувач забанений, виходимо
          console.log('[БД ДЕБАГ] Пользователь забанен, выход из системы...')
          await signOut()
          if (mounted) {
            setUser(null)
            syncGuestMode(false)
            resetWorkspaceState()
            setProjects([])
            navigateToView('login', { replace: true })
            setLoading(false) // Убеждаемся, что loading сброшен
            alert('Ваш аккаунт заблокирован. Обратитесь к администратору.')
          }
        }
      } catch (error) {
        console.error('[БД ДЕБАГ] Помилка періодичної перевірки бану:', error)
      } finally {
        isCheckingBan = false
      }
    }

    // Перевіряємо бан кожні 30 секунд
    const intervalId = setInterval(() => {
      if (mounted && user && !isGuest && !loading && !isCheckingBan) {
        checkBanStatus()
      }
    }, 30000)
    
    // Перевіряємо одразу при монтуванні (тільки якщо не в процесі завантаження)
    // Використовуємо невелику затримку, щоб переконатися, що loading завершено
    const timeoutId = setTimeout(() => {
      if (mounted && !loading && user && !isGuest && !isCheckingBan) {
        checkBanStatus()
      }
    }, 500)

    return () => {
      mounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [user, isGuest, loading])

  // Синхронізуємо view зі станом автентифікації
  // Прибрано для запобігання зациклюванню - onAuthStateChange вже керує view
  // Цей useEffect викликав конфлікти з onAuthStateChange

  const handleAuthSuccess = async (options = {}) => {
    const shouldContinuePendingWorkspaceAction = options.continuePendingWorkspaceAction !== false
    const startTime = performance.now()
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Початок обробки успішного входу...`)
    console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Поточний стан:`, {
      view,
      hasUser: !!user,
      isGuest,
      loading,
      projectsCount: projects.length
    })
    
    try {
      // Крок 1: Отримання сесії
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 1 - Отримання сесії`)
      const sessionStartTime = performance.now()
      const session = await getSession()
      const sessionDuration = (performance.now() - sessionStartTime).toFixed(2)
      
      if (!session?.user) {
        const totalDuration = (performance.now() - startTime).toFixed(2)
        console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Сесію не знайдено після входу (${sessionDuration}ms, загалом ${totalDuration}ms)`)
        setLoading(false)
        return null
      }
      
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 1 успішний (${sessionDuration}ms)`, {
        userId: session.user.id,
        email: session.user.email
      })
      
      // Крок 2: Перевірка бану
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 2 - Перевірка бану`)
      const banCheckStartTime = performance.now()
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('banned')
          .eq('id', session.user.id)
          .maybeSingle()
        
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        
        if (profileError) {
          console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка перевірки бану (${banCheckDuration}ms)`, {
            message: profileError.message,
            code: profileError.code
          })
        }
        
        if (!profileError && profile?.banned) {
          const totalDuration = (performance.now() - startTime).toFixed(2)
          console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Користувач забанений, вихід... (загалом ${totalDuration}ms)`)
          await signOut()
          setUser(null)
          syncGuestMode(false)
          resetWorkspaceState()
          setProjects([])
          navigateToView('login', { replace: true })
          setLoading(false)
          alert('Ваш акаунт заблоковано. Зверніться до адміністратора.')
          return null
        }
        
        console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 2 успішний (${banCheckDuration}ms)`, {
          banned: profile?.banned || false
        })
      } catch (banCheckError) {
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка перевірки статусу бану (${banCheckDuration}ms)`, banCheckError)
        // Продовжуємо навіть якщо не вдалося перевірити бан
      }
      
      // Крок 3: Встановлення користувача
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 3 - Встановлення користувача`)
      setUser(session.user)
      syncGuestMode(false)
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 3 завершено - стан оновлено`, {
        userId: session.user.id,
        email: session.user.email
      })
      
      // Крок 4: Завантаження workspace context
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 4 - Завантаження workspace context`)
      const loadProjectsStartTime = performance.now()
      try {
        await loadWorkspaceContext({
          preferredWorkspaceId: getStoredActiveWorkspaceId()
        })
        const loadProjectsDuration = (performance.now() - loadProjectsStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 4 успішний (${loadProjectsDuration}ms)`)
      } catch (error) {
        const loadProjectsDuration = (performance.now() - loadProjectsStartTime).toFixed(2)
        console.error(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка завантаження workspace context (${loadProjectsDuration}ms)`, {
          message: error.message,
          code: error.code
        })
        // Продовжуємо навіть якщо не вдалося завантажити workspace context
      }
      
      // Крок 5: Встановлення loading
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 5 - Встановлення loading`)
      setLoading(false)

      if (shouldContinuePendingWorkspaceAction) {
        await continuePendingWorkspaceAction(session.user)
      }
      
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Вхід завершено успішно (загалом ${totalDuration}ms)`, {
        loading: false,
        hasUser: true,
        isGuest: false
      })
      return session.user
    } catch (error) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка при обробці входу (${totalDuration}ms)`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      setLoading(false)
      // Не встановлюємо помилку тут, щоб не заважати onAuthStateChange
      return null
    }
  }

  const handleGuestLogin = async () => {
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Початок`)
    
    try {
      // Встановлюємо гостьовий режим
      // Для гостя user має бути null, а isGuest = true
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Встановлення гостьового режиму`)
      setUser(null)
      syncGuestMode(true)
      resetWorkspaceState()
      setLoading(false) // Скидаємо loading для гостя
      navigateToView('projects', { replace: true }) // Встановлюємо view одразу
      
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Завантаження проєктів для гостя`)
      // Завантажуємо проєкти для гостя
    await loadProjects()
      
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Завершено успішно`)
    } catch (error) {
      const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
      console.error(`[${time}] [БД ДЕБАГ] handleGuestLogin: Помилка`, error)
      setLoading(false)
      navigateToView('login', { replace: true })
    }
  }

  const unreadProjectNotificationCount = projectNotifications.filter((notification) => !notification.isRead).length
  const canJoinTeamWorkspaceFromHeader = Boolean(
    user &&
    !isGuest
  )
  const workspaceInviteModalElement = workspaceInviteModal ? (
    <WorkspaceInviteModal
      invite={workspaceInviteModal}
      isSubmitting={isWorkspaceInviteModalSubmitting}
      onAccept={() => handleWorkspaceInviteModalResponse('accept')}
      onDecline={() => handleWorkspaceInviteModalResponse('decline')}
      onClose={handleCloseWorkspaceInviteModal}
    />
  ) : null
  const workspaceJoinModalElement = isWorkspaceJoinModalOpen ? (
    <WorkspaceJoinModal
      onClose={() => setIsWorkspaceJoinModalOpen(false)}
      onJoin={handleJoinWorkspaceFromHeader}
    />
  ) : null
  const workspaceJoinRequestModalElement = workspaceJoinRequestModal ? (
    <WorkspaceJoinRequestModal
      request={workspaceJoinRequestModal}
      isSubmitting={isWorkspaceJoinRequestSubmitting}
      onAccept={(workflowRole) => handleWorkspaceJoinRequestModalResponse('accept', workflowRole)}
      onDecline={() => handleWorkspaceJoinRequestModalResponse('decline')}
      onClose={handleCloseWorkspaceJoinRequestModal}
    />
  ) : null
  const studioNoticeModalElement = studioNoticeModal ? (
    <div className="studio-notice-modal-overlay" onClick={() => setStudioNoticeModal(null)}>
      <div
        className={`studio-notice-modal studio-notice-modal--${studioNoticeModal.tone || 'info'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-notice-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="studio-notice-modal__close"
          onClick={() => setStudioNoticeModal(null)}
          aria-label="Close notice"
        >
          <X size={16} />
        </button>

        <div className="studio-notice-modal__icon">
          <AlertTriangle size={20} />
        </div>

        <div className="studio-notice-modal__content">
          <span className="studio-notice-modal__eyebrow">Studio notice</span>
          <h2 id="studio-notice-modal-title">{studioNoticeModal.title}</h2>
          <p>{studioNoticeModal.message}</p>
        </div>

        <div className="studio-notice-modal__actions">
          <button type="button" onClick={() => setStudioNoticeModal(null)}>
            Got it
          </button>
        </div>
      </div>
    </div>
  ) : null
  const projectAssignableUsers = (workspaceMembers || [])
    .filter((workspaceMember) => !workspaceMember.banned)
    .map((workspaceMember) => ({
      id: workspaceMember.userId,
      email: workspaceMember.email,
      fullName: workspaceMember.fullName,
      profileRole: workspaceMember.profileRole,
      workflowRole: workspaceMember.workflowRole || 'developer',
      membershipRole: workspaceMember.membershipRole
    }))
  const canAssignProjectMembers =
    !isGuest &&
    activeWorkspace?.workspaceType === 'team' &&
    (
      activeWorkspace?.workspaceRole === 'owner' ||
      workflowProfile?.role === 'admin' ||
      workflowProfile?.workspace_role === 'owner' ||
      workflowProfile?.workspaceRole === 'owner'
    )

  // Показуємо завантаження тільки якщо ще перевіряємо автентифікацію
  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-panel">
          <div className="app-loading-eyebrow">Creative operations</div>
          <h1 className="app-loading-title">Preparing your workspace</h1>
          <p className="app-loading-copy">
            We are syncing your session, workflow permissions, and project data.
          </p>
        </div>
      </div>
    )
  }

  // Сторінка входу
  if (view === 'login') {
    return (
      <AuthForm 
        onAuthSuccess={handleAuthSuccess} 
        onGuestLogin={handleGuestLogin} 
      />
    )
  }

  if (view === 'onboarding') {
    return (
      <>
        <WorkspaceOnboardingView
          activeWorkspace={showWorkspaceActivationSuccess ? activeWorkspace : null}
          pendingPayment={pendingWorkspacePayment}
          pendingOrderId={pendingWorkspacePayment?.orderId || pendingWorkspacePaymentOrderIdRef.current}
          pendingPaymentStartedAt={pendingWorkspacePayment?.createdAt ? new Date(pendingWorkspacePayment.createdAt).getTime() : pendingWorkspacePaymentStartedAt}
          isResolvingWorkspaceContext={isResolvingWorkspaceContext}
          invites={workspaceInvites}
          members={workspaceMembers}
          workspaceJoinCredentials={workspaceJoinCredentials}
          workspaceJoinSecret={workspaceJoinSecret}
          selectedPlanType={selectedWorkspacePlan}
          isStartingCheckout={isStartingWorkspaceCheckout}
          isRefreshingPayment={isRefreshingWorkspacePayment}
          isFinalizingActivation={isFinalizingWorkspaceActivation}
          isReturningToLogin={isReturningToLogin}
          paymentError={workspacePaymentError}
          onPlanChange={setSelectedWorkspacePlan}
          onJoinWorkspace={handleJoinWorkspace}
          onStartCheckout={handleStartWorkspaceCheckout}
          onReturnToLogin={handleBackFromOnboarding}
          onOpenWorkspaceAccess={handleOpenWorkspaceAccess}
          onContinueToWorkspace={() => {
            syncPendingWorkspacePaymentOrderId(null)
            setPendingWorkspacePayment(null)
            setWorkspacePaymentError('')
            setIsFinalizingWorkspaceActivation(false)
            syncWorkspaceActivationSuccess(false)
            navigateToView('projects')
          }}
          onCreateInvite={handleCreateWorkspaceInvite}
          onRotateWorkspaceCredentials={handleRotateWorkspaceCredentials}
          onRevokeInvite={handleRevokeWorkspaceInvite}
        />

        {guestCheckoutPlan && (
          <GuestCheckoutAuthModal
            planType={guestCheckoutPlan}
            onAuthSuccess={handleAuthSuccess}
            onContinueToCheckout={async (planType, authenticatedUser) => {
              clearSavedPendingWorkspaceAction()
              setGuestCheckoutPlan(null)
              await handleStartWorkspaceCheckout(planType, { authenticatedUser })
            }}
            onCancel={(options) => {
              if (!options?.preservePendingAction) {
                clearSavedPendingWorkspaceAction()
              }
              setGuestCheckoutPlan(null)
            }}
          />
        )}

        {guestWorkspaceJoinRequest && (
          <GuestCheckoutAuthModal
            continuation="workspaceJoin"
            workspaceLogin={guestWorkspaceJoinRequest.workspaceLogin}
            onAuthSuccess={handleAuthSuccess}
            onContinueToWorkspaceJoin={async (authenticatedUser) => {
              const joinRequest = guestWorkspaceJoinRequest

              if (!joinRequest) {
                throw new Error('Workspace credentials were not found. Please enter them again.')
              }

              clearSavedPendingWorkspaceAction()
              await handleJoinWorkspace(joinRequest, { authenticatedUser })
              setGuestWorkspaceJoinRequest(null)
            }}
            onCancel={(options) => {
              if (!options?.preservePendingAction) {
                clearSavedPendingWorkspaceAction()
              }
              setGuestWorkspaceJoinRequest(null)
            }}
          />
        )}
        {workspaceInviteModalElement}
        {workspaceJoinRequestModalElement}
        {studioNoticeModalElement}
      </>
    )
  }

  // Сторінка списку проєктів
  if (view === 'projects') {
    return (
      <>
        <ProjectsList
          projects={projects}
          editingProjectId={editingProjectId}
          onNewProject={handleNewProject}
          onEditProject={handleEditProject}
          onUpdateProject={handleUpdateProject}
          onSetEditingId={setEditingProjectId}
          onProjectPreview={handleProjectPreview}
          onProjectExport={handleProjectExport}
          onDeleteProject={handleDeleteProject}
          onOpenWorkspaceAccess={handleOpenWorkspaceAccess}
          onOpenWorkspaceJoin={canJoinTeamWorkspaceFromHeader ? () => setIsWorkspaceJoinModalOpen(true) : undefined}
          activeWorkspace={activeWorkspace}
          accessibleWorkspaces={accessibleWorkspaces}
          workflowProfile={workflowProfile}
          notifications={projectNotifications}
          unreadNotificationCount={unreadProjectNotificationCount}
          onNotificationSelect={handleProjectNotificationSelect}
          onMarkAllNotificationsRead={handleMarkAllProjectNotificationsRead}
          onClearNotifications={handleClearProjectNotifications}
          onWorkspaceChange={handleWorkspaceChange}
          onSignOut={handleReturnToLogin}
          onOpenCabinet={(tab = 'profile', options = {}) => {
            setCabinetInitialTab(tab)
            setCabinetInitialMember(options.member || null)
            navigateToView('cabinet')
          }}
          isGuest={isGuest}
        />
        {showProjectModal && (
          <ProjectModal
            projectName={projectName}
            projectStatus={projectStatus}
            projectFormat={projectFormat}
            screenFormat={projectScreenFormat}
            developerId={projectDeveloperId}
            qaId={projectQaId}
            assignableUsers={projectAssignableUsers}
            canAssignProjectMembers={canAssignProjectMembers}
            onNameChange={setProjectName}
            onStatusChange={setProjectStatus}
            onFormatChange={setProjectFormat}
            onScreenFormatChange={setProjectScreenFormat}
            onDeveloperChange={setProjectDeveloperId}
            onQaChange={setProjectQaId}
            onClose={handleCloseModal}
            onSave={async () => {
              const created = await handleCreateProject(false)
              if (created) {
                setShowProjectModal(false)
              }
            }}
            onSaveAndOpen={async () => {
              const created = await handleCreateProject(true)
              if (created) {
                setShowProjectModal(false)
              }
            }}
          />
        )}
        {workspaceInviteModalElement}
        {workspaceJoinModalElement}
        {workspaceJoinRequestModalElement}
        {studioNoticeModalElement}
      </>
    )
  }

  // Сторінка кабінету користувача
  if (view === 'cabinet') {
    if (isGuest) {
      navigateToView('projects', { replace: true })
      return null
    }
    return (
      <>
        <UserCabinet
          projects={projects}
          activeWorkspace={activeWorkspace}
          accessibleWorkspaces={accessibleWorkspaces}
          workspaceMembers={workspaceMembers}
          workspaceInvites={workspaceInvites}
          workspaceJoinCredentials={workspaceJoinCredentials}
          workspaceJoinSecret={workspaceJoinSecret}
          initialActiveTab={cabinetInitialTab}
          initialSelectedMember={cabinetInitialMember}
          notifications={projectNotifications}
          unreadNotificationCount={unreadProjectNotificationCount}
          onNotificationSelect={handleProjectNotificationSelect}
          onMarkAllNotificationsRead={handleMarkAllProjectNotificationsRead}
          onClearNotifications={handleClearProjectNotifications}
          onWorkspaceChange={handleWorkspaceChange}
          onOpenWorkspaceJoin={canJoinTeamWorkspaceFromHeader ? () => setIsWorkspaceJoinModalOpen(true) : undefined}
          onCreateWorkspaceInvite={handleCreateWorkspaceInvite}
          onRevokeWorkspaceInvite={handleRevokeWorkspaceInvite}
          onUpdateWorkspaceMemberRole={handleUpdateWorkspaceMemberRole}
          onRemoveWorkspaceMember={handleRemoveWorkspaceMember}
          onRotateWorkspaceCredentials={handleRotateWorkspaceCredentials}
          onRefreshWorkspaceData={async () => {
            if (activeWorkspace?.workspaceId) {
              await loadWorkspaceSupportData(activeWorkspace)
            }
          }}
          onBack={() => {
            setCabinetInitialTab('profile')
            setCabinetInitialMember(null)
            navigateToView('projects')
          }}
          onSignOut={handleReturnToLogin}
          onEditProject={handleEditProject}
          onProjectPreview={handleProjectPreview}
          onProjectExport={handleProjectExport}
          onDeleteProject={handleDeleteProject}
        />
        {workspaceInviteModalElement}
        {workspaceJoinModalElement}
        {workspaceJoinRequestModalElement}
        {studioNoticeModalElement}
      </>
    )
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const selectedImage = images.find(img => img.id === selectedImageId)
  
  // Сторінка редактора проєкту
  if (view === 'editor' && currentProject) {
    return (
    <div className="studio-root">
      <div className="studio-shell-top">
        <MenuBar
          showDocumentMenu={showDocumentMenu}
          onToggleDocumentMenu={() => setShowDocumentMenu(!showDocumentMenu)}
          onLandscapePreview={handleLandscapePreview}
          onPortraitPreview={handlePortraitPreview}
          screenFormat={screenFormat}
          onExport={handleExport}
          onSave={handleSave}
          onSaveAndQuit={handleSaveAndQuit}
          onLogoClick={handleEditorBack}
          isSaved={isSaved}
          project={currentProject}
        />

      </div>

      <div className="studio-content">
        <InspectorPanel
          selectedImage={selectedImage}
          selectedImageId={selectedImageId}
          onUpdateProperty={handleUpdateImageProperty}
          onScaleImage={handleScaleImage}
        />

        <Canvas
          previewRef={previewRef}
          images={images}
          selectedImageId={selectedImageId}
          draggingImageId={draggingImageId}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(e)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (draggingImageId) {
              handleImageDrag(e)
            } else {
              handleDragOver(e)
            }
          }}
          onMouseMove={(e) => {
            if (resizingImageId) {
              handleResize(e)
            } else if (draggingImageId) {
              handleImageDrag(e)
            }
          }}
          onMouseUp={(e) => {
            if (resizingImageId) {
              handleResizeEnd(e)
            } else if (draggingImageId) {
              handleImageDragEnd(e)
            }
          }}
          onMouseLeave={(e) => {
            if (resizingImageId) {
              handleResizeEnd(e)
            } else if (draggingImageId) {
              handleImageDragEnd(e)
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget || e.target.classList.contains('canvas-grid')) {
              setSelectedImageId(null)
            }
          }}
          onImageClick={setSelectedImageId}
          onImageDragStart={handleImageDragStart}
          onResizeStart={handleResizeStart}
          sceneBackground={sceneBackground}
          sceneBorderStyle={sceneBorderStyle}
          sceneBorderColor={sceneBorderColor}
          editingTextId={editingTextId}
          onTextEdit={setEditingTextId}
          onTextChange={(id, text) => {
            // Оновлюємо текст в реальному часі при редагуванні
            setImages(prev => prev.map(img => 
              img.id === id ? { ...img, text: text } : img
            ))
            setIsSaved(false) // Позначаємо проєкт як незбережений при зміні тексту
          }}
          onTextBlur={(id, text) => {
            // При втраті фокуса зберігаємо текст і виходимо з режиму редагування
            setImages(prev => prev.map(img => 
              img.id === id ? { ...img, text: text || 'Новый текст' } : img
            ))
            setEditingTextId(null)
          }}
          screenFormat={screenFormat}
        />

        <DocumentPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          totalCreativeSize={totalCreativeSize}
          onShowLayers={() => setShowLayersModal(true)}
          onShowJSEditor={() => setShowJSEditor(true)}
          onShowCSSEditor={() => setShowCSSEditor(true)}
          onDeleteLayer={handleDeleteLayer}
          onSelectLayer={setSelectedImageId}
          selectedImageId={selectedImageId}
          images={images}
          sceneBackground={sceneBackground}
          sceneBorderStyle={sceneBorderStyle}
          sceneBorderColor={sceneBorderColor}
          onSceneBackgroundChange={(value) => {
            setSceneBackground(value)
            setIsSaved(false) // Позначаємо проєкт як незбережений при зміні властивостей сцены
          }}
          onSceneBorderStyleChange={(value) => {
            setSceneBorderStyle(value)
            setIsSaved(false)
          }}
          onSceneBorderColorChange={(value) => {
            setSceneBorderColor(value)
            setIsSaved(false)
          }}
          screenFormat={screenFormat}
        />
          </div>

      <div className="studio-hidden-upload">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          id="studio-file-input"
        />
          </div>

      <button
        className="studio-add-button"
        onClick={() => setShowAddMenu(true)}
        title="Add layer"
        aria-label="Add new layer"
      >
        <span className="studio-add-button__icon">+</span>
        <span>Add layer</span>
      </button>

      {/* Модальное окно выбора типа контента */}
      {showAddMenu && (
        <div className="modal-overlay" onClick={() => setShowAddMenu(false)}>
          <div className="modal-dialog add-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header add-content-header">
              <div>
                <span className="editor-modal-eyebrow">Add layer</span>
                <h2 className="modal-title">What would you like to add?</h2>
              </div>
              <button className="modal-close add-content-close" onClick={() => setShowAddMenu(false)} aria-label="Close add layer modal">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="add-content-options">
                <button
                  className="add-content-option add-content-option-image"
                  onClick={() => {
                    setShowAddMenu(false)
                    document.getElementById('studio-file-input').click()
                  }}
                >
                  <div className="add-content-icon">
                    <ImageIcon size={22} />
                  </div>
                  <div className="add-content-label">Image layer</div>
                  <div className="add-content-description">
                    Upload or link an asset. Supports PNG, JPG, SVG, and WebP up to 20 MB.
                  </div>
                </button>
                <button
                  className="add-content-option add-content-option-text"
                  onClick={() => {
                    setShowAddMenu(false)
                    handleAddText()
                  }}
                >
                  <div className="add-content-icon">
                    <Type size={22} />
                  </div>
                  <div className="add-content-label">Text layer</div>
                  <div className="add-content-description">
                    Create a typographic layer with positioning, tracking, and motion support.
                  </div>
                </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {showJSEditor && (
        <JSEditor
          code={code}
          images={images}
          sceneBackground={sceneBackground}
          screenFormat={screenFormat}
          onCodeChange={(newCode) => {
            setCode(newCode)
            setIsSaved(false) // Помечаем проект как несохраненный при изменении кода
          }}
          onApply={() => {
            compileCode(false)
            setShowJSEditor(false)
          }}
          onClose={() => setShowJSEditor(false)}
        />
      )}

      {showCSSEditor && (
        <CSSEditor
          cssCode={cssCode}
          images={images}
          sceneBackground={sceneBackground}
          onCssChange={(newCss) => {
            setCssCode(newCss)
            setIsSaved(false) // Помечаем проект как несохраненный при изменении CSS
          }}
          onApply={() => setShowCSSEditor(false)}
          onClose={() => setShowCSSEditor(false)}
        />
      )}

      {showLayersModal && (
        <LayersWindow
          images={images}
          projectName={currentProject?.name}
          selectedImageId={selectedImageId}
          editingLayerId={editingLayerId}
          draggedLayerIndex={draggedLayerIndex}
          layersWindowPosition={layersWindowPosition}
          draggingLayersWindow={draggingLayersWindow}
          onClose={() => setShowLayersModal(false)}
          onSelectImage={setSelectedImageId}
          onRenameLayer={handleRenameLayer}
          onDeleteLayer={handleDeleteLayer}
          onLayerDragStart={handleLayerDragStart}
          onLayerDragOver={handleLayerDragOver}
          onLayerDragEnd={handleLayerDragEnd}
          onWindowDragStart={handleLayersWindowDragStart}
          onSetEditingId={setEditingLayerId}
          onUpdateImageName={(imageId, newName) => {
            setImages(prev => prev.map(img => 
              img.id === imageId ? { ...img, name: newName } : img
            ))
          }}
        />
      )}

      {showUnsavedChangesModal && (
        <UnsavedChangesModal
          projectName={currentProject?.name}
          isSaving={isLeavingEditor}
          onCancel={handleCloseUnsavedChangesModal}
          onDiscard={handleDiscardAndLeaveEditor}
          onSaveAndLeave={handleSaveAndLeaveFromModal}
        />
      )}

      {studioNoticeModalElement}

      <div className="studio-code-panel-hidden">
          <textarea
          className="code-editor-hidden"
            value={code}
            onChange={event => setCode(event.target.value)}
            spellCheck="false"
          />
        <div className="studio-controls-hidden">
          <button onClick={() => compileCode(false)}>Compile</button>
          <button onClick={handlePreview}>Preview</button>
          </div>
          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
          </div>

    </div>
  )
  }

  return null
}

export default App


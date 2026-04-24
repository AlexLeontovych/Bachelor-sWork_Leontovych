import { supabase } from '../lib/supabase'
import {
  getWorkflowTeamRole,
  normalizeProjectStatus
} from '../components/shared/utils/projectWorkflow'
import { getCurrentWorkspaceProfile } from './workspaceService'

// Допоміжна функція для логування з часом
const logWithTime = (message, data = null) => {
  const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
  if (data !== null) {
    console.log(`[${time}] [БД ДЕБАГ] ${message}`, data)
  } else {
    console.log(`[${time}] [БД ДЕБАГ] ${message}`)
  }
}

const logError = (message, error) => {
  const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
  console.error(`[${time}] [БД ДЕБАГ] ❌ ${message}`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    stack: error?.stack
  })
}

const getCurrentActorContext = async (workspaceId = null) => {
  const actorStartTime = performance.now()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    const actorDuration = (performance.now() - actorStartTime).toFixed(2)

    if (userError) {
      logError(`getCurrentActorContext: Помилка отримання користувача (${actorDuration}ms)`, userError)
      throw userError
    }

    if (!user) {
      throw new Error('User not authenticated')
    }

    let actorProfile = null

    if (workspaceId) {
      actorProfile = await getCurrentWorkspaceProfile(workspaceId)
    } else {
      const profileStartTime = performance.now()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const profileDuration = (performance.now() - profileStartTime).toFixed(2)

      if (profileError) {
        logError(`getCurrentActorContext: Помилка отримання профілю (${profileDuration}ms)`, profileError)
        throw profileError
      }

      actorProfile = profile
    }

    actorProfile = actorProfile || {
      id: user.id,
      role: 'user',
      team_role: 'developer',
      email: user.email
    }

    logWithTime(`getCurrentActorContext: Контекст користувача отримано (${actorDuration}ms)`, {
      userId: user.id,
      role: actorProfile.role,
      teamRole: actorProfile.team_role
    })

    return { user, profile: actorProfile }
  } catch (error) {
    logError('getCurrentActorContext: Критична помилка', error)
    throw error
  }
}

// Отримати всі проєкти поточного користувача
export const getUserProjects = async (workspaceId) => {
  const startTime = performance.now()
  logWithTime('getUserProjects: Початок запиту')
  
  try {
    if (!workspaceId) {
      throw new Error('A workspace identifier is required to load projects.')
    }

    const { user, profile } = await getCurrentActorContext(workspaceId)
    const query = supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    const queryStartTime = performance.now()
    const { data, error } = await query
    
    const queryDuration = (performance.now() - queryStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)

    logWithTime(`getUserProjects: Результат запиту (${queryDuration}ms)`, {
      dataCount: data ? data.length : 0,
      hasData: !!data,
      hasError: !!error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      } : null
    })

    if (error) {
      logError(`getUserProjects: Помилка отримання проєктів (загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`getUserProjects: Успішно (загалом ${totalDuration}ms)`, {
      projectsCount: data?.length || 0,
      userId: user.id,
      role: profile.role,
      teamRole: getWorkflowTeamRole(profile),
      workspaceId
    })
    return data || []
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getUserProjects: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

export const getAccessibleProjects = async (workspaceId) => {
  try {
    return await getUserProjects(workspaceId)
  } catch (error) {
    logError('getAccessibleProjects: Критична помилка', error)
    throw error
  }
}

export const getWorkspaceMemberProjects = async (workspaceId, memberUserId) => {
  const startTime = performance.now()

  try {
    if (!workspaceId) {
      throw new Error('A workspace identifier is required to load member projects.')
    }

    if (!memberUserId) {
      throw new Error('A member user identifier is required to load member projects.')
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`user_id.eq.${memberUserId},developer_id.eq.${memberUserId},qa_id.eq.${memberUserId}`)
      .order('created_at', { ascending: false })

    if (error) {
      logError('getWorkspaceMemberProjects: Помилка отримання проєктів учасника', error)
      throw error
    }

    logWithTime(`getWorkspaceMemberProjects: Успішно (${(performance.now() - startTime).toFixed(2)}ms)`, {
      workspaceId,
      memberUserId,
      projectsCount: data?.length || 0
    })

    return data || []
  } catch (error) {
    logError(`getWorkspaceMemberProjects: Критична помилка (${(performance.now() - startTime).toFixed(2)}ms)`, error)
    throw error
  }
}

// Отримати всі проєкти (для адміністраторів та гостей)
export const getAllProjects = async () => {
  const startTime = performance.now()
  logWithTime('getAllProjects: Початок запиту')
  
  try {
    logWithTime('getAllProjects: Запит всіх проєктів з БД', {
      table: 'projects',
      filter: 'none (all projects)'
    })
    
    const queryStartTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    const queryDuration = (performance.now() - queryStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`getAllProjects: Помилка (${queryDuration}ms, загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`getAllProjects: Успішно (загалом ${totalDuration}ms)`, {
      projectsCount: data?.length || 0
    })
    
    return data || []
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getAllProjects: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Отримати всі проєкти для гостей (публічні проєкти)
// Використовує анонімний доступ через RLS політики
export const getPublicProjects = async () => {
  const startTime = performance.now()
  logWithTime('getPublicProjects: Початок запиту публічних проєктів')
  
  try {
    logWithTime('getPublicProjects: Запит до таблиці projects', {
      table: 'projects',
      access: 'anonymous (RLS policies)',
      filter: 'none (all public projects)'
    })
    
    const queryStartTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_public_preview', true)
      .order('created_at', { ascending: false })
    
    const queryDuration = (performance.now() - queryStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)

    logWithTime(`getPublicProjects: Результат запиту (${queryDuration}ms)`, {
      dataCount: data ? data.length : 0,
      hasData: !!data,
      hasError: !!error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      } : null
    })

    if (error) {
      logError(`getPublicProjects: Помилка отримання проєктів (загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`getPublicProjects: Успішно (загалом ${totalDuration}ms)`, {
      projectsCount: data?.length || 0
    })
    return data || []
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getPublicProjects: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Створити новий проєкт
export const createProject = async (projectData, workspaceId) => {
  const startTime = performance.now()
  logWithTime('createProject: Початок створення проєкту', {
    name: projectData.name,
    status: projectData.status,
    format: projectData.format,
    screenFormat: projectData.screenFormat || projectData.screen_format
  })
  
  try {
    if (!workspaceId) {
      throw new Error('A workspace identifier is required to create a project.')
    }

    const { user, profile } = await getCurrentActorContext(workspaceId)
    const workflowTeamRole = getWorkflowTeamRole(profile)
    const isWorkspaceLead = profile.role === 'admin' || profile.workspace_role === 'owner' || profile.workspaceRole === 'owner'

    if (!isWorkspaceLead && workflowTeamRole !== 'developer') {
      throw new Error('Only team leads and developers can create projects.')
    }

    const requestedDeveloperId = projectData.developerId || projectData.developer_id || null
    const requestedQaId = projectData.qaId || projectData.qa_id || null
    
    const projectToInsert = {
      workspace_id: workspaceId,
      user_id: user.id,
      name: projectData.name,
      status: normalizeProjectStatus(projectData.status),
      format: projectData.format,
      screen_format: projectData.screenFormat || projectData.screen_format || 'landscape',
      images: projectData.images || [],
      code: projectData.code || '',
      css_code: projectData.cssCode || projectData.css_code || '',
      scene_background: projectData.sceneBackground || projectData.scene_background || '#ffffff',
      scene_border_style: projectData.sceneBorderStyle || projectData.scene_border_style || 'none',
      scene_border_color: projectData.sceneBorderColor || projectData.scene_border_color || '#000000',
      developer_id: isWorkspaceLead ? (requestedDeveloperId || user.id) : user.id,
      qa_id: isWorkspaceLead
        ? (requestedQaId ?? ((profile.workspace_type || profile.workspaceType) === 'personal' ? user.id : null))
        : null,
      qa_handoff_note: projectData.qaHandoffNote || projectData.qa_handoff_note || null,
      qa_feedback_note: projectData.qaFeedbackNote || projectData.qa_feedback_note || null,
      is_archived: Boolean(projectData.isArchived ?? projectData.is_archived ?? false),
      archived_at: projectData.archivedAt || projectData.archived_at || null,
      archived_by: projectData.archivedBy || projectData.archived_by || null
    }
    
    logWithTime('createProject: Підготовка даних для вставки', {
      userId: projectToInsert.user_id,
      workspaceId: projectToInsert.workspace_id,
      name: projectToInsert.name,
      imagesCount: projectToInsert.images?.length || 0,
      codeLength: projectToInsert.code?.length || 0,
      cssCodeLength: projectToInsert.css_code?.length || 0,
      developerId: projectToInsert.developer_id,
      qaId: projectToInsert.qa_id,
      teamRole: workflowTeamRole
    })
    
    logWithTime('createProject: Вставка проєкту в БД')
    const insertStartTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .insert(projectToInsert)
      .select()
      .single()
    
    const insertDuration = (performance.now() - insertStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`createProject: Помилка вставки (${insertDuration}ms, загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`createProject: Проєкт створено успішно (загалом ${totalDuration}ms)`, {
      projectId: data?.id,
      name: data?.name,
      userId: data?.user_id
    })
    
    return data
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`createProject: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Оновити проєкт
export const updateProject = async (projectId, updates) => {
  const startTime = performance.now()
  logWithTime('updateProject: Початок оновлення проєкту', {
    projectId,
    updatesKeys: Object.keys(updates),
    updates
  })
  
  try {
    const updateData = {}
    
    // Перетворюємо camelCase в snake_case для БД
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.format !== undefined) updateData.format = updates.format
    if (updates.screenFormat !== undefined || updates.screen_format !== undefined) {
      updateData.screen_format = updates.screenFormat || updates.screen_format
    }
    if (updates.images !== undefined) {
      updateData.images = updates.images
      logWithTime('updateProject: Оновлення зображень', {
        imagesCount: updates.images?.length || 0
      })
    }
    if (updates.code !== undefined) {
      updateData.code = updates.code
      logWithTime('updateProject: Оновлення коду', {
        codeLength: updates.code?.length || 0
      })
    }
    if (updates.cssCode !== undefined || updates.css_code !== undefined) {
      updateData.css_code = updates.cssCode || updates.css_code
      logWithTime('updateProject: Оновлення CSS коду', {
        cssCodeLength: (updates.cssCode || updates.css_code)?.length || 0
      })
    }
    if (updates.sceneBackground !== undefined || updates.scene_background !== undefined) {
      updateData.scene_background = updates.sceneBackground || updates.scene_background
    }
    if (updates.sceneBorderStyle !== undefined || updates.scene_border_style !== undefined) {
      updateData.scene_border_style = updates.sceneBorderStyle || updates.scene_border_style
    }
    if (updates.sceneBorderColor !== undefined || updates.scene_border_color !== undefined) {
      updateData.scene_border_color = updates.sceneBorderColor || updates.scene_border_color
    }
    if (updates.developerId !== undefined || updates.developer_id !== undefined) {
      updateData.developer_id = updates.developerId ?? updates.developer_id ?? null
    }
    if (updates.qaId !== undefined || updates.qa_id !== undefined) {
      updateData.qa_id = updates.qaId ?? updates.qa_id ?? null
    }
    if (updates.status !== undefined) {
      updateData.status = normalizeProjectStatus(updates.status)
    }
    if (updates.qaHandoffNote !== undefined || updates.qa_handoff_note !== undefined) {
      updateData.qa_handoff_note = updates.qaHandoffNote ?? updates.qa_handoff_note ?? null
    }
    if (updates.qaFeedbackNote !== undefined || updates.qa_feedback_note !== undefined) {
      updateData.qa_feedback_note = updates.qaFeedbackNote ?? updates.qa_feedback_note ?? null
    }
    if (updates.isArchived !== undefined || updates.is_archived !== undefined) {
      updateData.is_archived = Boolean(updates.isArchived ?? updates.is_archived)
    }
    if (updates.archivedAt !== undefined || updates.archived_at !== undefined) {
      updateData.archived_at = updates.archivedAt ?? updates.archived_at ?? null
    }
    if (updates.archivedBy !== undefined || updates.archived_by !== undefined) {
      updateData.archived_by = updates.archivedBy ?? updates.archived_by ?? null
    }
    
    logWithTime('updateProject: Підготовка даних для оновлення', {
      projectId,
      updateDataKeys: Object.keys(updateData),
      updateData
    })
    
    logWithTime('updateProject: Оновлення проєкту в БД')
    const updateStartTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single()
    
    const updateDuration = (performance.now() - updateStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      const normalizedError = error.message?.includes('Cannot coerce the result to a single JSON object')
        ? new Error('Project not found or you do not have permission to update it.')
        : error

      logError(`updateProject: Помилка оновлення (${updateDuration}ms, загалом ${totalDuration}ms)`, normalizedError)
      throw normalizedError
    }
    
    logWithTime(`updateProject: Проєкт оновлено успішно (загалом ${totalDuration}ms)`, {
      projectId: data?.id,
      updatedFields: Object.keys(updateData)
    })
    
    return data
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`updateProject: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Видалити проєкт
export const deleteProject = async (projectId) => {
  const startTime = performance.now()
  logWithTime('deleteProject: Початок видалення проєкту', { projectId })
  
  try {
    logWithTime('deleteProject: Видалення проєкту з БД')
    const deleteStartTime = performance.now()
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    const deleteDuration = (performance.now() - deleteStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`deleteProject: Помилка видалення (${deleteDuration}ms, загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`deleteProject: Проєкт видалено успішно (загалом ${totalDuration}ms)`, {
      projectId
    })
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`deleteProject: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Перетворити проєкт з формату БД в формат додатку
export const transformProjectFromDB = (dbProject) => {
  logWithTime('transformProjectFromDB: Перетворення проєкту', {
    projectId: dbProject?.id,
    name: dbProject?.name
  })
  
  const transformed = {
    id: dbProject.id,
    name: dbProject.name,
    status: normalizeProjectStatus(dbProject.status),
    format: dbProject.format,
    screenFormat: dbProject.screen_format,
    images: dbProject.images || [],
    code: dbProject.code || '',
    cssCode: dbProject.css_code || '',
    sceneBackground: dbProject.scene_background || '#ffffff',
    sceneBorderStyle: dbProject.scene_border_style || 'none',
    sceneBorderColor: dbProject.scene_border_color || '#000000',
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
    workspace_id: dbProject.workspace_id,
    workspaceId: dbProject.workspace_id,
    is_public_preview: Boolean(dbProject.is_public_preview),
    isPublicPreview: Boolean(dbProject.is_public_preview),
    // Додаємо user_id для фільтрації
    user_id: dbProject.user_id,
    userId: dbProject.user_id,
    developer_id: dbProject.developer_id,
    developerId: dbProject.developer_id,
    qa_id: dbProject.qa_id,
    qaId: dbProject.qa_id,
    qa_handoff_note: dbProject.qa_handoff_note || '',
    qaHandoffNote: dbProject.qa_handoff_note || '',
    qa_feedback_note: dbProject.qa_feedback_note || '',
    qaFeedbackNote: dbProject.qa_feedback_note || '',
    is_archived: Boolean(dbProject.is_archived),
    isArchived: Boolean(dbProject.is_archived),
    archived_at: dbProject.archived_at,
    archivedAt: dbProject.archived_at,
    archived_by: dbProject.archived_by,
    archivedBy: dbProject.archived_by,
    // Для зворотної сумісності
    screen_format: dbProject.screen_format,
    created_at: dbProject.created_at,
    updated_at: dbProject.updated_at
  }
  
  logWithTime('transformProjectFromDB: Перетворення завершено', {
    projectId: transformed.id,
    imagesCount: transformed.images?.length || 0
  })
  
  return transformed
}

// Перетворити проєкт з формату додатку в формат БД
export const transformProjectToDB = (appProject) => {
  logWithTime('transformProjectToDB: Перетворення проєкту для БД', {
    projectId: appProject?.id,
    name: appProject?.name
  })
  
  const transformed = {
    name: appProject.name,
    status: normalizeProjectStatus(appProject.status),
    workspace_id: appProject.workspaceId || appProject.workspace_id || null,
    format: appProject.format,
    screen_format: appProject.screenFormat || appProject.screen_format || 'landscape',
    images: appProject.images || [],
    code: appProject.code || '',
    css_code: appProject.cssCode || appProject.css_code || '',
    scene_background: appProject.sceneBackground || appProject.scene_background || '#ffffff',
    scene_border_style: appProject.sceneBorderStyle || appProject.scene_border_style || 'none',
    scene_border_color: appProject.sceneBorderColor || appProject.scene_border_color || '#000000',
    developer_id: appProject.developerId || appProject.developer_id || null,
    qa_id: appProject.qaId || appProject.qa_id || null,
    qa_handoff_note: appProject.qaHandoffNote || appProject.qa_handoff_note || null,
    qa_feedback_note: appProject.qaFeedbackNote || appProject.qa_feedback_note || null,
    is_archived: Boolean(appProject.isArchived ?? appProject.is_archived ?? false),
    archived_at: appProject.archivedAt || appProject.archived_at || null,
    archived_by: appProject.archivedBy || appProject.archived_by || null,
    is_public_preview: Boolean(appProject.isPublicPreview ?? appProject.is_public_preview ?? false)
  }
  
  logWithTime('transformProjectToDB: Перетворення завершено', {
    imagesCount: transformed.images?.length || 0,
    codeLength: transformed.code?.length || 0
  })
  
  return transformed
}


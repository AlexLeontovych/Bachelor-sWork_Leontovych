import { supabase } from '../lib/supabase'

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

// Отримати всі проєкти поточного користувача
export const getUserProjects = async () => {
  const startTime = performance.now()
  logWithTime('getUserProjects: Початок запиту')
  
  try {
    logWithTime('getUserProjects: Отримання поточного користувача')
    const userStartTime = performance.now()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    const userDuration = (performance.now() - userStartTime).toFixed(2)
    
    if (userError) {
      logError(`getUserProjects: Помилка отримання користувача (${userDuration}ms)`, userError)
      throw userError
    }
    
    if (!user) {
      logError('getUserProjects: Користувач не автентифікований')
      throw new Error('User not authenticated')
    }

    logWithTime(`getUserProjects: Користувач отримано (${userDuration}ms)`, {
      userId: user.id,
      email: user.email
    })
    
    logWithTime('getUserProjects: Запит проєктів з БД', {
      userId: user.id,
      table: 'projects',
      filter: `user_id = ${user.id}`
    })
    
    const queryStartTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
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
      userId: user.id
    })
    return data || []
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getUserProjects: Критична помилка (${duration}ms)`, error)
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
export const createProject = async (projectData) => {
  const startTime = performance.now()
  logWithTime('createProject: Початок створення проєкту', {
    name: projectData.name,
    status: projectData.status,
    format: projectData.format,
    screenFormat: projectData.screenFormat || projectData.screen_format
  })
  
  try {
    logWithTime('createProject: Отримання поточного користувача')
    const userStartTime = performance.now()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    const userDuration = (performance.now() - userStartTime).toFixed(2)
    
    if (userError) {
      logError(`createProject: Помилка отримання користувача (${userDuration}ms)`, userError)
      throw userError
    }
    
    if (!user) {
      logError('createProject: Користувач не автентифікований')
      throw new Error('User not authenticated')
    }
    
    logWithTime(`createProject: Користувач отримано (${userDuration}ms)`, {
      userId: user.id
    })
    
    const projectToInsert = {
      user_id: user.id,
      name: projectData.name,
      status: projectData.status,
      format: projectData.format,
      screen_format: projectData.screenFormat || projectData.screen_format || 'landscape',
      images: projectData.images || [],
      code: projectData.code || '',
      css_code: projectData.cssCode || projectData.css_code || '',
      scene_background: projectData.sceneBackground || projectData.scene_background || '#ffffff',
      scene_border_style: projectData.sceneBorderStyle || projectData.scene_border_style || 'none',
      scene_border_color: projectData.sceneBorderColor || projectData.scene_border_color || '#000000'
    }
    
    logWithTime('createProject: Підготовка даних для вставки', {
      userId: projectToInsert.user_id,
      name: projectToInsert.name,
      imagesCount: projectToInsert.images?.length || 0,
      codeLength: projectToInsert.code?.length || 0,
      cssCodeLength: projectToInsert.css_code?.length || 0
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
      logError(`updateProject: Помилка оновлення (${updateDuration}ms, загалом ${totalDuration}ms)`, error)
      throw error
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
    status: dbProject.status,
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
    // Додаємо user_id для фільтрації
    user_id: dbProject.user_id,
    userId: dbProject.user_id,
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
    status: appProject.status,
    format: appProject.format,
    screen_format: appProject.screenFormat || appProject.screen_format || 'landscape',
    images: appProject.images || [],
    code: appProject.code || '',
    css_code: appProject.cssCode || appProject.css_code || '',
    scene_background: appProject.sceneBackground || appProject.scene_background || '#ffffff',
    scene_border_style: appProject.sceneBorderStyle || appProject.scene_border_style || 'none',
    scene_border_color: appProject.sceneBorderColor || appProject.scene_border_color || '#000000'
  }
  
  logWithTime('transformProjectToDB: Перетворення завершено', {
    imagesCount: transformed.images?.length || 0,
    codeLength: transformed.code?.length || 0
  })
  
  return transformed
}


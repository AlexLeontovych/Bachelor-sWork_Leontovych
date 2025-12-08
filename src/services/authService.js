import { supabase } from '../lib/supabase'

// Допоміжна функція для логування з часом
const logWithTime = (message, data = null) => {
  const timestamp = new Date().toISOString()
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

// Отримати поточного користувача
export const getCurrentUser = async () => {
  const startTime = performance.now()
  logWithTime('getCurrentUser: Початок запиту')
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    const duration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`getCurrentUser: Помилка (${duration}ms)`, error)
      throw error
    }
    
    logWithTime(`getCurrentUser: Успішно (${duration}ms)`, {
      userId: user?.id,
      email: user?.email,
      hasUser: !!user
    })
    return user
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getCurrentUser: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Перевірити, чи є поточний користувач адміністратором
export const isAdmin = async () => {
  const startTime = performance.now()
  logWithTime('isAdmin: Початок перевірки')
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      logWithTime('isAdmin: Користувач не знайдено')
      return false
    }

    logWithTime('isAdmin: Запит профілю', { userId: user.id })
    const profileStartTime = performance.now()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const profileDuration = (performance.now() - profileStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)

    if (error) {
      logError(`isAdmin: Помилка запиту профілю (${profileDuration}ms)`, error)
      return false
    }
    
    if (!data) {
      logWithTime(`isAdmin: Профіль не знайдено (${totalDuration}ms)`)
      return false
    }
    
    const isAdminResult = data.role === 'admin'
    logWithTime(`isAdmin: Результат (${totalDuration}ms)`, {
      userId: user.id,
      role: data.role,
      isAdmin: isAdminResult
    })
    
    return isAdminResult
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`isAdmin: Критична помилка (${duration}ms)`, error)
    return false
  }
}

// Отримати профіль поточного користувача
export const getCurrentProfile = async () => {
  const startTime = performance.now()
  logWithTime('getCurrentProfile: Початок запиту')
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      logWithTime('getCurrentProfile: Користувач не знайдено')
      return null
    }

    logWithTime('getCurrentProfile: Запит профілю', { userId: user.id })
    const profileStartTime = performance.now()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    const duration = (performance.now() - startTime).toFixed(2)

    if (error) {
      logError(`getCurrentProfile: Помилка (${duration}ms)`, error)
      throw error
    }
    
    logWithTime(`getCurrentProfile: Успішно (${duration}ms)`, {
      userId: data?.id,
      hasData: !!data
    })
    return data
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getCurrentProfile: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Реєстрація користувача
export const signUp = async (email, password, fullName = null) => {
  const startTime = performance.now()
  logWithTime('signUp: Початок реєстрації', { email, hasFullName: !!fullName })
  
  try {
    const signUpStartTime = performance.now()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    const signUpDuration = (performance.now() - signUpStartTime).toFixed(2)
    const totalDuration = (performance.now() - startTime).toFixed(2)

    if (error) {
      logError(`signUp: Помилка реєстрації (${signUpDuration}ms, загалом ${totalDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`signUp: Реєстрація успішна (${signUpDuration}ms, загалом ${totalDuration}ms)`, {
      userId: data?.user?.id,
      email: data?.user?.email
    })
    return data
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`signUp: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Вхід користувача з перевіркою бану
export const signIn = async (email, password) => {
  const startTime = performance.now()
  logWithTime('signIn: Початок входу', { email })
  
  try {
    // Крок 1: Вхід через Supabase Auth
    logWithTime('signIn: Крок 1 - Виклик signInWithPassword')
    const signInStartTime = performance.now()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    const signInDuration = (performance.now() - signInStartTime).toFixed(2)
    
    if (error) {
      logError(`signIn: Помилка signInWithPassword (${signInDuration}ms)`, error)
      throw error
    }
    
    logWithTime(`signIn: Крок 1 успішний (${signInDuration}ms)`, {
      userId: data?.user?.id,
      email: data?.user?.email
    })
    
    // Крок 2: Перевірка бану
    logWithTime('signIn: Крок 2 - Перевірка бану користувача', { userId: data.user.id })
    const banCheckStartTime = performance.now()
    
    try {
      const { data: profile, error: profileError } = await Promise.race([
        supabase
          .from('profiles')
          .select('banned')
          .eq('id', data.user.id)
          .single(),
        new Promise((resolve) => 
          setTimeout(() => {
            logWithTime('signIn: Таймаут перевірки профілю (3 секунди)')
            resolve({ data: null, error: new Error('Profile check timeout') })
          }, 3000)
        )
      ])
      
      const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
      const totalDuration = (performance.now() - startTime).toFixed(2)
      
      logWithTime(`signIn: Крок 2 завершено (${banCheckDuration}ms)`, {
        hasProfile: !!profile,
        banned: profile?.banned,
        hasError: !!profileError,
        errorMessage: profileError?.message
      })
      
      // Якщо профіль не знайдено (новий користувач) або таймаут - пропускаємо перевірку бану
      if (profileError) {
        logWithTime(`signIn: Помилка отримання профілю, пропускаємо перевірку бану (загалом ${totalDuration}ms)`)
        return data
      }
      
      if (profile?.banned) {
        // Виходимо з акаунту, якщо користувач забанений
        logWithTime('signIn: Користувач забанений, вихід з системи')
        const signOutStartTime = performance.now()
        await supabase.auth.signOut()
        const signOutDuration = (performance.now() - signOutStartTime).toFixed(2)
        logWithTime(`signIn: Вихід виконано (${signOutDuration}ms)`)
        throw new Error('Ваш акаунт заблоковано. Зверніться до адміністратора.')
      }
      
      logWithTime(`signIn: Вхід завершено успішно (загалом ${totalDuration}ms)`, {
        userId: data.user.id,
        email: data.user.email,
        banned: false
      })
      return data
    } catch (banCheckError) {
      const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
      const totalDuration = (performance.now() - startTime).toFixed(2)
      logError(`signIn: Помилка при перевірці бану (${banCheckDuration}ms, загалом ${totalDuration}ms)`, banCheckError)
      // Продовжуємо навіть якщо не вдалося перевірити бан
      logWithTime(`signIn: Продовжуємо без перевірки бану (загалом ${totalDuration}ms)`)
      return data
    }
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`signIn: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Вихід користувача
export const signOut = async () => {
  const startTime = performance.now()
  logWithTime('signOut: Початок виходу')
  
  try {
    const { error } = await supabase.auth.signOut()
    const duration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`signOut: Помилка (${duration}ms)`, error)
      throw error
    }
    
    logWithTime(`signOut: Вихід успішний (${duration}ms)`)
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`signOut: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Отримати сесію користувача з перевіркою бану
export const getSession = async () => {
  const startTime = performance.now()
  logWithTime('getSession: Початок отримання сесії')
  
  try {
    // Крок 1: Отримання сесії
    logWithTime('getSession: Крок 1 - Виклик supabase.auth.getSession()')
    const sessionStartTime = performance.now()
    const { data: { session }, error } = await supabase.auth.getSession()
    const sessionDuration = (performance.now() - sessionStartTime).toFixed(2)
    
    // Обробляємо помилки refresh token
    if (error) {
      logError(`getSession: Помилка отримання сесії (${sessionDuration}ms)`, error)
      
      // Якщо помилка пов'язана з refresh token, очищуємо сесію
      if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid Refresh Token')) {
        logWithTime('getSession: Виявлено помилку refresh token, очищення сесії...')
        try {
          await supabase.auth.signOut()
          logWithTime('getSession: Сесію очищено')
        } catch (signOutError) {
          logError('getSession: Помилка при очищенні сесії', signOutError)
        }
      }
      
      return null
    }
    
    logWithTime(`getSession: Крок 1 успішний (${sessionDuration}ms)`, {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email
    })
    
    // Крок 2: Перевірка бану (якщо є сесія)
    if (session?.user) {
      logWithTime('getSession: Крок 2 - Перевірка статусу бану', { userId: session.user.id })
      const banCheckStartTime = performance.now()
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('banned')
          .eq('id', session.user.id)
          .single()
        
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        const totalDuration = (performance.now() - startTime).toFixed(2)
        
        logWithTime(`getSession: Крок 2 завершено (${banCheckDuration}ms)`, {
          hasProfile: !!profile,
          banned: profile?.banned,
          hasError: !!profileError,
          errorMessage: profileError?.message,
          errorCode: profileError?.code
        })
        
        // Перевіряємо бан тільки якщо профіль знайдено
        if (profileError) {
          // Якщо профіль не знайдено, це може бути новий користувач - продовжуємо
          logWithTime(`getSession: Профіль не знайдено, продовжуємо (загалом ${totalDuration}ms)`)
        } else if (profile?.banned) {
          // Якщо користувач забанений, виходимо
          logWithTime('getSession: Користувач забанений, вихід з системи')
          const signOutStartTime = performance.now()
          await supabase.auth.signOut()
          const signOutDuration = (performance.now() - signOutStartTime).toFixed(2)
          logWithTime(`getSession: Вихід виконано (${signOutDuration}ms)`)
          return null
        }
      } catch (profileError) {
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        const totalDuration = (performance.now() - startTime).toFixed(2)
        // Якщо помилка при перевірці профілю, логуємо і продовжуємо
        logError(`getSession: Помилка перевірки статусу бану (${banCheckDuration}ms, загалом ${totalDuration}ms)`, profileError)
      }
    } else {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      logWithTime(`getSession: Сесія відсутня, пропускаємо перевірку бану (загалом ${totalDuration}ms)`)
    }
    
    const totalDuration = (performance.now() - startTime).toFixed(2)
    logWithTime(`getSession: Завершено успішно (загалом ${totalDuration}ms)`, {
      hasSession: !!session,
      userId: session?.user?.id
    })
    
    return session
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`getSession: Критична помилка (${duration}ms)`, error)
    
    // Якщо помилка пов'язана з refresh token, очищуємо сесію
    if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid Refresh Token')) {
      logWithTime('getSession: Виявлено помилку refresh token в catch, очищення сесії...')
      try {
        await supabase.auth.signOut()
        logWithTime('getSession: Сесію очищено')
      } catch (signOutError) {
        logError('getSession: Помилка при очищенні сесії', signOutError)
      }
    }
    
    return null
  }
}

// Підписка на зміни статусу автентифікації
export const onAuthStateChange = (callback) => {
  logWithTime('onAuthStateChange: Створення підписки')
  
  // Перевіряємо, що callback є функцією
  if (typeof callback !== 'function') {
    logError('onAuthStateChange: Callback не є функцією', { callback, type: typeof callback })
    throw new Error('Callback must be a function')
  }
  
  const result = supabase.auth.onAuthStateChange((event, session) => {
    const eventTime = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    logWithTime(`onAuthStateChange: Подія отримана`, {
      event,
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email
    })
    
    // Обробляємо помилки refresh token
    if (event === 'TOKEN_REFRESHED' && !session) {
      // Якщо токен не вдалося оновити, виходимо
      logWithTime('onAuthStateChange: Не вдалося оновити токен, вихід з системи...')
      try {
        supabase.auth.signOut().catch(error => {
          logError('onAuthStateChange: Помилка при виході після помилки refresh token', error)
        })
        logWithTime('onAuthStateChange: Вихід виконано')
      } catch (error) {
        logError('onAuthStateChange: Помилка при виході після помилки refresh token', error)
      }
      // Викликаємо callback з подією SIGNED_OUT
      try {
        callback('SIGNED_OUT', null)
      } catch (error) {
        logError('onAuthStateChange: Помилка при виклику callback для SIGNED_OUT', error)
      }
      return
    }
    
    // Викликаємо оригінальний callback
    try {
      logWithTime(`onAuthStateChange: Виклик callback для події ${event}`)
      const callbackStartTime = performance.now()
      
      // Викликаємо callback синхронно або асинхронно залежно від типу
      const callbackResult = callback(event, session)
      
      // Якщо callback повертає Promise, обробляємо його
      if (callbackResult && typeof callbackResult.then === 'function') {
        callbackResult
          .then(() => {
            const callbackDuration = (performance.now() - callbackStartTime).toFixed(2)
            logWithTime(`onAuthStateChange: Callback завершено (${callbackDuration}ms)`)
          })
          .catch((error) => {
            const callbackDuration = (performance.now() - callbackStartTime).toFixed(2)
            // Якщо помилка пов'язана з refresh token, обробляємо її
            if (error?.message?.includes('Refresh Token') || error?.message?.includes('Invalid Refresh Token')) {
              logWithTime('onAuthStateChange: Виявлено помилку refresh token, вихід з системи...')
              supabase.auth.signOut().catch(signOutError => {
                logError('onAuthStateChange: Помилка при виході', signOutError)
              })
              try {
                callback('SIGNED_OUT', null)
              } catch (cbError) {
                logError('onAuthStateChange: Помилка при виклику callback для SIGNED_OUT', cbError)
              }
            } else {
              logError(`onAuthStateChange: Помилка в callback для події ${event} (${callbackDuration}ms)`, error)
            }
          })
      } else {
        const callbackDuration = (performance.now() - callbackStartTime).toFixed(2)
        logWithTime(`onAuthStateChange: Callback завершено синхронно (${callbackDuration}ms)`)
      }
    } catch (error) {
      // Якщо помилка пов'язана з refresh token, обробляємо її
      if (error?.message?.includes('Refresh Token') || error?.message?.includes('Invalid Refresh Token')) {
        logWithTime('onAuthStateChange: Виявлено помилку refresh token, вихід з системи...')
        try {
          supabase.auth.signOut().catch(signOutError => {
            logError('onAuthStateChange: Помилка при виході', signOutError)
          })
          callback('SIGNED_OUT', null)
        } catch (cbError) {
          logError('onAuthStateChange: Помилка при виклику callback для SIGNED_OUT', cbError)
        }
      } else {
        logError(`onAuthStateChange: Помилка в callback для події ${event}`, error)
      }
    }
  })
  
  // Повертаємо результат правильно
  return result
}

// Оновлення пароля
export const updatePassword = async (newPassword) => {
  const startTime = performance.now()
  logWithTime('updatePassword: Початок оновлення пароля')
  
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    const duration = (performance.now() - startTime).toFixed(2)
    
    if (error) {
      logError(`updatePassword: Помилка (${duration}ms)`, error)
      throw error
    }
    
    logWithTime(`updatePassword: Успішно (${duration}ms)`)
    return data
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2)
    logError(`updatePassword: Критична помилка (${duration}ms)`, error)
    throw error
  }
}

// Забанити користувача (тільки для адміністраторів)
export const banUser = async (userId, banned = true) => {
  const startTime = performance.now()
  logWithTime('banUser: Початок операції', { userId, banned })
  
  const adminStatus = await isAdmin()
  logWithTime('banUser: Статус адміністратора', { isAdmin: adminStatus })
  
  if (!adminStatus) {
    logError('banUser: Користувач не є адміністратором')
    throw new Error('Only administrators can ban users')
  }

  logWithTime('banUser: Отримання поточних даних користувача', { userId })
  const selectStartTime = performance.now()
  
  // Спочатку перевіряємо поточне значення
  const { data: currentData, error: selectError } = await supabase
    .from('profiles')
    .select('id, banned, role')
    .eq('id', userId)
    .single()
  
  const selectDuration = (performance.now() - selectStartTime).toFixed(2)
  
  logWithTime(`banUser: Поточні дані отримано (${selectDuration}ms)`, {
    currentData,
    hasError: !!selectError,
    errorMessage: selectError?.message
  })
  
  logWithTime('banUser: Оновлення поля banned', { userId, banned })
  const updateStartTime = performance.now()
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ banned })
    .eq('id', userId)
    .select('id, banned, email, role')

  const updateDuration = (performance.now() - updateStartTime).toFixed(2)
  const totalDuration = (performance.now() - startTime).toFixed(2)

  logWithTime(`banUser: Результат оновлення (${updateDuration}ms)`, {
    data,
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    } : null
  })

  if (error) {
    logError(`banUser: Помилка при оновленні (загалом ${totalDuration}ms)`, error)
    throw error
  }
  
  logWithTime(`banUser: Операція успішна (загалом ${totalDuration}ms)`, {
    userId: data?.[0]?.id,
    banned: data?.[0]?.banned
  })
  return data
}

// Розбанити користувача
export const unbanUser = async (userId) => {
  return banUser(userId, false)
}


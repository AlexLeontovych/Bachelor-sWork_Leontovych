import { createClient } from '@supabase/supabase-js'

const initStartTime = performance.now()
const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })

console.log(`[${time}] [БД ДЕБАГ] supabase.js: Початок ініціалізації Supabase клієнта...`)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log(`[${time}] [БД ДЕБАГ] supabase.js: Перевірка змінних оточення`, {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl?.length || 0,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'null',
  hasAnonKey: !!supabaseAnonKey,
  anonKeyLength: supabaseAnonKey?.length || 0,
  anonKeyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'null'
})

if (!supabaseUrl || !supabaseAnonKey) {
  const duration = (performance.now() - initStartTime).toFixed(2)
  console.error(`[${time}] [БД ДЕБАГ] supabase.js: КРИТИЧНА ПОМИЛКА (${duration}ms)`, {
    missingUrl: !supabaseUrl,
    missingAnonKey: !supabaseAnonKey
  })
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

console.log(`[${time}] [БД ДЕБАГ] supabase.js: Створення Supabase клієнта`)
const clientStartTime = performance.now()
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
const clientDuration = (performance.now() - clientStartTime).toFixed(2)
const totalDuration = (performance.now() - initStartTime).toFixed(2)

console.log(`[${time}] [БД ДЕБАГ] supabase.js: Supabase клієнт успішно створено (${clientDuration}ms, загалом ${totalDuration}ms)`, {
  hasClient: !!supabase,
  url: supabaseUrl.substring(0, 30) + '...'
})


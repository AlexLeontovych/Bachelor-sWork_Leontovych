export const ROUTES = {
  root: '/',
  auth: '/auth',
  onboarding: '/onboarding',
  projects: '/projects',
  cabinet: '/cabinet',
  editor: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/editor`,
  preview: (projectId: string, format = 'landscape', from = 'editor') => (
    `/projects/${encodeURIComponent(projectId)}/preview?format=${encodeURIComponent(format)}&from=${encodeURIComponent(from)}`
  )
} as const

export type AppRouteKey = keyof typeof ROUTES


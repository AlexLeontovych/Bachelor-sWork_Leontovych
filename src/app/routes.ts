export const ROUTES = {
  root: '/',
  auth: '/auth',
  onboarding: '/onboarding',
  projects: '/projects',
  cabinet: '/cabinet',
  editor: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/editor`
} as const

export type AppRouteKey = keyof typeof ROUTES


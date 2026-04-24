export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LoggerContext {
  scope: string
}

interface LoggerPayload {
  message: string
  meta?: unknown
}

const isDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true'

const formatLogRecord = (level: LogLevel, scope: string, payload: LoggerPayload) => ({
  level,
  scope,
  message: payload.message,
  meta: payload.meta ?? null,
  timestamp: new Date().toISOString()
})

/**
 * Creates a small structured logger for a module or feature.
 *
 * @param {LoggerContext} context
 * @returns {{ error: (message: string, meta?: unknown) => void, warn: (message: string, meta?: unknown) => void, info: (message: string, meta?: unknown) => void, debug: (message: string, meta?: unknown) => void }}
 *
 * @example
 * const logger = createLogger({ scope: 'workspaceService' })
 * logger.info('Loaded workspace access')
 */
export const createLogger = (context: LoggerContext) => {
  const write = (level: LogLevel, message: string, meta?: unknown) => {
    const record = formatLogRecord(level, context.scope, { message, meta })

    if (level === 'debug' && !isDebugEnabled) {
      return
    }

    switch (level) {
      case 'error':
        console.error(record)
        return
      case 'warn':
        console.warn(record)
        return
      case 'info':
        console.info(record)
        return
      case 'debug':
        console.debug(record)
        return
      default:
        console.info(record)
    }
  }

  return {
    error: (message: string, meta?: unknown) => write('error', message, meta),
    warn: (message: string, meta?: unknown) => write('warn', message, meta),
    info: (message: string, meta?: unknown) => write('info', message, meta),
    debug: (message: string, meta?: unknown) => write('debug', message, meta)
  }
}

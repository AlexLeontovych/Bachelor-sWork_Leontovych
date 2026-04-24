type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const shouldDebug = Deno.env.get('EDGE_FUNCTION_DEBUG') === 'true'

const writeLog = (level: LogLevel, scope: string, message: string, meta?: unknown) => {
  if (level === 'debug' && !shouldDebug) {
    return
  }

  const payload = {
    level,
    scope,
    message,
    meta: meta ?? null,
    timestamp: new Date().toISOString()
  }

  switch (level) {
    case 'error':
      console.error(payload)
      return
    case 'warn':
      console.warn(payload)
      return
    case 'info':
      console.info(payload)
      return
    case 'debug':
      console.debug(payload)
      return
  }
}

export const createLogger = (scope: string) => ({
  error: (message: string, meta?: unknown) => writeLog('error', scope, message, meta),
  warn: (message: string, meta?: unknown) => writeLog('warn', scope, message, meta),
  info: (message: string, meta?: unknown) => writeLog('info', scope, message, meta),
  debug: (message: string, meta?: unknown) => writeLog('debug', scope, message, meta)
})

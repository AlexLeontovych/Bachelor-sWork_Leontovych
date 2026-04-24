const sleep = (timeoutMs: number) => new Promise((resolve) => setTimeout(resolve, timeoutMs))

export const withRetry = async <T>(
  operation: () => Promise<T>,
  {
    attempts = 3,
    initialDelayMs = 250,
    backoffMultiplier = 2
  }: {
    attempts?: number
    initialDelayMs?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> => {
  let currentAttempt = 0
  let delayMs = initialDelayMs
  let lastError: unknown = null

  while (currentAttempt < attempts) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      currentAttempt += 1

      if (currentAttempt >= attempts) {
        break
      }

      await sleep(delayMs)
      delayMs *= backoffMultiplier
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed.')
}

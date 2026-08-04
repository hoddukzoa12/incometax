const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 750

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

export class HttpResponseError extends Error {
  readonly status: number

  constructor(status: number, statusText: string, responseBody: string) {
    super(`HTTP ${status} ${statusText}: ${responseBody}`)
    this.name = 'HttpResponseError'
    this.status = status
  }
}

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export const fetchJson = async (
  url: URL,
  init: Omit<RequestInit, 'signal'> = {},
): Promise<unknown> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const headers = new Headers(init.headers)
      headers.set('accept', 'application/json')
      const response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        const responseBody = await response.text()
        const error = new HttpResponseError(
          response.status,
          response.statusText,
          responseBody,
        )

        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw error
        }

        lastError = error
      } else {
        return (await response.json()) as unknown
      }
    } catch (error) {
      if (
        error instanceof HttpResponseError &&
        !RETRYABLE_STATUS_CODES.has(error.status)
      ) {
        throw error
      }
      lastError = error
    }

    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError
}

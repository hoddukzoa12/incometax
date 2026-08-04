export const DEFAULT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

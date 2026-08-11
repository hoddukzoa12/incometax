const CONSULT_INTRO_DISMISSAL_STORAGE_KEY =
  'incometax.consultIntro.dismissedUntil'
const NEXT_DAY_OFFSET = 1

const availableLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const nextLocalMidnight = (now: Date): Date => new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate() + NEXT_DAY_OFFSET,
)

export const shouldShowConsultIntro = (
  storage: Storage | null = availableLocalStorage(),
  now: Date = new Date(),
): boolean => {
  if (storage === null) return true
  try {
    const storedExpiration = storage.getItem(
      CONSULT_INTRO_DISMISSAL_STORAGE_KEY,
    )
    if (storedExpiration === null) return true
    const expirationTime = Date.parse(storedExpiration)
    return !Number.isFinite(expirationTime) || now.getTime() >= expirationTime
  } catch {
    return true
  }
}

export const persistConsultIntroDismissal = (
  storage: Storage | null = availableLocalStorage(),
  now: Date = new Date(),
): void => {
  if (storage === null) return
  try {
    storage.setItem(
      CONSULT_INTRO_DISMISSAL_STORAGE_KEY,
      nextLocalMidnight(now).toISOString(),
    )
  } catch {
    // Closing the modal must remain available when localStorage is blocked.
  }
}

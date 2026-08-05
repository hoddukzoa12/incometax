const LEGAL_DONG_CODE_PATTERN = /^\d{10}$/u

export const isLegalDongCode = (value: unknown): value is string =>
  typeof value === 'string' && LEGAL_DONG_CODE_PATTERN.test(value)

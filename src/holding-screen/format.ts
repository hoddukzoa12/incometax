import { normalizeMinusSign } from '../format/number'

const RATE_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 2,
})
const HISTORY_RATE_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const APPROXIMATE_RATE_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 0,
})
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export const formatRate = (value: number): string =>
  normalizeMinusSign(RATE_FORMATTER.format(value))

const withPositiveSign = (value: number, formatted: string): string =>
  value > 0 ? `+${formatted}` : formatted

export const formatSignedHistoryRate = (value: number): string =>
  withPositiveSign(
    value,
    normalizeMinusSign(HISTORY_RATE_FORMATTER.format(value)),
  )

export const formatSignedApproximateRate = (value: number): string =>
  withPositiveSign(
    value,
    normalizeMinusSign(APPROXIMATE_RATE_FORMATTER.format(value)),
  )

export const formatCompactDate = (value: string): string => {
  const match = ISO_DATE_PATTERN.exec(value)
  if (match === null) return value
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`
}

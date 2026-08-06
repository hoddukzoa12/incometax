import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'

const RATE_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 2,
})
const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
})
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export const formatWon = (value: number): string =>
  HOLDING_TAX_MESSAGES.wonStandalone(NUMBER_FORMATTER.format(value))

export const formatInlineWon = (value: number): string =>
  HOLDING_TAX_MESSAGES.wonInline(NUMBER_FORMATTER.format(value))

export const formatDeductionWon = (value: number): string =>
  HOLDING_TAX_MESSAGES.deductionWonStandalone(
    NUMBER_FORMATTER.format(Math.abs(value)),
  )

export const formatRate = (value: number): string =>
  RATE_FORMATTER.format(value)

export const formatCompactDate = (value: string): string => {
  const match = ISO_DATE_PATTERN.exec(value)
  if (match === null) return value
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`
}

export const formatNullableWon = (
  value: number | null,
  unavailable: string,
): string => value === null ? unavailable : formatWon(value)

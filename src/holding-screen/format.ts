import { formatWon } from '../format/property'

const RATE_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export { formatWon }

export const formatRate = (value: number): string =>
  RATE_FORMATTER.format(value)

export const formatNullableWon = (
  value: number | null,
  unavailable: string,
): string => value === null ? unavailable : formatWon(value)

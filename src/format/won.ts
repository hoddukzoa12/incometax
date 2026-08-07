import { CURRENCY_MESSAGES } from '../messages/currency'
import { formatInteger } from './number'

export const formatWon = (value: number): string =>
  CURRENCY_MESSAGES.wonStandalone(formatInteger(value))

export const formatInlineWon = (value: number): string =>
  CURRENCY_MESSAGES.wonInline(formatInteger(value))

export const formatDeductionWon = (value: number): string =>
  value === 0
    ? formatWon(value)
    : formatWon(-Math.abs(value))

export const formatNullableWon = (
  value: number | null,
  unavailable: string,
): string => value === null ? unavailable : formatWon(value)

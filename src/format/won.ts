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

const MANWON = 10_000

/**
 * 만원 단위. 시안(shell-v2)의 추이 화면은 원 단위를 쓰지 않는다 —
 * 막대 여섯 개에 아홉 자리 숫자를 얹으면 자릿수만 보이고 크기가 안 보인다.
 * 정확한 원 단위는 상세 표가 맡는다.
 */
export const formatManwon = (value: number): string =>
  CURRENCY_MESSAGES.manwonInline(formatInteger(Math.round(value / MANWON)))

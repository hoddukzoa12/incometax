import { SIDEBAR_MESSAGES } from '../messages/sidebar'

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR')

export const formatCount = (value: number | null): string | null =>
  value === null ? null : NUMBER_FORMATTER.format(value)

export const formatArea = (value: number): string => `${value.toFixed(2)}㎡`

export const formatFloor = (value: number | null): string =>
  value === null
    ? SIDEBAR_MESSAGES.missingFloor
    : `${value}${SIDEBAR_MESSAGES.floorSuffix}`

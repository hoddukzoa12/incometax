import type {
  OwnershipPercent,
  OwnershipShare,
} from '../../shared/portfolio'

const MIN_OWNERSHIP_SHARE = 0
const MAX_OWNERSHIP_SHARE = 1
export const MIN_OWNERSHIP_PERCENT = 0
export const MAX_OWNERSHIP_PERCENT = 100
export const OWNERSHIP_PERCENT_INPUT_STEP = 0.1
const PERCENT_SCALE = 100

const assertWithinRange = (
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void => {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}`)
  }
}

export const ownershipShareFromFraction = (value: number): OwnershipShare => {
  assertWithinRange(
    value,
    MIN_OWNERSHIP_SHARE,
    MAX_OWNERSHIP_SHARE,
    'ownershipShare',
  )
  return value as OwnershipShare
}

export const ownershipPercentFromNumber = (value: number): OwnershipPercent => {
  assertWithinRange(
    value,
    MIN_OWNERSHIP_PERCENT,
    MAX_OWNERSHIP_PERCENT,
    'ownershipPercent',
  )
  return value as OwnershipPercent
}

export const ownershipShareFromPercent = (
  value: OwnershipPercent,
): OwnershipShare => ownershipShareFromFraction(value / PERCENT_SCALE)

export const ownershipShareToPercent = (
  value: OwnershipShare,
): OwnershipPercent => ownershipPercentFromNumber(value * PERCENT_SCALE)

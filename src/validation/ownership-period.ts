import type { OwnershipPeriod } from '../../shared/ownership'

const ZERO_YEARS = 0

export const hasValidOwnershipPeriod = (
  period: OwnershipPeriod,
): boolean =>
  Number.isFinite(period.holdingYears) &&
  period.holdingYears >= ZERO_YEARS &&
  Number.isFinite(period.residenceYears) &&
  period.residenceYears >= ZERO_YEARS

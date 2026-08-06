import type {
  ActualResidencePeriod,
  OwnershipPeriod,
} from '../../shared/ownership'

const ZERO_YEARS = 0

export const hasValidOwnershipPeriod = (
  period: OwnershipPeriod,
): boolean =>
  Number.isFinite(period.holdingYears) &&
  period.holdingYears >= ZERO_YEARS &&
  Number.isFinite(period.residenceYears) &&
  period.residenceYears >= ZERO_YEARS

export const toActualResidencePeriod = (
  period: OwnershipPeriod,
): ActualResidencePeriod => ({
  basis: 'actualResidence',
  years: period.residenceYears,
})

export const meetsMinimumActualResidenceYears = (
  period: ActualResidencePeriod,
  minimumYears: number,
): boolean => period.years >= minimumYears

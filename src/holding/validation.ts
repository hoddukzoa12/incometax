import { ASSET_KINDS } from '../../shared/assets'
import type { HoldingTaxInput } from '../../shared/holding-tax'
import { hasValidOwnershipPeriod } from '../validation/ownership-period'

const ZERO_AMOUNT = 0
const FULL_OWNERSHIP_SHARE = 1

const EMPTY_PORTFOLIO_MESSAGE = 'At least one portfolio item is required'
const INVALID_OFFICIAL_PRICE_MESSAGE =
  'Official prices must be non-negative integer won amounts'
const INVALID_PRIOR_OFFICIAL_PRICE_MESSAGE =
  'Prior official prices must be non-negative integer won amounts when provided'
const INVALID_OWNERSHIP_SHARE_MESSAGE =
  'Ownership share must be greater than zero and at most one'
const INVALID_HOUSEHOLD_HOME_COUNT_MESSAGE =
  'Household home count must be a positive integer at least as large as the number of taxed portfolio items'
const INVALID_SOLE_HOUSEHOLD_OWNER_MESSAGE =
  'Sole household owner status must be a boolean'
const INVALID_OWNERSHIP_PERIOD_MESSAGE =
  'Holding and residence periods must be finite non-negative year values'
const INVALID_OWNER_AGE_MESSAGE =
  'Owner age must be a non-negative integer when provided'
const INVALID_PRIOR_YEAR_TAX_MESSAGE =
  'Prior-year tax figures must be non-negative integer won amounts when provided'
const UNSUPPORTED_ASSET_KIND_MESSAGE = 'Unsupported asset kind for holding tax'

const isSupportedAssetKind = (assetKind: string): boolean =>
  ASSET_KINDS.some((supportedAssetKind) => supportedAssetKind === assetKind)

export const assertValidHoldingTaxInput = (
  input: HoldingTaxInput,
): void => {
  if (input.items.length === ZERO_AMOUNT) {
    throw new RangeError(EMPTY_PORTFOLIO_MESSAGE)
  }

  if (
    !Number.isInteger(input.householdHomeCount) ||
    input.householdHomeCount <= ZERO_AMOUNT ||
    input.householdHomeCount < input.items.length
  ) {
    throw new RangeError(INVALID_HOUSEHOLD_HOME_COUNT_MESSAGE)
  }

  if (
    input.ownerAge !== undefined &&
    (!Number.isFinite(input.ownerAge) ||
      input.ownerAge < ZERO_AMOUNT ||
      !Number.isInteger(input.ownerAge))
  ) {
    throw new RangeError(INVALID_OWNER_AGE_MESSAGE)
  }

  const priorYearNonNegative = [
    input.priorYearTax?.propertyBaseTax,
    input.priorYearTax?.comprehensiveCalculatedTax,
  ].filter((amount): amount is number => amount !== undefined)
  if (
    priorYearNonNegative.some(
      (amount) =>
        !Number.isFinite(amount) ||
        amount < ZERO_AMOUNT ||
        !Number.isSafeInteger(amount),
    )
  ) {
    throw new RangeError(INVALID_PRIOR_YEAR_TAX_MESSAGE)
  }
  // payableTax 는 2027년 이후 0 하한이 없어 음수가 될 수 있다.
  const comprehensiveTax = input.priorYearTax?.comprehensiveTax
  if (
    comprehensiveTax !== undefined &&
    (!Number.isFinite(comprehensiveTax) ||
      !Number.isSafeInteger(comprehensiveTax))
  ) {
    throw new RangeError(INVALID_PRIOR_YEAR_TAX_MESSAGE)
  }

  for (const item of input.items) {
    if (!isSupportedAssetKind(item.assetKind)) {
      throw new RangeError(UNSUPPORTED_ASSET_KIND_MESSAGE)
    }

    if (
      !Number.isFinite(item.officialPrice) ||
      item.officialPrice < ZERO_AMOUNT ||
      !Number.isInteger(item.officialPrice)
    ) {
      throw new RangeError(INVALID_OFFICIAL_PRICE_MESSAGE)
    }

    if (
      item.priorOfficialPrice !== undefined &&
      (!Number.isFinite(item.priorOfficialPrice) ||
        item.priorOfficialPrice < ZERO_AMOUNT ||
        !Number.isInteger(item.priorOfficialPrice))
    ) {
      throw new RangeError(INVALID_PRIOR_OFFICIAL_PRICE_MESSAGE)
    }

    if (
      !Number.isFinite(item.ownershipShare) ||
      item.ownershipShare <= ZERO_AMOUNT ||
      item.ownershipShare > FULL_OWNERSHIP_SHARE
    ) {
      throw new RangeError(INVALID_OWNERSHIP_SHARE_MESSAGE)
    }

    if (typeof item.isSoleHouseholdOwner !== 'boolean') {
      throw new RangeError(INVALID_SOLE_HOUSEHOLD_OWNER_MESSAGE)
    }

    if (!hasValidOwnershipPeriod(item)) {
      throw new RangeError(INVALID_OWNERSHIP_PERIOD_MESSAGE)
    }
  }
}

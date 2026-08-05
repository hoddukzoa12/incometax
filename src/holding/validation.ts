import { ASSET_KINDS } from '../../shared/assets'
import type { HoldingTaxInput } from '../../shared/holding-tax'

const ZERO_AMOUNT = 0
const FULL_OWNERSHIP_SHARE = 1

const EMPTY_PORTFOLIO_MESSAGE = 'At least one portfolio item is required'
const INVALID_OFFICIAL_PRICE_MESSAGE =
  'Official prices must be non-negative integer won amounts'
const INVALID_OWNERSHIP_SHARE_MESSAGE =
  'Ownership share must be greater than zero and at most one'
const INVALID_HOUSEHOLD_HOME_COUNT_MESSAGE =
  'Household home count must be a positive integer at least as large as the number of taxed portfolio items'
const INVALID_SOLE_HOUSEHOLD_OWNER_MESSAGE =
  'Sole household owner status must be a boolean'
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
      !Number.isFinite(item.ownershipShare) ||
      item.ownershipShare <= ZERO_AMOUNT ||
      item.ownershipShare > FULL_OWNERSHIP_SHARE
    ) {
      throw new RangeError(INVALID_OWNERSHIP_SHARE_MESSAGE)
    }

    if (typeof item.isSoleHouseholdOwner !== 'boolean') {
      throw new RangeError(INVALID_SOLE_HOUSEHOLD_OWNER_MESSAGE)
    }
  }
}

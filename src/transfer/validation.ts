import { ASSET_KINDS } from '../../shared/assets'
import type { TransferTaxInput } from '../../shared/transfer-tax'

const DEFAULT_CAP_APPORTIONMENT_RATIO = 1
const MINIMUM_RATIO = 0
const MAXIMUM_RATIO = 1
const ZERO_AMOUNT = 0

const INVALID_AMOUNT_MESSAGE =
  'Transfer prices and expenses must be non-negative integer won amounts'
const INVALID_PERIOD_MESSAGE =
  'Holding and residence periods must be finite non-negative year values'
const INVALID_CAP_RATIO_MESSAGE =
  'The deduction cap apportionment ratio must be between zero and one'
const INVALID_REMAINING_CAP_MESSAGE =
  'The remaining annual long-term deduction cap must be non-negative'
const UNSUPPORTED_ASSET_KIND_MESSAGE = 'Unsupported asset kind for transfer tax'

const isSupportedAssetKind = (assetKind: string): boolean =>
  ASSET_KINDS.some((supportedAssetKind) => supportedAssetKind === assetKind)

export const assertValidTransferTaxInput = (
  input: TransferTaxInput,
): void => {
  if (!isSupportedAssetKind(input.assetKind)) {
    throw new RangeError(UNSUPPORTED_ASSET_KIND_MESSAGE)
  }

  const amounts = [
    input.salePrice,
    input.acquisitionPrice,
    input.necessaryExpenses,
  ]
  if (
    amounts.some(
      (amount) =>
        !Number.isFinite(amount) ||
        amount < ZERO_AMOUNT ||
        !Number.isSafeInteger(amount),
    )
  ) {
    throw new RangeError(INVALID_AMOUNT_MESSAGE)
  }

  const periods = [input.holdingYears, input.residenceYears]
  if (
    periods.some((period) => !Number.isFinite(period) || period < ZERO_AMOUNT)
  ) {
    throw new RangeError(INVALID_PERIOD_MESSAGE)
  }

  const capRatio =
    input.deductionCapApportionmentRatio ??
    DEFAULT_CAP_APPORTIONMENT_RATIO
  if (
    !Number.isFinite(capRatio) ||
    capRatio < MINIMUM_RATIO ||
    capRatio > MAXIMUM_RATIO
  ) {
    throw new RangeError(INVALID_CAP_RATIO_MESSAGE)
  }

  const remainingAnnualCap = input.remainingAnnualLongTermDeductionCap
  if (
    remainingAnnualCap !== undefined &&
    (!Number.isFinite(remainingAnnualCap) ||
      remainingAnnualCap < ZERO_AMOUNT ||
      !Number.isSafeInteger(remainingAnnualCap))
  ) {
    throw new RangeError(INVALID_REMAINING_CAP_MESSAGE)
  }
}

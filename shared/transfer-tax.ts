import type { AssetKind } from './assets'
import type { HouseholdKind, TaxYear } from './tax-rules'

export interface TransferTaxInput {
  readonly assetKind: AssetKind
  readonly year: TaxYear
  readonly householdKind: HouseholdKind
  readonly salePrice: number
  readonly acquisitionPrice: number
  readonly necessaryExpenses: number
  readonly holdingYears: number
  readonly residenceYears: number
  readonly isTaxResident?: boolean
  readonly isRelatedPartyTransaction?: boolean
  readonly deductionCapApportionmentRatio?: number
  readonly remainingAnnualLongTermDeductionCap?: number
}

export type TransferTaxStatus = 'noGain' | 'exempt' | 'taxable'

export type TransferBasicDeductionKind =
  | 'none'
  | 'standard'
  | 'longResidenceSpecial'

export type TransferAppliedRateKind =
  | 'none'
  | 'shortTerm'
  | 'progressive'

export interface TransferLongTermDeductionResult {
  readonly ruleHouseholdKind: HouseholdKind
  readonly holdingRate: number
  readonly residenceRate: number
  readonly nominalRate: number
  readonly calculatedAmount: number
  readonly capAmount: number | null
  readonly appliedAmount: number
  readonly effectiveRate: number
  readonly isCapped: boolean
}

export interface TransferAppliedRateResult {
  readonly kind: TransferAppliedRateKind
  readonly rate: number
  readonly progressiveDeduction: number
}

export interface TransferTaxResult {
  readonly year: TaxYear
  readonly status: TransferTaxStatus
  readonly grossGain: number
  readonly taxableGainRatio: number
  readonly taxableGain: number
  readonly longTermDeduction: TransferLongTermDeductionResult
  readonly basicDeductionKind: TransferBasicDeductionKind
  readonly basicDeductionAmount: number
  readonly taxableBase: number
  readonly appliedRate: TransferAppliedRateResult
  readonly nationalTax: number
  readonly localIncomeTax: number
  readonly totalTax: number
}

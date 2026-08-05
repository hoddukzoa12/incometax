import type { AssetKind } from './assets'
import type { OwnershipPeriod } from './ownership'
import type {
  AreaKind,
  HouseholdKind,
  Residency,
  TaxYear,
} from './tax-rules'

export interface PortfolioItem extends OwnershipPeriod {
  readonly assetKind: AssetKind
  readonly officialPrice: number
  readonly ownershipShare: number
  readonly isSoleHouseholdOwner: boolean
  readonly residency: Residency
  readonly areaKind: AreaKind
}

export interface PriorYearHoldingTax {
  readonly propertyBaseTax?: number
  readonly comprehensiveCalculatedTax?: number
}

export interface HoldingTaxInput {
  readonly year: TaxYear
  readonly householdHomeCount: number
  readonly items: readonly PortfolioItem[]
  readonly ownerAge?: number
  readonly priorYearTax?: PriorYearHoldingTax
}

export interface HoldingAppliedRateResult {
  readonly rate: number
  readonly progressiveDeduction: number
}

export interface PropertyTaxResult {
  readonly itemIndex: number
  readonly ownershipShare: number
  readonly fullOfficialPrice: number
  readonly ownedOfficialPrice: number
  readonly fairMarketValueRatio: number
  readonly fullTaxableBase: number
  readonly taxableBase: number
  readonly preferentialRateApplied: boolean
  readonly appliedRate: HoldingAppliedRateResult
  readonly fullBaseTax: number
  readonly baseTax: number
  readonly localEducationTax: number
  readonly cityAreaTax: number
  readonly totalTax: number
}

export type ComprehensiveTaxStatus = 'notTaxable' | 'taxable'

export type ComprehensiveTaxCreditMissingInput = 'ownerAge'

export interface ComprehensiveTaxCreditComputedResult {
  readonly status: 'computed'
  readonly ageRate: number
  readonly holdingPeriodRate: number
  readonly residencePeriodRate: number
  readonly periodRate: number
  readonly nominalRate: number
  readonly appliedRate: number
  readonly maximumRate: number
  readonly calculatedAmount: number
  readonly amountCap: number | null
  readonly amount: number
  readonly isRateCapped: boolean
  readonly isAmountCapped: boolean
}

export interface ComprehensiveTaxCreditNotApplicableResult {
  readonly status: 'notApplicable'
  readonly reason: 'notOneHouse' | 'noComprehensiveTax'
  readonly amount: 0
}

export interface ComprehensiveTaxCreditNotComputedResult {
  readonly status: 'notComputed'
  readonly missingInputs: readonly ComprehensiveTaxCreditMissingInput[]
  readonly amount: null
}

export type ComprehensiveTaxCreditResult =
  | ComprehensiveTaxCreditComputedResult
  | ComprehensiveTaxCreditNotApplicableResult
  | ComprehensiveTaxCreditNotComputedResult

export type ComprehensiveTaxBurdenCapMissingInput =
  | 'priorYearPropertyBaseTax'
  | 'priorYearComprehensiveCalculatedTax'

export interface ComprehensiveTaxBurdenCapComputedResult {
  readonly status: 'computed'
  readonly rate: number
  readonly priorYearBase: number
  readonly maximumTaxBurden: number
  readonly currentYearBase: number
  readonly excessAmount: number
}

export interface ComprehensiveTaxBurdenCapNotApplicableResult {
  readonly status: 'notApplicable'
  readonly reason: 'noComprehensiveTax'
  readonly excessAmount: 0
}

export interface ComprehensiveTaxBurdenCapNotComputedResult {
  readonly status: 'notComputed'
  readonly rate: number
  readonly missingInputs: readonly ComprehensiveTaxBurdenCapMissingInput[]
  readonly excessAmount: null
}

export type ComprehensiveTaxBurdenCapResult =
  | ComprehensiveTaxBurdenCapComputedResult
  | ComprehensiveTaxBurdenCapNotApplicableResult
  | ComprehensiveTaxBurdenCapNotComputedResult

export interface ComprehensiveTaxResult {
  readonly status: ComprehensiveTaxStatus
  readonly homeCount: number
  readonly ownedOfficialPriceTotal: number
  readonly residentOwnedOfficialPrice: number
  readonly taxableThreshold: number
  readonly basicDeduction: number
  readonly fairMarketValueRatio: number
  readonly taxableBase: number
  readonly appliedRate: HoldingAppliedRateResult
  readonly baseTax: number
  readonly propertyTaxFairMarketValueRatio: number
  readonly propertyTaxCredit: number
  readonly netTax: number
  readonly taxCredit: ComprehensiveTaxCreditResult
  readonly taxBurdenCap: ComprehensiveTaxBurdenCapResult
  readonly payableTax: number | null
  readonly ruralSpecialTax: number | null
  readonly totalTax: number | null
}

export type HoldingTaxCalculationStatus = 'complete' | 'missingInputs'

export interface HoldingTaxResult {
  readonly calculationStatus: HoldingTaxCalculationStatus
  readonly year: TaxYear
  readonly householdHomeCount: number
  readonly propertyTaxHouseholdKind: HouseholdKind
  readonly comprehensiveTaxHouseholdKind: HouseholdKind
  readonly propertyTaxes: readonly PropertyTaxResult[]
  readonly propertyTaxTotal: number
  readonly comprehensiveTax: ComprehensiveTaxResult
  readonly totalTax: number | null
}

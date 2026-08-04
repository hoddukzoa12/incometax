import type { AssetKind } from './assets'
import type {
  AreaKind,
  HouseholdKind,
  Residency,
  TaxYear,
} from './tax-rules'

export interface PortfolioItem {
  readonly assetKind: AssetKind
  readonly officialPrice: number
  readonly ownershipShare: number
  readonly isSoleHouseholdOwner: boolean
  readonly residency: Residency
  readonly areaKind: AreaKind
}

export interface HoldingTaxInput {
  readonly year: TaxYear
  readonly householdHomeCount: number
  readonly items: readonly PortfolioItem[]
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
  readonly ruralSpecialTax: number
  readonly totalTax: number
}

export interface HoldingTaxResult {
  readonly year: TaxYear
  readonly householdHomeCount: number
  readonly propertyTaxHouseholdKind: HouseholdKind
  readonly comprehensiveTaxHouseholdKind: HouseholdKind
  readonly propertyTaxes: readonly PropertyTaxResult[]
  readonly propertyTaxTotal: number
  readonly comprehensiveTax: ComprehensiveTaxResult
  readonly totalTax: number
}

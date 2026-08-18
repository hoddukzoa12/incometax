export type HouseholdKind = 'oneHouse' | 'multiHouse'
export const RESIDENCIES = ['residing', 'nonResiding'] as const
export type Residency = (typeof RESIDENCIES)[number]

export const AREA_KINDS = ['adjusted', 'general'] as const
export type AreaKind = (typeof AREA_KINDS)[number]
export type TaxYear = 2025 | 2026 | 2027 | 2028 | 2029 | 2030

export interface Bracket {
  readonly upTo: number
  readonly rate: number
  readonly progressiveDeduction: number
}

export interface RateBand {
  readonly upTo: number
  readonly rate: number
}

export interface MinimumRateBand {
  readonly minimum: number
  readonly rate: number
}

export type PropertyTaxSurtaxBase = 'baseTax' | 'taxableBase'

export interface PropertyTaxSurtaxRule {
  readonly base: PropertyTaxSurtaxBase
  readonly rate: number
}

export interface PropertyTaxRules {
  readonly oneHouseHomeCount: number
  readonly taxableBaseCapGrowthRate: number
  readonly fairMarketValueRatios: {
    readonly oneHouse: readonly RateBand[]
    readonly other: number
  }
  readonly preferentialRateMaximumOfficialPrice: number
  readonly brackets: {
    readonly general: readonly Bracket[]
    readonly oneHouse: readonly Bracket[]
  }
  readonly surtaxes: {
    readonly localEducation: PropertyTaxSurtaxRule
    readonly cityArea: PropertyTaxSurtaxRule
  }
}

export interface ComprehensiveBasicDeductionRules {
  readonly oneHouse: Readonly<Record<Residency, number>>
  readonly multiHouse:
    | {
        readonly kind: 'fixed'
        readonly amount: number
      }
    | {
        readonly kind: 'residentShare'
        readonly base: number
        readonly residentHomeShareMaximum: number
      }
}

export interface ComprehensiveFairMarketValueRatioRules {
  readonly oneHouse: number
  readonly multiHouse: {
    readonly standard: number
    readonly threeOrMoreOrAdjusted: number
  }
}

export type ComprehensiveBracketRules =
  | {
      readonly kind: 'byHomeCount'
      readonly upToTwoHomes: readonly Bracket[]
      readonly threeOrMoreHomes: readonly Bracket[]
    }
  | {
      readonly kind: 'unified'
      readonly brackets: readonly Bracket[]
    }

export type ComprehensivePeriodCreditKind =
  | 'holding'
  | 'maximum'
  | 'residence'

/** 공제할 재산세액 분자에 쓸 재산세 공정시장가액비율의 기준. */
export type PropertyTaxCreditNumeratorFairMarketValueRatioBasis =
  | 'propertyTax'
  | 'other'

export interface ComprehensiveResidenceRecognitionRules {
  readonly minimumContinuousResidenceYears: number
  readonly unavoidableRelocationMaximumYears: number
  readonly medicalTreatmentMinimumYears: number
  readonly directAncestorMinimumAge: number
  readonly constructionRecognitionRate: number
  readonly demolitionReferenceMonthsBefore: number
}

export interface ComprehensiveTaxCreditRules {
  readonly requiresResidence: boolean
  readonly ageRates: readonly MinimumRateBand[]
  readonly holdingPeriodRates: readonly MinimumRateBand[]
  readonly residencePeriodRates: readonly MinimumRateBand[]
  readonly periodCreditKind: ComprehensivePeriodCreditKind
  readonly maximumRate: number
  readonly amountCap: number | null
  readonly residenceRecognition:
    | ComprehensiveResidenceRecognitionRules
    | null
}

export interface ComprehensiveTaxBurdenCapRules {
  readonly rate: number
  readonly priorComprehensiveTaxKind: 'afterCreditBeforeBurdenCap'
}

export interface ComprehensiveTaxRules {
  readonly taxableThresholds: Readonly<Record<HouseholdKind, number>>
  readonly basicDeductions: ComprehensiveBasicDeductionRules
  readonly fairMarketValueRatios: ComprehensiveFairMarketValueRatioRules
  readonly brackets: ComprehensiveBracketRules
  readonly elevatedHomeCountMinimum: number
  readonly calculatedTaxMinimum: number | null
  readonly payableTaxMinimum: number | null
  readonly ruralSpecialTaxRate: number
  readonly propertyTaxCreditNumeratorFairMarketValueRatioBasis: Readonly<
    Record<
      HouseholdKind,
      PropertyTaxCreditNumeratorFairMarketValueRatioBasis
    >
  >
  readonly taxCredit: ComprehensiveTaxCreditRules
  readonly taxBurdenCap: ComprehensiveTaxBurdenCapRules
}

export interface HoldingPeriodTaxRate {
  readonly lessThanYears: number
  readonly rate: number
}

export interface AnnualDeductionComponent {
  readonly annualRate: number
  readonly maximumRate: number
  readonly minimumQualifyingYears?: number
}

export interface LongTermDeductionRule {
  readonly minimumHoldingYears: number
  readonly minimumResidenceYears: number | null
  readonly residence: AnnualDeductionComponent | null
  readonly holding: AnnualDeductionComponent | null
  readonly aggregation: 'sum' | 'maximum'
  readonly maximumRate: number
}

export interface TransferLongTermDeductionRules {
  readonly oneHouse: LongTermDeductionRule
  readonly multiHouse: LongTermDeductionRule
}

export interface TransferDeductionCapRules {
  readonly perPersonAnnual: number
  readonly perProperty: number
  readonly apportionment: 'ownershipOrDisposalShare'
}

export interface SpecialTransferBasicDeductionRule {
  readonly annualAmount: number
  readonly householdKind: 'oneHouse'
  readonly minimumResidenceYears: number
  readonly maximumSalePrice: number
  readonly residentOnly: true
  readonly relatedPartyExcluded: true
  readonly perOwner: true
  readonly apportionment: 'ownershipOrDisposalShare'
}

export interface TransferBasicDeductionRules {
  readonly standardAnnualAmount: number
  readonly special: SpecialTransferBasicDeductionRule | null
}

export interface TransferTaxRules {
  readonly brackets: readonly Bracket[]
  readonly shortTermRates: readonly HoldingPeriodTaxRate[]
  readonly ordinaryRateMinimumHoldingYears: number
  readonly oneHouseExemption: {
    readonly maximumSalePrice: number
    readonly minimumHoldingYears: number
  }
  readonly longTermDeductions: TransferLongTermDeductionRules
  readonly deductionCaps: TransferDeductionCapRules | null
  readonly basicDeductions: TransferBasicDeductionRules
  readonly localIncomeTaxRate: number
}

export interface TaxRules {
  readonly year: TaxYear
  readonly propertyTax: PropertyTaxRules
  readonly comprehensiveTax: ComprehensiveTaxRules
  readonly transferTax: TransferTaxRules
}

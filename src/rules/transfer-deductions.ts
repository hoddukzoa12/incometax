import type {
  TransferBasicDeductionRules,
  TransferDeductionCapRules,
  TransferLongTermDeductionRules,
} from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/**
 * 주택 장기보유특별공제 공통 요건·한도 —
 * tax-rules-spec.md §4.4, 개편안 p57~58.
 */
const LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS = 3
const ONE_HOUSE_LONG_TERM_DEDUCTION_MINIMUM_RESIDENCE_YEARS = 2
const ONE_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE =
  8_000 / RATE_DENOMINATOR
const MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE =
  3_000 / RATE_DENOMINATOR

/**
 * 2028년 이후 다주택자 거주공제율 —
 * tax-rules-spec.md §4.4, 개편안 p58.
 */
const MULTI_HOUSE_RESIDENCE_DEDUCTION_FROM_2028 = {
  annualRate: 200 / RATE_DENOMINATOR,
  maximumRate: MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
  minimumQualifyingYears: 2,
} as const

/**
 * 2027년까지 1세대1주택 장기보유특별공제 —
 * tax-rules-spec.md §4.4, 개편안 p57.
 */
const ONE_HOUSE_LONG_TERM_DEDUCTION_THROUGH_2027 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears:
    ONE_HOUSE_LONG_TERM_DEDUCTION_MINIMUM_RESIDENCE_YEARS,
  residence: {
    annualRate: 400 / RATE_DENOMINATOR,
    maximumRate: 4_000 / RATE_DENOMINATOR,
  },
  holding: {
    annualRate: 400 / RATE_DENOMINATOR,
    maximumRate: 4_000 / RATE_DENOMINATOR,
  },
  aggregation: 'sum',
  maximumRate: ONE_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

/**
 * 2027년까지 다주택자 주택 장기보유특별공제 —
 * tax-rules-spec.md §4.4, 개편안 p58.
 */
const MULTI_HOUSE_LONG_TERM_DEDUCTION_THROUGH_2027 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears: null,
  residence: null,
  holding: {
    annualRate: 200 / RATE_DENOMINATOR,
    maximumRate: MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
  },
  aggregation: 'sum',
  maximumRate: MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

export const TRANSFER_LONG_TERM_DEDUCTIONS_THROUGH_2027 = {
  oneHouse: ONE_HOUSE_LONG_TERM_DEDUCTION_THROUGH_2027,
  multiHouse: MULTI_HOUSE_LONG_TERM_DEDUCTION_THROUGH_2027,
} as const satisfies TransferLongTermDeductionRules

/**
 * 2028년 1세대1주택 장기거주소득공제 —
 * tax-rules-spec.md §4.4, 개편안 p56~57.
 */
const ONE_HOUSE_LONG_TERM_DEDUCTION_2028 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears:
    ONE_HOUSE_LONG_TERM_DEDUCTION_MINIMUM_RESIDENCE_YEARS,
  residence: {
    annualRate: 600 / RATE_DENOMINATOR,
    maximumRate: 6_000 / RATE_DENOMINATOR,
  },
  holding: {
    annualRate: 200 / RATE_DENOMINATOR,
    maximumRate: 2_000 / RATE_DENOMINATOR,
  },
  aggregation: 'sum',
  maximumRate: ONE_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

/**
 * 2028년 다주택자 주택 장기거주소득공제 —
 * tax-rules-spec.md §4.4, 개편안 p56 및 p58.
 */
const MULTI_HOUSE_LONG_TERM_DEDUCTION_2028 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears: null,
  residence: MULTI_HOUSE_RESIDENCE_DEDUCTION_FROM_2028,
  holding: {
    annualRate: 100 / RATE_DENOMINATOR,
    maximumRate: 1_500 / RATE_DENOMINATOR,
  },
  aggregation: 'maximum',
  maximumRate: MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

export const TRANSFER_LONG_TERM_DEDUCTIONS_2028 = {
  oneHouse: ONE_HOUSE_LONG_TERM_DEDUCTION_2028,
  multiHouse: MULTI_HOUSE_LONG_TERM_DEDUCTION_2028,
} as const satisfies TransferLongTermDeductionRules

/**
 * 2029년 이후 1세대1주택 장기거주소득공제 —
 * tax-rules-spec.md §4.4, 개편안 p56~57.
 */
const ONE_HOUSE_LONG_TERM_DEDUCTION_FROM_2029 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears:
    ONE_HOUSE_LONG_TERM_DEDUCTION_MINIMUM_RESIDENCE_YEARS,
  residence: {
    annualRate: 800 / RATE_DENOMINATOR,
    maximumRate: ONE_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
  },
  holding: null,
  aggregation: 'sum',
  maximumRate: ONE_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

/**
 * 2029년 이후 다주택자 주택 장기거주소득공제 —
 * tax-rules-spec.md §4.4, 개편안 p56 및 p58.
 */
const MULTI_HOUSE_LONG_TERM_DEDUCTION_FROM_2029 = {
  minimumHoldingYears: LONG_TERM_DEDUCTION_MINIMUM_HOLDING_YEARS,
  minimumResidenceYears: null,
  residence: MULTI_HOUSE_RESIDENCE_DEDUCTION_FROM_2028,
  holding: null,
  aggregation: 'sum',
  maximumRate: MULTI_HOUSE_LONG_TERM_DEDUCTION_MAXIMUM_RATE,
} as const

export const TRANSFER_LONG_TERM_DEDUCTIONS_FROM_2029 = {
  oneHouse: ONE_HOUSE_LONG_TERM_DEDUCTION_FROM_2029,
  multiHouse: MULTI_HOUSE_LONG_TERM_DEDUCTION_FROM_2029,
} as const satisfies TransferLongTermDeductionRules

/** 장특공제 한도 — tax-rules-spec.md §4.5, 개편안 p59. */
export const TRANSFER_DEDUCTION_CAPS_2028 = {
  perPersonAnnual: 2_000_000_000,
  perProperty: 2_000_000_000,
  apportionment: 'ownershipOrDisposalShare',
} as const satisfies TransferDeductionCapRules

/** 2029년 이후 장특공제 한도 — tax-rules-spec.md §4.5, 개편안 p59. */
export const TRANSFER_DEDUCTION_CAPS_FROM_2029 = {
  perPersonAnnual: 1_000_000_000,
  perProperty: 1_000_000_000,
  apportionment: 'ownershipOrDisposalShare',
} as const satisfies TransferDeductionCapRules

/**
 * 양도소득 기본공제 — tax-rules-spec.md §4.6, 개편안 p68.
 * 일반 공제는 현행이고 장기거주 1주택 특례는 2027년 양도분부터 적용된다.
 */
const TRANSFER_STANDARD_BASIC_DEDUCTION = 2_500_000

export const TRANSFER_BASIC_DEDUCTIONS_2026 = {
  standardAnnualAmount: TRANSFER_STANDARD_BASIC_DEDUCTION,
  special: null,
} as const satisfies TransferBasicDeductionRules

/** 2027년 이후 장기거주 1주택 기본공제 — tax-rules-spec.md §4.6, 개편안 p68. */
export const TRANSFER_BASIC_DEDUCTIONS_FROM_2027 = {
  standardAnnualAmount: TRANSFER_STANDARD_BASIC_DEDUCTION,
  special: {
    annualAmount: 25_000_000,
    householdKind: 'oneHouse',
    minimumResidenceYears: 10,
    maximumSalePrice: 3_000_000_000,
    residentOnly: true,
    relatedPartyExcluded: true,
    perOwner: true,
    apportionment: 'ownershipOrDisposalShare',
  },
} as const satisfies TransferBasicDeductionRules

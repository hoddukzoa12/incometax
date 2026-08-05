import type {
  ComprehensiveTaxCreditResult,
} from '../../shared/holding-tax'
import type { OwnershipPeriod } from '../../shared/ownership'
import type {
  ComprehensivePeriodCreditKind,
  ComprehensiveTaxCreditRules,
  HouseholdKind,
  MinimumRateBand,
} from '../../shared/tax-rules'
import { roundTaxAmount } from '../rules'

const ZERO_AMOUNT = 0
const ZERO_RATE = 0

const findMinimumBandRate = (
  value: number,
  bands: readonly MinimumRateBand[],
): number =>
  bands.reduce(
    (applicableRate, band) =>
      value >= band.minimum ? band.rate : applicableRate,
    ZERO_RATE,
  )

const PERIOD_RATE_BY_KIND = {
  holding: (holdingRate: number): number => holdingRate,
  maximum: (holdingRate: number, residenceRate: number): number =>
    Math.max(holdingRate, residenceRate),
  residence: (_holdingRate: number, residenceRate: number): number =>
    residenceRate,
} as const satisfies Readonly<
  Record<
    ComprehensivePeriodCreditKind,
    (holdingRate: number, residenceRate: number) => number
  >
>

export const calculateComprehensiveTaxCredit = (
  householdKind: HouseholdKind,
  ownerAge: number | undefined,
  period: OwnershipPeriod,
  calculatedTax: number,
  rules: ComprehensiveTaxCreditRules,
): ComprehensiveTaxCreditResult => {
  if (householdKind !== 'oneHouse') {
    return {
      status: 'notApplicable',
      reason: 'notOneHouse',
      amount: ZERO_AMOUNT,
    }
  }

  if (calculatedTax <= ZERO_AMOUNT) {
    return {
      status: 'notApplicable',
      reason: 'noComprehensiveTax',
      amount: ZERO_AMOUNT,
    }
  }

  if (ownerAge === undefined) {
    return {
      status: 'notComputed',
      missingInputs: ['ownerAge'],
      amount: null,
    }
  }

  const ageRate = findMinimumBandRate(ownerAge, rules.ageRates)
  const holdingPeriodRate = findMinimumBandRate(
    period.holdingYears,
    rules.holdingPeriodRates,
  )
  const residencePeriodRate = findMinimumBandRate(
    period.residenceYears,
    rules.residencePeriodRates,
  )
  const periodRate = PERIOD_RATE_BY_KIND[rules.periodCreditKind](
    holdingPeriodRate,
    residencePeriodRate,
  )
  const nominalRate = ageRate + periodRate
  const appliedRate = Math.min(nominalRate, rules.maximumRate)
  const unroundedCalculatedAmount = calculatedTax * appliedRate
  const unroundedAmount =
    rules.amountCap === null
      ? unroundedCalculatedAmount
      : Math.min(unroundedCalculatedAmount, rules.amountCap)

  return {
    status: 'computed',
    ageRate,
    holdingPeriodRate,
    residencePeriodRate,
    periodRate,
    nominalRate,
    appliedRate,
    maximumRate: rules.maximumRate,
    calculatedAmount: roundTaxAmount(unroundedCalculatedAmount),
    amountCap: rules.amountCap,
    amount: roundTaxAmount(unroundedAmount),
    isRateCapped: nominalRate > rules.maximumRate,
    isAmountCapped:
      rules.amountCap !== null &&
      unroundedCalculatedAmount > rules.amountCap,
  }
}

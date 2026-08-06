import type {
  ComprehensiveResidenceRecognitionInput,
  ComprehensiveResidenceRecognitionResult,
} from '../../shared/comprehensive-residence-recognition'
import type {
  ComprehensiveTaxResult,
  PortfolioItem,
  PriorYearHoldingTax,
  PropertyTaxResult,
} from '../../shared/holding-tax'
import type {
  Bracket,
  ComprehensiveBasicDeductionRules,
  HouseholdKind,
  TaxRules,
} from '../../shared/tax-rules'
import {
  evaluateBracketTax,
  findApplicableTaxBracket,
  roundTaxAmount,
} from '../rules'
import { toActualResidencePeriod } from '../validation/ownership-period'
import { calculateComprehensiveTaxBurdenCap } from './comprehensive-tax-burden-cap'
import { calculateComprehensiveTaxCredit } from './comprehensive-tax-credit'
import { calculateComprehensiveResidenceRecognition } from './comprehensive-residence-recognition'

const ZERO_AMOUNT = 0
const ZERO_RATE = 0

const getBasicDeduction = (
  deductionRules: ComprehensiveBasicDeductionRules,
  householdKind: HouseholdKind,
  items: readonly PortfolioItem[],
  ownedOfficialPriceTotal: number,
  residentOwnedOfficialPrice: number,
): number => {
  if (householdKind === 'oneHouse') {
    return deductionRules.oneHouse[items[0].residency]
  }

  if (deductionRules.multiHouse.kind === 'fixed') {
    return deductionRules.multiHouse.amount
  }

  const residentShare =
    ownedOfficialPriceTotal > ZERO_AMOUNT
      ? residentOwnedOfficialPrice / ownedOfficialPriceTotal
      : ZERO_RATE

  return (
    deductionRules.multiHouse.base +
    deductionRules.multiHouse.residentHomeShareMaximum * residentShare
  )
}

const getFairMarketValueRatio = (
  rules: TaxRules['comprehensiveTax'],
  householdKind: HouseholdKind,
  homeCount: number,
  hasAdjustedAreaProperty: boolean,
): number => {
  if (householdKind === 'oneHouse') {
    return rules.fairMarketValueRatios.oneHouse
  }

  const usesElevatedRatio =
    homeCount >= rules.elevatedHomeCountMinimum || hasAdjustedAreaProperty
  return usesElevatedRatio
    ? rules.fairMarketValueRatios.multiHouse.threeOrMoreOrAdjusted
    : rules.fairMarketValueRatios.multiHouse.standard
}

const getBrackets = (
  rules: TaxRules['comprehensiveTax'],
  homeCount: number,
): readonly Bracket[] => {
  if (rules.brackets.kind === 'unified') {
    return rules.brackets.brackets
  }

  return homeCount >= rules.elevatedHomeCountMinimum
    ? rules.brackets.threeOrMoreHomes
    : rules.brackets.upToTwoHomes
}

const createNotTaxableResult = (
  homeCount: number,
  ownedOfficialPriceTotal: number,
  residentOwnedOfficialPrice: number,
  taxableThreshold: number,
  basicDeduction: number,
  fairMarketValueRatio: number,
  propertyTaxFairMarketValueRatio: number,
  residenceRecognition: ComprehensiveResidenceRecognitionResult,
): ComprehensiveTaxResult => ({
  status: 'notTaxable',
  homeCount,
  ownedOfficialPriceTotal: roundTaxAmount(ownedOfficialPriceTotal),
  residentOwnedOfficialPrice: roundTaxAmount(residentOwnedOfficialPrice),
  taxableThreshold,
  basicDeduction: roundTaxAmount(basicDeduction),
  fairMarketValueRatio,
  taxableBase: ZERO_AMOUNT,
  appliedRate: {
    rate: ZERO_RATE,
    progressiveDeduction: ZERO_AMOUNT,
  },
  baseTax: ZERO_AMOUNT,
  propertyTaxFairMarketValueRatio,
  propertyTaxCredit: ZERO_AMOUNT,
  netTax: ZERO_AMOUNT,
  residenceRecognition,
  taxCredit: {
    status: 'notApplicable',
    reason: 'noComprehensiveTax',
    amount: ZERO_AMOUNT,
  },
  taxBurdenCap: {
    status: 'notApplicable',
    reason: 'noComprehensiveTax',
    excessAmount: ZERO_AMOUNT,
  },
  payableTax: ZERO_AMOUNT,
  ruralSpecialTax: ZERO_AMOUNT,
  totalTax: ZERO_AMOUNT,
})

export const calculateComprehensiveTax = (
  items: readonly PortfolioItem[],
  householdKind: HouseholdKind,
  propertyTaxHouseholdKind: HouseholdKind,
  householdHomeCount: number,
  propertyTaxes: readonly PropertyTaxResult[],
  ownerAge: number | undefined,
  residenceRecognitionInput:
    | ComprehensiveResidenceRecognitionInput
    | undefined,
  priorYearTax: PriorYearHoldingTax | undefined,
  rules: TaxRules,
): ComprehensiveTaxResult => {
  const homeCount = householdHomeCount
  const ownedOfficialPrices = items.map(
    (item) => item.officialPrice * item.ownershipShare,
  )
  const ownedOfficialPriceTotal = ownedOfficialPrices.reduce(
    (total, officialPrice) => total + officialPrice,
    ZERO_AMOUNT,
  )
  const residentOwnedOfficialPrice = items.reduce(
    (total, item, itemIndex) =>
      item.residency === 'residing'
        ? total + ownedOfficialPrices[itemIndex]
        : total,
    ZERO_AMOUNT,
  )
  const actualResidencePeriod = toActualResidencePeriod(items[0])
  const residenceRecognition =
    householdKind === 'oneHouse'
      ? calculateComprehensiveResidenceRecognition(
          actualResidencePeriod,
          residenceRecognitionInput,
          rules.comprehensiveTax.taxCredit.residenceRecognition,
        )
      : {
          status: 'notApplicable',
          reason: 'notOneHouse',
          creditPeriod: {
            basis: 'comprehensiveTaxCreditResidence',
            actualYears: actualResidencePeriod.years,
            recognizedYears: ZERO_AMOUNT,
            years: actualResidencePeriod.years,
          },
        } as const satisfies ComprehensiveResidenceRecognitionResult
  const taxableThreshold =
    rules.comprehensiveTax.taxableThresholds[householdKind]
  const basicDeduction = getBasicDeduction(
    rules.comprehensiveTax.basicDeductions,
    householdKind,
    items,
    ownedOfficialPriceTotal,
    residentOwnedOfficialPrice,
  )
  const fairMarketValueRatio = getFairMarketValueRatio(
    rules.comprehensiveTax,
    householdKind,
    homeCount,
    items.some(({ areaKind }) => areaKind === 'adjusted'),
  )
  const propertyTaxFairMarketValueRatio =
    propertyTaxHouseholdKind === 'oneHouse'
      ? propertyTaxes[0].fairMarketValueRatio
      : rules.propertyTax.fairMarketValueRatios.other

  if (ownedOfficialPriceTotal <= taxableThreshold) {
    return createNotTaxableResult(
      homeCount,
      ownedOfficialPriceTotal,
      residentOwnedOfficialPrice,
      taxableThreshold,
      basicDeduction,
      fairMarketValueRatio,
      propertyTaxFairMarketValueRatio,
      residenceRecognition,
    )
  }

  const taxableBase = Math.max(
    ZERO_AMOUNT,
    (ownedOfficialPriceTotal - basicDeduction) * fairMarketValueRatio,
  )
  const brackets = getBrackets(rules.comprehensiveTax, homeCount)
  const bracket = findApplicableTaxBracket(taxableBase, brackets)
  const baseTax = evaluateBracketTax(taxableBase, brackets)
  const propertyTaxCredit =
    taxableBase *
    propertyTaxFairMarketValueRatio *
    rules.comprehensiveTax.propertyTaxCreditRate
  const unroundedNetTax = Math.max(
    ZERO_AMOUNT,
    baseTax - propertyTaxCredit,
  )
  const netTax = roundTaxAmount(unroundedNetTax)
  const taxCredit = calculateComprehensiveTaxCredit(
    householdKind,
    ownerAge,
    items[0],
    residenceRecognition,
    netTax,
    rules.comprehensiveTax.taxCredit,
  )
  const propertyBaseTaxTotal = propertyTaxes.reduce(
    (total, propertyTax) => total + propertyTax.baseTax,
    ZERO_AMOUNT,
  )
  const taxBurdenCap = calculateComprehensiveTaxBurdenCap(
    propertyBaseTaxTotal,
    netTax,
    priorYearTax,
    rules.comprehensiveTax.taxBurdenCap,
  )
  const unroundedPayableTax =
    taxCredit.amount === null
      ? null
      : Math.max(
          ZERO_AMOUNT,
          unroundedNetTax - taxCredit.amount - taxBurdenCap.excessAmount,
        )
  const payableTax =
    unroundedPayableTax === null
      ? null
      : roundTaxAmount(unroundedPayableTax)
  const ruralSpecialTax =
    unroundedPayableTax === null
      ? null
      : roundTaxAmount(
          unroundedPayableTax *
            rules.comprehensiveTax.ruralSpecialTaxRate,
        )
  const totalTax =
    payableTax === null || ruralSpecialTax === null
      ? null
      : payableTax + ruralSpecialTax

  return {
    status: 'taxable',
    homeCount,
    ownedOfficialPriceTotal: roundTaxAmount(ownedOfficialPriceTotal),
    residentOwnedOfficialPrice: roundTaxAmount(residentOwnedOfficialPrice),
    taxableThreshold,
    basicDeduction: roundTaxAmount(basicDeduction),
    fairMarketValueRatio,
    taxableBase: roundTaxAmount(taxableBase),
    appliedRate: {
      rate: bracket.rate,
      progressiveDeduction: bracket.progressiveDeduction,
    },
    baseTax: roundTaxAmount(baseTax),
    propertyTaxFairMarketValueRatio,
    propertyTaxCredit: roundTaxAmount(propertyTaxCredit),
    netTax,
    residenceRecognition,
    taxCredit,
    taxBurdenCap,
    payableTax,
    ruralSpecialTax,
    totalTax,
  }
}

import type {
  ComprehensiveResidenceRecognitionInput,
  ComprehensiveResidenceRecognitionResult,
} from '../../shared/comprehensive-residence-recognition'
import type {
  ComprehensivePropertyTaxSubtotalResult,
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

const calculatePropertyTaxSubtotal = (
  propertyTaxes: readonly PropertyTaxResult[],
  rules: TaxRules,
): ComprehensivePropertyTaxSubtotalResult => {
  // 과세표준상한 적용 전(uncapped) 합계로 산출세액을 구한다.
  // 공제할재산세액의 분모(v3.3 엑셀 F15)는 상한 전 산출세액이다.
  const taxableBase = propertyTaxes.reduce(
    (total, propertyTax) => total + propertyTax.uncappedFullTaxableBase,
    ZERO_AMOUNT,
  )
  const brackets = rules.propertyTax.brackets.general
  const bracket = findApplicableTaxBracket(taxableBase, brackets)
  const calculatedTax = evaluateBracketTax(taxableBase, brackets)
  const propertyTax = propertyTaxes.reduce(
    (total, item) => total + item.fullBaseTax,
    ZERO_AMOUNT,
  )

  return {
    taxableBase: roundTaxAmount(taxableBase),
    appliedRate: {
      rate: bracket.rate,
      progressiveDeduction: bracket.progressiveDeduction,
    },
    calculatedTax: roundTaxAmount(calculatedTax),
    propertyTax: roundTaxAmount(propertyTax),
  }
}

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
  propertyTaxSubtotal: ComprehensivePropertyTaxSubtotalResult,
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
  propertyTaxSubtotal,
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
    rules.propertyTax.fairMarketValueRatios.other
  const propertyTaxSubtotal = calculatePropertyTaxSubtotal(
    propertyTaxes,
    rules,
  )

  if (ownedOfficialPriceTotal <= taxableThreshold) {
    return createNotTaxableResult(
      homeCount,
      ownedOfficialPriceTotal,
      residentOwnedOfficialPrice,
      taxableThreshold,
      basicDeduction,
      fairMarketValueRatio,
      propertyTaxFairMarketValueRatio,
      propertyTaxSubtotal,
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
  // 공제할재산세액 — holding-tax-v3-spec.md §3.8의 주택소계 수식을 그대로 적용한다.
  const propertyTaxCredit =
    propertyTaxSubtotal.propertyTax *
    (
      taxableBase *
      propertyTaxFairMarketValueRatio *
      propertyTaxSubtotal.appliedRate.rate
    ) /
    propertyTaxSubtotal.calculatedTax
  const calculatedTaxBeforeMinimum = baseTax - propertyTaxCredit
  const unroundedNetTax =
    rules.comprehensiveTax.calculatedTaxMinimum === null
      ? calculatedTaxBeforeMinimum
      : Math.max(
          rules.comprehensiveTax.calculatedTaxMinimum,
          calculatedTaxBeforeMinimum,
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
  // v3.3 엑셀: B55(세액공제 후) → B56(세부담상한) → B57(종합부동산세).
  // 세부담상한의 당해 기준은 재산세 + 세액공제 후 종부세다.
  const afterCredit = taxCredit.amount === null
    ? null
    : unroundedNetTax - taxCredit.amount
  const taxBurdenCap = calculateComprehensiveTaxBurdenCap(
    propertyBaseTaxTotal,
    afterCredit !== null ? roundTaxAmount(afterCredit) : netTax,
    priorYearTax,
    rules.comprehensiveTax.taxBurdenCap,
  )
  const payableTaxBeforeMinimum = afterCredit === null
    ? null
    : afterCredit - taxBurdenCap.excessAmount
  const unroundedPayableTax = payableTaxBeforeMinimum === null
    ? null
    : rules.comprehensiveTax.payableTaxMinimum === null
      ? payableTaxBeforeMinimum
      : Math.max(
          rules.comprehensiveTax.payableTaxMinimum,
          payableTaxBeforeMinimum,
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
    propertyTaxSubtotal,
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

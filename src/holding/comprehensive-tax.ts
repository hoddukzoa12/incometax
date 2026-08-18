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
  PropertyTaxCreditNumeratorFairMarketValueRatioBasis,
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
  propertyTaxFairMarketValueRatio: number,
  rules: TaxRules,
): ComprehensivePropertyTaxSubtotalResult => {
  // v3.5 엑셀 단독보유 N12: 1세대1주택이면 재산세 공정시장가액비율(J12),
  // 그 외에는 60%를 공제할재산세액 분모에 쓴다. 종부세 대상 1세대1주택은
  // 공시가격이 6억을 초과하므로 J12가 45%다.
  const officialPriceTotal = propertyTaxes.reduce(
    (total, propertyTax) => total + propertyTax.fullOfficialPrice,
    ZERO_AMOUNT,
  )
  const taxableBase = officialPriceTotal * propertyTaxFairMarketValueRatio
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

  return usesElevatedMultiHouseRules(
    rules,
    householdKind,
    homeCount,
    hasAdjustedAreaProperty,
  )
    ? rules.fairMarketValueRatios.multiHouse.threeOrMoreOrAdjusted
    : rules.fairMarketValueRatios.multiHouse.standard
}

/**
 * 개편안 p62 ❶: 1세대1주택자를 제외한 3주택 이상 또는 조정대상지역 주택 보유자.
 * 공정시장가액비율과 주택 수별 세율표는 이 분류를 함께 사용한다.
 */
const usesElevatedMultiHouseRules = (
  rules: TaxRules['comprehensiveTax'],
  householdKind: HouseholdKind,
  homeCount: number,
  hasAdjustedAreaProperty: boolean,
): boolean =>
  householdKind === 'multiHouse' &&
  (homeCount >= rules.elevatedHomeCountMinimum || hasAdjustedAreaProperty)

const getBrackets = (
  rules: TaxRules['comprehensiveTax'],
  householdKind: HouseholdKind,
  homeCount: number,
  hasAdjustedAreaProperty: boolean,
): readonly Bracket[] => {
  if (rules.brackets.kind === 'unified') {
    return rules.brackets.brackets
  }

  return usesElevatedMultiHouseRules(
    rules,
    householdKind,
    homeCount,
    hasAdjustedAreaProperty,
  )
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
  taxAfterCreditBeforeBurdenCap: ZERO_AMOUNT,
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
  const hasAdjustedAreaProperty = items.some(
    ({ areaKind }) => areaKind === 'adjusted',
  )
  const fairMarketValueRatio = getFairMarketValueRatio(
    rules.comprehensiveTax,
    householdKind,
    homeCount,
    hasAdjustedAreaProperty,
  )
  const propertyTaxFairMarketValueRatio =
    householdKind === 'oneHouse'
      ? propertyTaxes[0].fairMarketValueRatio
      : rules.propertyTax.fairMarketValueRatios.other
  const propertyTaxCreditNumeratorFairMarketValueRatioByBasis = {
    propertyTax: propertyTaxFairMarketValueRatio,
    other: rules.propertyTax.fairMarketValueRatios.other,
  } as const satisfies Readonly<
    Record<PropertyTaxCreditNumeratorFairMarketValueRatioBasis, number>
  >
  const propertyTaxCreditNumeratorFairMarketValueRatio =
    propertyTaxCreditNumeratorFairMarketValueRatioByBasis[
      rules.comprehensiveTax.propertyTaxCreditNumeratorFairMarketValueRatioBasis[
        householdKind
      ]
    ]
  const propertyTaxSubtotal = calculatePropertyTaxSubtotal(
    propertyTaxes,
    propertyTaxFairMarketValueRatio,
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
  const brackets = getBrackets(
    rules.comprehensiveTax,
    householdKind,
    homeCount,
    hasAdjustedAreaProperty,
  )
  const bracket = findApplicableTaxBracket(taxableBase, brackets)
  const baseTax = evaluateBracketTax(taxableBase, brackets)
  const propertyTaxCredit =
    propertyTaxSubtotal.propertyTax *
    (
      taxableBase *
      propertyTaxCreditNumeratorFairMarketValueRatio *
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
    items[0].residency,
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
  const taxAfterCreditBeforeBurdenCap = afterCredit === null
    ? null
    : roundTaxAmount(afterCredit)
  const taxBurdenCap = calculateComprehensiveTaxBurdenCap(
    propertyBaseTaxTotal,
    taxAfterCreditBeforeBurdenCap ?? netTax,
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
    payableTax === null
      ? null
      : roundTaxAmount(
          payableTax * rules.comprehensiveTax.ruralSpecialTaxRate,
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
    taxAfterCreditBeforeBurdenCap,
    taxBurdenCap,
    payableTax,
    ruralSpecialTax,
    totalTax,
  }
}

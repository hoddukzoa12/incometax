import type {
  ComprehensiveTaxResult,
  PortfolioItem,
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
  ruralSpecialTax: ZERO_AMOUNT,
  totalTax: ZERO_AMOUNT,
})

export const calculateComprehensiveTax = (
  items: readonly PortfolioItem[],
  householdKind: HouseholdKind,
  propertyTaxHouseholdKind: HouseholdKind,
  householdHomeCount: number,
  propertyTaxes: readonly PropertyTaxResult[],
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
  const ruralSpecialTax = roundTaxAmount(
    unroundedNetTax * rules.comprehensiveTax.ruralSpecialTaxRate,
  )

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
    ruralSpecialTax,
    totalTax: netTax + ruralSpecialTax,
  }
}

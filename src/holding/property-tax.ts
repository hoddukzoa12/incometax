import type {
  PortfolioItem,
  PropertyTaxResult,
} from '../../shared/holding-tax'
import type {
  HouseholdKind,
  PropertyTaxRules,
  RateBand,
} from '../../shared/tax-rules'
import {
  evaluateBracketTax,
  findApplicableTaxBracket,
  roundTaxAmount,
} from '../rules'

const MISSING_RATE_BAND_MESSAGE =
  'No property-tax fair-market-value ratio covers the official price'

const findRateBand = (
  officialPrice: number,
  bands: readonly RateBand[],
): RateBand => {
  const band = bands.find(({ upTo }) => officialPrice <= upTo)

  if (!band) {
    throw new RangeError(MISSING_RATE_BAND_MESSAGE)
  }

  return band
}

const getFairMarketValueRatio = (
  item: PortfolioItem,
  householdKind: HouseholdKind,
  rules: PropertyTaxRules,
): number =>
  householdKind === 'oneHouse'
    ? findRateBand(item.officialPrice, rules.fairMarketValueRatios.oneHouse).rate
    : rules.fairMarketValueRatios.other

const calculateFullTaxableBase = (
  item: PortfolioItem,
  fairMarketValueRatio: number,
  rules: PropertyTaxRules,
): {
  readonly uncapped: number
  readonly cap: number | null
  readonly applied: boolean
  readonly amount: number
} => {
  const uncapped = item.officialPrice * fairMarketValueRatio
  const cap = item.priorOfficialPrice === undefined
    ? null
    : item.priorOfficialPrice * fairMarketValueRatio +
      uncapped * rules.taxableBaseCapGrowthRate
  const amount = cap === null ? uncapped : Math.min(uncapped, cap)

  return {
    uncapped,
    cap,
    applied: cap !== null && amount < uncapped,
    amount,
  }
}

export const calculatePropertyTax = (
  item: PortfolioItem,
  itemIndex: number,
  householdKind: HouseholdKind,
  rules: PropertyTaxRules,
): PropertyTaxResult => {
  const fairMarketValueRatio = getFairMarketValueRatio(
    item,
    householdKind,
    rules,
  )
  const fullTaxableBaseResult = calculateFullTaxableBase(
    item,
    fairMarketValueRatio,
    rules,
  )
  const fullTaxableBase = fullTaxableBaseResult.amount
  const preferentialRateApplied =
    householdKind === 'oneHouse' &&
    item.officialPrice <= rules.preferentialRateMaximumOfficialPrice
  const brackets = preferentialRateApplied
    ? rules.brackets.oneHouse
    : rules.brackets.general
  const bracket = findApplicableTaxBracket(fullTaxableBase, brackets)
  const fullBaseTax = evaluateBracketTax(fullTaxableBase, brackets)
  const surtaxBases = {
    baseTax: fullBaseTax,
    taxableBase: fullTaxableBase,
  } as const
  const localEducationTax = roundTaxAmount(
    surtaxBases[rules.surtaxes.localEducation.base] *
      rules.surtaxes.localEducation.rate *
      item.ownershipShare,
  )
  const cityAreaTax = roundTaxAmount(
    surtaxBases[rules.surtaxes.cityArea.base] *
      rules.surtaxes.cityArea.rate *
      item.ownershipShare,
  )
  const baseTax = roundTaxAmount(fullBaseTax * item.ownershipShare)

  return {
    itemIndex,
    ownershipShare: item.ownershipShare,
    fullOfficialPrice: item.officialPrice,
    priorOfficialPrice: item.priorOfficialPrice ?? null,
    ownedOfficialPrice: roundTaxAmount(
      item.officialPrice * item.ownershipShare,
    ),
    fairMarketValueRatio,
    uncappedFullTaxableBase: roundTaxAmount(
      fullTaxableBaseResult.uncapped,
    ),
    fullTaxableBaseCap: fullTaxableBaseResult.cap === null
      ? null
      : roundTaxAmount(fullTaxableBaseResult.cap),
    taxableBaseCapApplied: fullTaxableBaseResult.applied,
    fullTaxableBase: roundTaxAmount(fullTaxableBase),
    taxableBase: roundTaxAmount(fullTaxableBase * item.ownershipShare),
    preferentialRateApplied,
    appliedRate: {
      rate: bracket.rate,
      progressiveDeduction: bracket.progressiveDeduction,
    },
    fullBaseTax: roundTaxAmount(fullBaseTax),
    baseTax,
    localEducationTax,
    cityAreaTax,
    totalTax: baseTax + localEducationTax + cityAreaTax,
  }
}

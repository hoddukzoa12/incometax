import type { StoredPortfolioItem } from '../../shared/portfolio'

const ISO_YEAR_END_INDEX = 4
const MINIMUM_HISTORY_POINTS = 2
const ONE_YEAR = 1
const RECENT_HISTORY_POINT_COUNT = 5
const RECENT_CAGR_MAXIMUM_YEARS = 5

export type OfficialPriceHistoryPoint = {
  readonly year: number
  readonly price: number
  readonly changeRate: number | null
}

export type OfficialPriceHistorySummary = {
  readonly itemId: string
  readonly complexName: string
  readonly points: readonly OfficialPriceHistoryPoint[]
  readonly recentPoints: readonly OfficialPriceHistoryPoint[]
  readonly recentElapsedYears: number
  readonly recentCompoundAnnualGrowthRate: number | null
  readonly highestRise: OfficialPriceHistoryPoint | null
  readonly deepestFall: OfficialPriceHistoryPoint | null
}

const yearFromBaseDate = (baseDate: string): number | null => {
  const year = Number(baseDate.slice(0, ISO_YEAR_END_INDEX))
  return Number.isSafeInteger(year) ? year : null
}

const selectExtreme = (
  points: readonly OfficialPriceHistoryPoint[],
  shouldReplace: (
    candidate: OfficialPriceHistoryPoint,
    current: OfficialPriceHistoryPoint,
  ) => boolean,
): OfficialPriceHistoryPoint | null => {
  let extreme: OfficialPriceHistoryPoint | null = null
  for (const point of points) {
    if (point.changeRate === null) continue
    if (extreme === null || shouldReplace(point, extreme)) extreme = point
  }
  return extreme
}

export const officialPriceHistorySummary = (
  item: StoredPortfolioItem,
): OfficialPriceHistorySummary => {
  const pricesByYear = new Map<number, number>()
  for (const { baseDate, price } of item.priorOfficialPrices) {
    const year = yearFromBaseDate(baseDate)
    if (year !== null) pricesByYear.set(year, price)
  }
  if (
    item.officialPrice !== null &&
    item.officialPriceBaseDate !== null
  ) {
    const year = yearFromBaseDate(item.officialPriceBaseDate)
    if (year !== null) pricesByYear.set(year, item.officialPrice)
  }

  const entries = [...pricesByYear.entries()].sort(
    ([leftYear], [rightYear]) => leftYear - rightYear,
  )
  const points = entries.map(([year, price], index) => ({
    year,
    price,
    changeRate: index === 0 ||
      year - entries[index - 1][0] !== ONE_YEAR
      ? null
      : price / entries[index - 1][1] - 1,
  }))
  const last = points.at(-1)
  const recentMinimumYear = last === undefined
    ? null
    : last.year - RECENT_CAGR_MAXIMUM_YEARS
  const recentCagrPoints = recentMinimumYear === null
    ? []
    : points.filter(({ year }) => year >= recentMinimumYear)
  const recentFirst = recentCagrPoints[0]
  const recentElapsedYears = recentFirst === undefined || last === undefined
    ? 0
    : last.year - recentFirst.year
  const recentCompoundAnnualGrowthRate =
    recentCagrPoints.length < MINIMUM_HISTORY_POINTS ||
      recentElapsedYears <= 0
      ? null
      : (last!.price / recentFirst!.price) **
        (ONE_YEAR / recentElapsedYears) - ONE_YEAR
  const changedPoints = points.filter(({ changeRate }) => changeRate !== null)
  const highestRise = selectExtreme(
    changedPoints.filter(({ changeRate }) => changeRate! > 0),
    (candidate, current) => candidate.changeRate! > current.changeRate!,
  )
  const deepestFall = selectExtreme(
    changedPoints.filter(({ changeRate }) => changeRate! < 0),
    (candidate, current) => candidate.changeRate! < current.changeRate!,
  )

  return {
    itemId: item.id,
    complexName: item.complexName,
    points,
    recentPoints: points.slice(-RECENT_HISTORY_POINT_COUNT),
    recentElapsedYears,
    recentCompoundAnnualGrowthRate,
    highestRise,
    deepestFall,
  }
}

import { TRADE_SOURCES, type TradeDataset } from '../../shared/trade.ts'

const RECENT_MONTH_OFFSET_COUNT = 12
const RECENT_WINDOW_DAYS = 365
const ONE_DAY_MS = 24 * 60 * 60 * 1_000
const SEOUL_TIME_ZONE = 'Asia/Seoul'

const seoulDateParts = (
  now: Date,
): { readonly year: number; readonly month: number; readonly day: number } => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SEOUL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return { year: values.year, month: values.month, day: values.day }
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10)

export const recentDealYearMonths = (now: Date): readonly string[] => {
  const current = seoulDateParts(now)
  const months: string[] = []

  for (let offset = 0; offset <= RECENT_MONTH_OFFSET_COUNT; offset += 1) {
    const zeroBasedMonth = current.month - 1 - offset
    const date = new Date(Date.UTC(current.year, zeroBasedMonth, 1))
    months.push(
      `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    )
  }
  return months
}

export const tradeWindowDates = (
  now: Date,
): { readonly cutoffDate: string; readonly windowEndDate: string } => {
  const current = seoulDateParts(now)
  const windowEnd = new Date(
    Date.UTC(current.year, current.month - 1, current.day),
  )
  const cutoff = new Date(windowEnd.getTime() - RECENT_WINDOW_DAYS * ONE_DAY_MS)
  return { cutoffDate: isoDate(cutoff), windowEndDate: isoDate(windowEnd) }
}

export const createTradeDatasets = (
  legalDistrictCodes: readonly string[],
  dealYearMonths: readonly string[],
): readonly TradeDataset[] =>
  legalDistrictCodes.flatMap((legalDistrictCode) =>
    dealYearMonths.flatMap((dealYearMonth) =>
      TRADE_SOURCES.map((source) => ({
        source,
        legalDistrictCode,
        dealYearMonth,
      })),
    ),
  )

export const tradeDatasetKey = (dataset: TradeDataset): string =>
  `${dataset.source}|${dataset.legalDistrictCode}|${dataset.dealYearMonth}`

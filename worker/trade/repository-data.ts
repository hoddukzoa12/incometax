import {
  TRADE_SOURCES,
  type ComplexMatchCandidate,
  type ComplexMatchCandidateRow,
  type TradeDatasetCheckpointRow,
  type TradeRefreshState,
  type TradeRefreshStateRow,
  type TradeRefreshValidation,
  type TradeRefreshValidationRow,
  type TradeSource,
} from '../../shared/trade.ts'
import { tradeDatasetKey } from './window.ts'

const parseStringArray = (value: string, field: string): readonly string[] => {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new TypeError(`Invalid ${field}`)
  }
  return parsed
}

export const toComplexMatchCandidate = (
  row: ComplexMatchCandidateRow,
): ComplexMatchCandidate => ({
  complexId: row.complex_id,
  name: row.name,
  legalAddress: row.legal_address,
  legalDongCode: row.legal_dong_code,
})

export const toTradeRefreshState = (
  row: TradeRefreshStateRow,
): TradeRefreshState => {
  if (row.status !== 'inProgress' && row.status !== 'completed') {
    throw new TypeError(`Invalid trade refresh status: ${row.status}`)
  }
  return {
    refreshId: row.refresh_id,
    status: row.status,
    cutoffDate: row.cutoff_date,
    windowEndDate: row.window_end_date,
    legalDistrictCodes: parseStringArray(
      row.legal_district_codes_json,
      'legal district codes',
    ),
    dealYearMonths: parseStringArray(
      row.deal_year_months_json,
      'deal year months',
    ),
    datasetCount: Number(row.dataset_count),
  }
}

export const toTradeRefreshValidation = (
  row: TradeRefreshValidationRow,
): TradeRefreshValidation => ({
  completedDatasetCount: Number(row.completed_dataset_count),
  rawCount: Number(row.raw_count),
  canceledCount: Number(row.canceled_count),
  duplicateCount: Number(row.duplicate_count),
  outsideWindowCount: Number(row.outside_window_count),
  activeCount: Number(row.active_count),
  matchedCount: Number(row.matched_count),
  lotCount: Number(row.lot_count),
  candidateCount: Number(row.candidate_count),
  ambiguousCount: Number(row.ambiguous_count),
  unmatchedCount: Number(row.unmatched_count),
  stagedTradeCount: Number(row.staged_trade_count),
  orphanTradeCount: Number(row.orphan_trade_count),
})

const isTradeSource = (value: string): value is TradeSource =>
  TRADE_SOURCES.some((source) => source === value)

export const tradeCheckpointKey = (row: TradeDatasetCheckpointRow): string => {
  if (!isTradeSource(row.source)) {
    throw new TypeError(`Invalid trade source: ${row.source}`)
  }
  return tradeDatasetKey({
    source: row.source,
    legalDistrictCode: row.legal_district_code,
    dealYearMonth: row.deal_year_month,
  })
}

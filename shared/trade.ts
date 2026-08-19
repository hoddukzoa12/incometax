export const TRADE_SOURCES = ['apt', 'rowhouse', 'officetel'] as const

export type TradeSource = (typeof TRADE_SOURCES)[number]
export type TradeMatchLevel = 'lot' | 'candidate'

export interface RawTrade {
  readonly source: TradeSource
  readonly legalDongName: string
  readonly jibun: string
  readonly buildingName: string
  readonly houseType: string
  readonly floor: number | null
  readonly exclusiveArea: number
  readonly landArea: string
  readonly totalFloorArea: string
  readonly dealDate: string
  readonly dealAmount: number
  readonly cancellationType: string
  readonly cancellationDate: string
}

export interface ComplexMatchCandidate {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly legalDongCode: string
}

export interface ComplexMatchCandidateRow {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly legal_dong_code: string
}

export interface PreparedComplexMatchCandidate extends ComplexMatchCandidate {
  readonly legalDongName: string
  readonly normalizedJibun: string
  readonly normalizedName: string
}

export type TradeMatchResult =
  | {
      readonly status: 'matched'
      readonly matchLevel: TradeMatchLevel
      readonly complex: PreparedComplexMatchCandidate
    }
  | { readonly status: 'ambiguous' }
  | { readonly status: 'unmatched' }

export interface StagedTrade {
  readonly tradeId: string
  readonly complexId: string
  readonly source: TradeSource
  readonly matchLevel: TradeMatchLevel
  readonly dealDate: string
  readonly dealAmount: number
  readonly exclusiveArea: number
  readonly floor: number | null
}

export interface TradeDataset {
  readonly source: TradeSource
  readonly legalDistrictCode: string
  readonly dealYearMonth: string
}

export interface TradeDatasetStats {
  readonly rawCount: number
  readonly canceledCount: number
  readonly duplicateCount: number
  readonly outsideWindowCount: number
  readonly activeCount: number
  readonly matchedCount: number
  readonly lotCount: number
  readonly candidateCount: number
  readonly ambiguousCount: number
  readonly unmatchedCount: number
}

export interface TradeDatasetResult {
  readonly dataset: TradeDataset
  readonly trades: readonly StagedTrade[]
  readonly stats: TradeDatasetStats
}

export interface TradeRefreshPlan {
  readonly refreshId: string
  readonly cutoffDate: string
  readonly windowEndDate: string
  readonly legalDistrictCodes: readonly string[]
  readonly dealYearMonths: readonly string[]
  readonly datasetCount: number
}

export interface TradeRefreshState extends TradeRefreshPlan {
  readonly status: 'inProgress' | 'completed'
}

export interface TradeRefreshStateRow {
  readonly refresh_id: string
  readonly status: string
  readonly cutoff_date: string
  readonly window_end_date: string
  readonly legal_district_codes_json: string
  readonly deal_year_months_json: string
  readonly dataset_count: number
}

export interface TradeRefreshValidation extends TradeDatasetStats {
  readonly completedDatasetCount: number
  readonly stagedTradeCount: number
  readonly orphanTradeCount: number
}

export interface TradeRefreshValidationRow {
  readonly completed_dataset_count: number
  readonly raw_count: number
  readonly canceled_count: number
  readonly duplicate_count: number
  readonly outside_window_count: number
  readonly active_count: number
  readonly matched_count: number
  readonly lot_count: number
  readonly candidate_count: number
  readonly ambiguous_count: number
  readonly unmatched_count: number
  readonly staged_trade_count: number
  readonly orphan_trade_count: number
}

export interface TradeDatasetCheckpointRow {
  readonly source: string
  readonly legal_district_code: string
  readonly deal_year_month: string
}

export interface TradeRefreshRepository {
  loadComplexes(): Promise<readonly ComplexMatchCandidate[]>
  readRefreshState(): Promise<TradeRefreshState | null>
  startRefresh(plan: TradeRefreshPlan, startedAt: string): Promise<void>
  readCompletedDatasetKeys(refreshId: string): Promise<ReadonlySet<string>>
  saveDataset(
    refreshId: string,
    result: TradeDatasetResult,
    updatedAt: string,
  ): Promise<void>
  readValidation(refreshId: string): Promise<TradeRefreshValidation>
  activate(refreshId: string, completedAt: string): Promise<void>
}

export interface TradeRefreshRunResult {
  readonly refreshId: string
  readonly activated: boolean
  readonly processedDatasetCount: number
  readonly remainingDatasetCount: number
  readonly failures: readonly string[]
  readonly validation: TradeRefreshValidation
}

export interface RecentTrade {
  readonly tradeId: string
  readonly source: TradeSource
  readonly matchLevel: TradeMatchLevel
  readonly dealDate: string
  readonly dealAmount: number
  readonly exclusiveArea: number
  readonly floor: number | null
}

export interface AddressTradeTarget {
  readonly legalDongCode: string
  readonly jibunAddress: string
  readonly complexName: string
}

export interface AddressTradeLookupResult {
  readonly trades: readonly RecentTrade[]
  readonly partial: boolean
}

export interface AddressTradesResponse {
  readonly items: readonly RecentTrade[]
  readonly partial?: boolean
}

export interface ComplexTradesResponse {
  readonly complexId: string
  readonly items: readonly RecentTrade[]
}

export interface YearlyTradeAverage {
  readonly year: string
  readonly averageAmount: number
  readonly tradeCount: number
}

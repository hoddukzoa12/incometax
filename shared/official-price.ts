import type { AssetKind } from './assets'

export interface ApartmentOfficialPriceRequest {
  readonly assetKind: 'apartment'
  readonly key: string
  readonly address: string
  readonly complexName: string
  readonly dong: string
  readonly room: string
  readonly pnu?: string
}

export interface DetachedHouseOfficialPriceRequest {
  readonly assetKind: 'detachedHouse'
  readonly key: string
  readonly address: string
  readonly pnu?: string
}

export type OfficialPriceRequest =
  | ApartmentOfficialPriceRequest
  | DetachedHouseOfficialPriceRequest

export interface OfficialPriceHistoryItem {
  readonly baseDate: string
  readonly price: number
  readonly exclusiveArea: number | null
}

export interface OfficialPriceHistory {
  readonly assetKind: AssetKind
  readonly pnu: string
  readonly detailAddress: string
  readonly items: readonly OfficialPriceHistoryItem[]
}

export type OfficialPriceNoDataReason =
  | 'addressNotFound'
  | 'complexNotFound'
  | 'dongNotFound'
  | 'roomNotFound'
  | 'priceNotFound'

export type OfficialPriceFailureKind =
  | 'invalidRequest'
  | 'sourceUnavailable'
  | 'captchaRequired'
  | 'invalidSourceResponse'

export interface OfficialPriceFailure {
  readonly kind: OfficialPriceFailureKind
  readonly message: string
  readonly retryable: boolean
}

export type OfficialPriceLookupResult =
  | {
      readonly key: string
      readonly status: 'found'
      readonly value: OfficialPriceHistory
    }
  | {
      readonly key: string
      readonly status: 'noData'
      readonly reason: OfficialPriceNoDataReason
    }
  | {
      readonly key: string
      readonly status: 'failed'
      readonly failure: OfficialPriceFailure
    }

export interface OfficialPriceBatchRequest {
  readonly items: readonly OfficialPriceRequest[]
}

export interface OfficialPriceBatchResponse {
  readonly results: readonly OfficialPriceLookupResult[]
}

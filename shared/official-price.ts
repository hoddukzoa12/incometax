import type { AssetKind } from './assets'

export interface ApartmentOfficialPriceRequest {
  readonly assetKind: 'apartment'
  readonly key: string
  readonly address: string
  readonly complexName: string
  readonly dong: string
  readonly room: string
  readonly pnu?: string
  readonly aptCode?: string
}

export interface DetachedHouseOfficialPriceRequest {
  readonly assetKind: 'detachedHouse'
  readonly key: string
  readonly address: string
  readonly pnu?: string
}

export interface AddressComplexSearchRequest {
  readonly address: string
  readonly pnu?: string
}

export interface AddressComplex {
  readonly code: string
  readonly name: string
}

export type AddressComplexSearchResult =
  | {
      readonly status: 'found'
      readonly complexes: readonly AddressComplex[]
      readonly pnu: string
    }
  | { readonly status: 'noData' }
  | {
      readonly status: 'failed'
      readonly failure: {
        readonly kind: string
        readonly message: string
        readonly retryable: boolean
      }
    }

export interface AddressUnitOptionsRequest {
  readonly pnu: string
  readonly aptCode: string
  readonly dong?: string
}

const ADDRESS_APARTMENT_IDENTITY_SEPARATOR = '|'

export const addressApartmentIdentity = (
  pnu: string,
  aptCode: string,
): string => [pnu, aptCode].join(ADDRESS_APARTMENT_IDENTITY_SEPARATOR)

export type OfficialPriceRequest =
  | ApartmentOfficialPriceRequest
  | DetachedHouseOfficialPriceRequest

export type ComplexOfficialPriceRequest = Pick<
  ApartmentOfficialPriceRequest,
  'key' | 'dong' | 'room'
> & { readonly aptCode?: string }

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

export const OFFICIAL_PRICE_FAILURE_KINDS = [
  'invalidRequest',
  'sourceUnavailable',
  'captchaRequired',
  'invalidSourceResponse',
  'complexAmbiguous',
] as const

export type OfficialPriceFailureKind =
  typeof OFFICIAL_PRICE_FAILURE_KINDS[number]

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

export type OfficialPriceLookupStage = 'addressToPnu' | 'officialPrice'

export type OfficialPriceResolutionResult =
  OfficialPriceLookupResult & {
    readonly lookupStage: OfficialPriceLookupStage
  }

export interface ApartmentUnitOption {
  readonly code: string
  readonly name: string
}

export interface ApartmentUnitOptionsRequest {
  readonly key: string
  readonly address: string
  readonly complexName: string
  readonly pnu?: string
  readonly dong?: string
  readonly aptCode?: string
}

export type ApartmentUnitOptionsResult =
  | {
      readonly key: string
      readonly status: 'found'
      readonly value: {
        readonly pnu: string
        readonly dongs: readonly ApartmentUnitOption[]
        readonly rooms: readonly ApartmentUnitOption[]
        readonly aptCode?: string
      }
    }
  | {
      readonly key: string
      readonly status: 'noData'
      readonly reason: 'addressNotFound' | 'complexNotFound' | 'dongNotFound'
    }
  | {
      readonly key: string
      readonly status: 'ambiguous'
      readonly candidates: readonly ApartmentUnitOption[]
    }
  | {
      readonly key: string
      readonly status: 'failed'
      readonly failure: OfficialPriceFailure
    }

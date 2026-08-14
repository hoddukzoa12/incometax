import { ASSET_KINDS, type AssetKind } from '../../shared/assets'
import {
  OFFICIAL_PRICE_FAILURE_KINDS,
  type ApartmentUnitOption,
  type ApartmentUnitOptionsResult,
  type OfficialPriceFailureKind,
  type OfficialPriceLookupResult,
  type OfficialPriceNoDataReason,
} from '../../shared/official-price'
import {
  TRADE_SOURCES,
  type AddressTradesResponse,
  type RecentTrade,
  type TradeSource,
} from '../../shared/trade'

const OFFICIAL_PRICE_FAILURE_KIND_SET = new Set<OfficialPriceFailureKind>(
  OFFICIAL_PRICE_FAILURE_KINDS,
)
const ASSET_KIND_SET = new Set<AssetKind>(ASSET_KINDS)

const OFFICIAL_PRICE_NO_DATA_REASONS = new Set<OfficialPriceNoDataReason>([
  'addressNotFound',
  'complexNotFound',
  'dongNotFound',
  'roomNotFound',
  'priceNotFound',
])

const TRADE_SOURCE_SET = new Set<TradeSource>(TRADE_SOURCES)

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export class InvalidSidebarApiResponseError extends Error {
  override readonly name = 'InvalidSidebarApiResponseError'
}

export const isRecentTrade = (value: unknown): value is RecentTrade => {
  if (!isRecord(value)) return false
  return typeof value.tradeId === 'string' &&
    typeof value.source === 'string' &&
    TRADE_SOURCE_SET.has(value.source as TradeSource) &&
    (value.matchLevel === 'lot' || value.matchLevel === 'candidate') &&
    typeof value.dealDate === 'string' &&
    typeof value.dealAmount === 'number' &&
    Number.isSafeInteger(value.dealAmount) &&
    typeof value.exclusiveArea === 'number' &&
    (value.floor === null || Number.isInteger(value.floor))
}

export const isAddressTradesResponse = (
  value: unknown,
): value is AddressTradesResponse =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isRecentTrade)

export const isUnitOption = (value: unknown): value is ApartmentUnitOption =>
  isRecord(value) && typeof value.code === 'string' && typeof value.name === 'string'

export const isUnitOptionsResult = (
  value: unknown,
): value is ApartmentUnitOptionsResult => {
  if (!isRecord(value) || typeof value.key !== 'string') return false
  if (value.status === 'noData') {
    return value.reason === 'addressNotFound' ||
      value.reason === 'complexNotFound' ||
      value.reason === 'dongNotFound'
  }
  if (value.status === 'ambiguous') {
    return Array.isArray(value.candidates) &&
      value.candidates.every(isUnitOption)
  }
  if (value.status === 'failed') {
    return isRecord(value.failure) &&
      typeof value.failure.kind === 'string' &&
      OFFICIAL_PRICE_FAILURE_KIND_SET.has(
        value.failure.kind as OfficialPriceFailureKind,
      ) &&
      typeof value.failure.message === 'string' &&
      typeof value.failure.retryable === 'boolean'
  }
  if (value.status !== 'found' || !isRecord(value.value)) return false
  return typeof value.value.pnu === 'string' &&
    Array.isArray(value.value.dongs) &&
    value.value.dongs.every(isUnitOption) &&
    Array.isArray(value.value.rooms) &&
    value.value.rooms.every(isUnitOption)
}

export const isOfficialPriceResult = (
  value: unknown,
): value is OfficialPriceLookupResult => {
  if (!isRecord(value) || typeof value.key !== 'string') return false
  if (value.status === 'noData') {
    return typeof value.reason === 'string' &&
      OFFICIAL_PRICE_NO_DATA_REASONS.has(
        value.reason as OfficialPriceNoDataReason,
      )
  }
  if (value.status === 'failed') {
    return isRecord(value.failure) &&
      typeof value.failure.kind === 'string' &&
      OFFICIAL_PRICE_FAILURE_KIND_SET.has(
        value.failure.kind as OfficialPriceFailureKind,
      ) &&
      typeof value.failure.message === 'string' &&
      typeof value.failure.retryable === 'boolean'
  }
  if (value.status !== 'found' || !isRecord(value.value)) return false
  return typeof value.value.assetKind === 'string' &&
    ASSET_KIND_SET.has(value.value.assetKind as AssetKind) &&
    typeof value.value.pnu === 'string' &&
    typeof value.value.detailAddress === 'string' &&
    Array.isArray(value.value.items) &&
    value.value.items.every((item) =>
      isRecord(item) &&
      typeof item.baseDate === 'string' &&
      typeof item.price === 'number' &&
      (item.exclusiveArea === null || typeof item.exclusiveArea === 'number'))
}

export const responseJson = async (
  response: Response,
  invalidResponseMessage: string,
): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new InvalidSidebarApiResponseError(invalidResponseMessage)
  }
}

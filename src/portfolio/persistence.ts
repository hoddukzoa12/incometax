import { ASSET_KINDS, type AssetKind } from '../../shared/assets'
import type {
  OwnershipShare,
  StoredOfficialPrice,
  StoredPortfolioItem,
} from '../../shared/portfolio'
import {
  AREA_KINDS,
  RESIDENCIES,
  type AreaKind,
  type Residency,
} from '../../shared/tax-rules'
import { isLegalDongCode } from '../../shared/legal-dong'
import { ownershipShareFromFraction } from './ownership-share'

export const PORTFOLIO_STORAGE_KEY = 'incometax.portfolio'
export const PORTFOLIO_SCHEMA_VERSION = 6

const IDENTITY_PORTFOLIO_SCHEMA_VERSION = 5
const PERIOD_PORTFOLIO_SCHEMA_VERSION = 4
const PRICE_HISTORY_PORTFOLIO_SCHEMA_VERSION = 3
const LEGAL_DONG_PORTFOLIO_SCHEMA_VERSION = 2
const LEGACY_PORTFOLIO_SCHEMA_VERSION = 1
const LEGACY_ASSET_KIND: AssetKind = 'apartment'

interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface PersistedPortfolio {
  readonly version: typeof PORTFOLIO_SCHEMA_VERSION
  readonly items: readonly StoredPortfolioItem[]
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isNullableBoolean = (value: unknown): value is boolean | null =>
  value === null || typeof value === 'boolean'

const isNullableLegalDongCode = (value: unknown): value is string | null =>
  value === null || isLegalDongCode(value)

const isNullablePositiveNumber = (value: unknown): value is number | null =>
  value === null || (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
  )

const isNullableOfficialPrice = (value: unknown): value is number | null =>
  value === null || (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  )

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isNullableNonNegativeNumber = (
  value: unknown,
): value is number | null => value === null || isNonNegativeNumber(value)

const isStoredOfficialPrice = (
  value: unknown,
): value is StoredOfficialPrice =>
  isRecord(value) &&
  isNonEmptyString(value.baseDate) &&
  typeof value.price === 'number' &&
  Number.isSafeInteger(value.price) &&
  value.price > 0

const isStoredOfficialPriceList = (
  value: unknown,
): value is readonly StoredOfficialPrice[] =>
  Array.isArray(value) && value.every(isStoredOfficialPrice)

const isOneOf = <T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T => typeof value === 'string' && choices.includes(value as T)

const readOwnershipShare = (value: unknown): OwnershipShare | null => {
  if (typeof value !== 'number') return null
  try {
    return ownershipShareFromFraction(value)
  } catch {
    return null
  }
}

const readCurrentItem = (value: unknown): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  const ownershipShare = readOwnershipShare(value.ownershipShare)
  if (
    !isNonEmptyString(value.id) ||
    !isOneOf(value.assetKind, ASSET_KINDS) ||
    !isNullableString(value.complexId) ||
    !isNullableString(value.pnu) ||
    !isNullableString(value.aptCode) ||
    !isNullableLegalDongCode(value.legalDongCode) ||
    !isNonEmptyString(value.complexName) ||
    !isNonEmptyString(value.address) ||
    !isNullableString(value.dong) ||
    !isNullableString(value.ho) ||
    !isNullablePositiveNumber(value.exclusiveArea) ||
    !isNullableOfficialPrice(value.officialPrice) ||
    !isNullableString(value.officialPriceBaseDate) ||
    !isStoredOfficialPriceList(value.priorOfficialPrices) ||
    ownershipShare === null ||
    !isNullableBoolean(value.isSoleHouseholdOwner) ||
    !(value.residency === null || isOneOf(value.residency, RESIDENCIES)) ||
    !isOneOf(value.areaKind, AREA_KINDS) ||
    !isNullableString(value.acquisitionDate) ||
    !isNullableNonNegativeNumber(value.residenceYears)
  ) return null

  return {
    id: value.id,
    assetKind: value.assetKind,
    complexId: value.complexId,
    pnu: value.pnu,
    aptCode: value.aptCode,
    legalDongCode: value.legalDongCode,
    complexName: value.complexName,
    address: value.address,
    dong: value.dong,
    ho: value.ho,
    exclusiveArea: value.exclusiveArea,
    officialPrice: value.officialPrice,
    officialPriceBaseDate: value.officialPriceBaseDate,
    priorOfficialPrices: value.priorOfficialPrices,
    ownershipShare,
    isSoleHouseholdOwner: value.isSoleHouseholdOwner,
    residency: value.residency as Residency | null,
    areaKind: value.areaKind as AreaKind,
    acquisitionDate: value.acquisitionDate,
    residenceYears: value.residenceYears,
  }
}

const migrateIdentityItem = (value: unknown): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  return readCurrentItem({
    ...value,
    pnu: null,
    aptCode: null,
  })
}

const migratePeriodItem = (value: unknown): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  return migrateIdentityItem({
    ...value,
    acquisitionDate: null,
    residenceYears: null,
  })
}

const migratePriceHistoryItem = (
  value: unknown,
): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  return migratePeriodItem({
    ...value,
    officialPriceBaseDate: null,
    priorOfficialPrices: [],
  })
}

const migrateLegalDongItem = (value: unknown): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  return migratePriceHistoryItem({ ...value, legalDongCode: null })
}

const migrateLegacyItem = (value: unknown): StoredPortfolioItem | null => {
  if (!isRecord(value)) return null
  return migratePriceHistoryItem({
    ...value,
    assetKind: LEGACY_ASSET_KIND,
    legalDongCode: null,
  })
}

const readItems = (
  value: unknown,
  readItem: (item: unknown) => StoredPortfolioItem | null,
): readonly StoredPortfolioItem[] | null => {
  if (!Array.isArray(value)) return null
  const items = value.map(readItem)
  return items.every((item): item is StoredPortfolioItem => item !== null)
    ? items
    : null
}

export const decodePortfolio = (
  serialized: string,
): readonly StoredPortfolioItem[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return []
  }
  if (!isRecord(parsed)) return []

  if (parsed.version === PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, readCurrentItem) ?? []
  }
  if (parsed.version === IDENTITY_PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, migrateIdentityItem) ?? []
  }
  if (parsed.version === PERIOD_PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, migratePeriodItem) ?? []
  }
  if (parsed.version === PRICE_HISTORY_PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, migratePriceHistoryItem) ?? []
  }
  if (parsed.version === LEGAL_DONG_PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, migrateLegalDongItem) ?? []
  }
  if (parsed.version === LEGACY_PORTFOLIO_SCHEMA_VERSION) {
    return readItems(parsed.items, migrateLegacyItem) ?? []
  }
  return []
}

export const restorePortfolio = (
  storage: StorageAdapter,
): readonly StoredPortfolioItem[] => {
  try {
    const serialized = storage.getItem(PORTFOLIO_STORAGE_KEY)
    return serialized === null ? [] : decodePortfolio(serialized)
  } catch {
    return []
  }
}

export const persistPortfolio = (
  storage: StorageAdapter,
  items: readonly StoredPortfolioItem[],
): void => {
  const validatedItems = readItems(items, readCurrentItem)
  if (validatedItems === null) {
    throw new TypeError('Portfolio contains an invalid item')
  }
  const persisted: PersistedPortfolio = {
    version: PORTFOLIO_SCHEMA_VERSION,
    items: validatedItems,
  }
  storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(persisted))
}

import type { AssetKind } from './assets'
import type { AreaKind, Residency } from './tax-rules'

declare const ownershipShareBrand: unique symbol
declare const ownershipPercentBrand: unique symbol

export type OwnershipShare = number & {
  readonly [ownershipShareBrand]: 'ownershipShareFraction'
}

export type OwnershipPercent = number & {
  readonly [ownershipPercentBrand]: 'ownershipPercent'
}

export interface StoredOfficialPrice {
  readonly baseDate: string
  readonly price: number
}

// Storage permits a zero share and a missing price. The calculation-screen
// boundary converts eligible records to shared/holding-tax PortfolioItem.
// Address-origin portfolio items use `pnu|aptCode` as their composite identity.
export interface StoredPortfolioItem {
  readonly id: string
  readonly assetKind: AssetKind
  readonly complexId: string | null
  readonly pnu: string | null
  readonly aptCode: string | null
  // null is reserved for records migrated from schemas that predate P4-4.
  readonly legalDongCode: string | null
  readonly complexName: string
  readonly address: string
  readonly dong: string | null
  readonly ho: string | null
  readonly exclusiveArea: number | null
  readonly officialPrice: number | null
  readonly officialPriceBaseDate: string | null
  readonly priorOfficialPrices: readonly StoredOfficialPrice[]
  readonly ownershipShare: OwnershipShare
  readonly isSoleHouseholdOwner: boolean | null
  readonly residency: Residency | null
  readonly areaKind: AreaKind
  readonly acquisitionDate: string | null
  readonly residenceYears: number | null
}

export interface PortfolioItemSeed {
  readonly assetKind: AssetKind
  readonly complexId: string | null
  readonly pnu: string | null
  readonly aptCode: string | null
  readonly legalDongCode: string
  readonly complexName: string
  readonly address: string
  readonly dong: string | null
  readonly ho: string | null
  readonly exclusiveArea: number | null
  readonly officialPrice: number | null
  readonly officialPriceBaseDate?: string | null
  readonly priorOfficialPrices?: readonly StoredOfficialPrice[]
}

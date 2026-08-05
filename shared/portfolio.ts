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

// Storage permits a zero share and a missing price. The calculation-screen
// boundary converts eligible records to shared/holding-tax PortfolioItem.
export interface StoredPortfolioItem {
  readonly id: string
  readonly assetKind: AssetKind
  readonly complexId: string | null
  // null is reserved for records migrated from schemas that predate P4-4.
  readonly legalDongCode: string | null
  readonly complexName: string
  readonly address: string
  readonly dong: string | null
  readonly ho: string | null
  readonly exclusiveArea: number | null
  readonly officialPrice: number | null
  readonly ownershipShare: OwnershipShare
  readonly isSoleHouseholdOwner: boolean
  readonly residency: Residency
  readonly areaKind: AreaKind
}

export interface PortfolioItemSeed {
  readonly assetKind: AssetKind
  readonly complexId: string | null
  readonly legalDongCode: string
  readonly complexName: string
  readonly address: string
  readonly dong: string | null
  readonly ho: string | null
  readonly exclusiveArea: number | null
  readonly officialPrice: number | null
}

export const ASSET_KINDS = ['apartment', 'detachedHouse'] as const

export type AssetKind = (typeof ASSET_KINDS)[number]

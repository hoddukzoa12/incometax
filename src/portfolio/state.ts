import type {
  OwnershipShare,
  PortfolioItemSeed,
  StoredPortfolioItem,
} from '../../shared/portfolio'
import { resolveAreaKind } from '../../data/adjusted-areas'
import { ownershipShareFromFraction } from './ownership-share'

const DEFAULT_OWNERSHIP_SHARE = ownershipShareFromFraction(1)
const DEFAULT_IS_SOLE_HOUSEHOLD_OWNER = true

export const createStoredPortfolioItem = (
  seed: PortfolioItemSeed,
  id: string,
): StoredPortfolioItem => ({
  id,
  ...seed,
  officialPriceBaseDate: seed.officialPriceBaseDate ?? null,
  priorOfficialPrices: seed.priorOfficialPrices ?? [],
  ownershipShare: DEFAULT_OWNERSHIP_SHARE,
  isSoleHouseholdOwner: DEFAULT_IS_SOLE_HOUSEHOLD_OWNER,
  residency: null,
  areaKind: resolveAreaKind(seed.legalDongCode),
  acquisitionDate: null,
  residenceYears: null,
})

export const removePortfolioItem = (
  items: readonly StoredPortfolioItem[],
  itemId: string,
): readonly StoredPortfolioItem[] =>
  items.filter((item) => item.id !== itemId)

export const updatePortfolioItem = (
  items: readonly StoredPortfolioItem[],
  itemId: string,
  update: Partial<Pick<
    StoredPortfolioItem,
    | 'acquisitionDate'
    | 'areaKind'
    | 'isSoleHouseholdOwner'
    | 'ownershipShare'
    | 'residenceYears'
    | 'residency'
  >>,
): readonly StoredPortfolioItem[] =>
  items.map((item) => item.id === itemId ? { ...item, ...update } : item)

export const updatePortfolioOwnershipShare = (
  items: readonly StoredPortfolioItem[],
  itemId: string,
  ownershipShare: OwnershipShare,
): readonly StoredPortfolioItem[] =>
  updatePortfolioItem(items, itemId, { ownershipShare })

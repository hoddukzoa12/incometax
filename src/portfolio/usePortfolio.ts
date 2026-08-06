import { useCallback, useEffect, useState } from 'react'

import type {
  OwnershipShare,
  PortfolioItemSeed,
  StoredPortfolioItem,
} from '../../shared/portfolio'
import { persistPortfolio, restorePortfolio } from './persistence'
import {
  createStoredPortfolioItem,
  removePortfolioItem,
  updatePortfolioItem,
  updatePortfolioOwnershipShare,
} from './state'

type PortfolioEditableFields = Pick<
  StoredPortfolioItem,
  | 'acquisitionDate'
  | 'areaKind'
  | 'isSoleHouseholdOwner'
  | 'officialPrice'
  | 'officialPriceBaseDate'
  | 'residenceYears'
  | 'residency'
>

export interface PortfolioController {
  readonly items: readonly StoredPortfolioItem[]
  readonly add: (seed: PortfolioItemSeed) => void
  readonly remove: (itemId: string) => void
  readonly setOwnershipShare: (
    itemId: string,
    ownershipShare: OwnershipShare,
  ) => void
  readonly update: (
    itemId: string,
    update: Partial<PortfolioEditableFields>,
  ) => void
}

const browserStorage = (): Storage => window.localStorage
const createItemId = (): string => crypto.randomUUID()

export const usePortfolio = (): PortfolioController => {
  const [items, setItems] = useState<readonly StoredPortfolioItem[]>(() =>
    restorePortfolio(browserStorage()))

  useEffect(() => {
    persistPortfolio(browserStorage(), items)
  }, [items])

  const add = useCallback((seed: PortfolioItemSeed) => {
    const item = createStoredPortfolioItem(seed, createItemId())
    setItems((current) => [...current, item])
  }, [])

  const remove = useCallback((itemId: string) => {
    setItems((current) => removePortfolioItem(current, itemId))
  }, [])

  const setOwnershipShare = useCallback((
    itemId: string,
    ownershipShare: OwnershipShare,
  ) => {
    setItems((current) =>
      updatePortfolioOwnershipShare(current, itemId, ownershipShare))
  }, [])

  const update = useCallback((
    itemId: string,
    fields: Partial<PortfolioEditableFields>,
  ) => {
    setItems((current) => updatePortfolioItem(current, itemId, fields))
  }, [])

  return {
    items,
    add,
    remove,
    setOwnershipShare,
    update,
  }
}

import { buildPnuFromLot } from '../../shared/pnu'
import type { AddressSearchResult } from '../../shared/search'

export const pnuForAddressSearchResult = (
  result: AddressSearchResult,
): string | null =>
  result.bCode && result.mainNumber && result.isMountain !== undefined
    ? buildPnuFromLot({
        legalDongCode: result.bCode,
        isMountain: result.isMountain,
        mainNumber: result.mainNumber,
        subNumber: result.subNumber ?? '0',
      })
    : null

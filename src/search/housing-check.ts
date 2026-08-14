import type {
  AddressSearchResult,
  HousingCheckStatus,
} from '../../shared/search'
import {
  fetchAddressComplexes,
  fetchDetachedHouseOfficialPrice,
} from '../sidebar/address-api'
import { pnuForAddressSearchResult } from './address-result-pnu'

interface HousingCheckServices {
  readonly fetchComplexes: typeof fetchAddressComplexes
  readonly fetchDetachedHousePrice: typeof fetchDetachedHouseOfficialPrice
}

const DEFAULT_HOUSING_CHECK_SERVICES: HousingCheckServices = {
  fetchComplexes: fetchAddressComplexes,
  fetchDetachedHousePrice: fetchDetachedHouseOfficialPrice,
}

export async function checkHousingStatus(
  result: AddressSearchResult,
  signal: AbortSignal,
  services: HousingCheckServices = DEFAULT_HOUSING_CHECK_SERVICES,
): Promise<HousingCheckStatus> {
  const pnu = pnuForAddressSearchResult(result)

  try {
    const complexResult = await services.fetchComplexes({
      address: result.address,
      ...(pnu ? { pnu } : {}),
    }, signal)
    if (complexResult.status === 'failed') return 'error'
    if (
      complexResult.status === 'found' &&
      complexResult.complexes.length > 0
    ) {
      return 'housing'
    }

    const detachedHouseResult = await services.fetchDetachedHousePrice({
      assetKind: 'detachedHouse',
      key: pnu ?? result.address,
      address: result.address,
      ...(pnu ? { pnu } : {}),
    }, signal)
    if (detachedHouseResult.status === 'found') return 'housing'
    return detachedHouseResult.status === 'noData' ? 'notHousing' : 'error'
  } catch (error) {
    if (signal.aborted) throw error
    return 'error'
  }
}

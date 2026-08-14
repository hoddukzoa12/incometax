import type { ComplexStagingRecord } from '../../shared/complex'
import type {
  AddressSearchResult,
  HousingCheckStatus,
} from '../../shared/search'

export type SearchStatus = 'idle' | 'loading' | 'success' | 'failed'

interface ComplexSearchOption {
  readonly kind: 'complex'
  readonly item: ComplexStagingRecord
}

export interface AddressSearchOption {
  readonly kind: 'address' | 'place'
  readonly item: AddressSearchResult
  readonly housingCheckStatus: HousingCheckStatus
}

export type SearchOption = ComplexSearchOption | AddressSearchOption

export const addressResultLabel = (result: AddressSearchResult): string =>
  result.placeName ?? result.roadAddress ?? result.address

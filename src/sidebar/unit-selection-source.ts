import type { ComplexStagingRecord } from '../../shared/complex'
import {
  addressApartmentIdentity,
  type ApartmentUnitOptionsResult,
  type OfficialPriceResolutionResult,
} from '../../shared/official-price'
import type { AddressComplexSelection } from '../../shared/search'
import {
  fetchApartmentUnitOptions,
} from './api'
import { fetchAddressUnitOptions } from './address-api'
import {
  lookupOfficialPriceForAddress,
  lookupOfficialPriceForComplex,
} from './official-price-lookup'

export type UnitSelectionSource =
  | ComplexStagingRecord
  | AddressComplexSelection

export const isAddressComplex = (
  complex: UnitSelectionSource,
): complex is AddressComplexSelection => 'origin' in complex

export const unitSelectionIdentity = (
  complex: UnitSelectionSource,
): string => isAddressComplex(complex)
  ? addressApartmentIdentity(complex.pnu, complex.aptCode)
  : complex.complexId

export const unitSelectionName = (complex: UnitSelectionSource): string =>
  isAddressComplex(complex) ? complex.complexName : complex.name

export const unitSelectionAddress = (complex: UnitSelectionSource): string =>
  isAddressComplex(complex)
    ? complex.roadAddress ?? complex.address
    : complex.roadAddress ?? complex.legalAddress

export const fetchUnitOptions = (
  complex: UnitSelectionSource,
  dong: string | undefined,
  aptCode: string | null,
  signal: AbortSignal,
): Promise<ApartmentUnitOptionsResult> => isAddressComplex(complex)
  ? fetchAddressUnitOptions({
      pnu: complex.pnu,
      aptCode: complex.aptCode,
      ...(dong ? { dong } : {}),
    }, signal)
  : fetchApartmentUnitOptions(
      complex.complexId,
      dong,
      signal,
      aptCode ?? undefined,
    )

export const lookupUnitOfficialPrice = (
  complex: UnitSelectionSource,
  query: { readonly key: string; readonly dong: string; readonly room: string },
  aptCode: string | null,
  signal: AbortSignal,
): Promise<OfficialPriceResolutionResult> => isAddressComplex(complex)
  ? lookupOfficialPriceForAddress(complex, query, signal)
  : lookupOfficialPriceForComplex(complex.complexId, {
      ...query,
      aptCode: aptCode ?? undefined,
    }, signal)

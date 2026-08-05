import type { ComplexStagingRecord } from '../../shared/complex'
import { buildPnu, parseLotAddress } from '../ldong/address'

type StoredComplexPnuSource = Pick<
  ComplexStagingRecord,
  'legalAddress' | 'legalDongCode'
>

export const resolveStoredComplexPnu = (
  complex: StoredComplexPnuSource,
): string | null => {
  const parsedAddress = parseLotAddress(complex.legalAddress)
  return parsedAddress
    ? buildPnu(parsedAddress, complex.legalDongCode)
    : null
}

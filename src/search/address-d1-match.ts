import type { ComplexStagingRecord } from '../../shared/complex'
import type { AddressSearchResult } from '../../shared/search'

const WHITESPACE_PATTERN = /\s+/gu

const withoutWhitespace = (value: string): string =>
  value.replace(WHITESPACE_PATTERN, '')

export function findMatchingComplex(
  addressResult: AddressSearchResult,
  complexItems: readonly ComplexStagingRecord[],
): ComplexStagingRecord | null {
  const normalizedAddress = withoutWhitespace(addressResult.address)
  for (const complex of complexItems) {
    if (withoutWhitespace(complex.legalAddress) === normalizedAddress) {
      return complex
    }
  }
  return null
}

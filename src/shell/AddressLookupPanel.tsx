import { useEffect, useState } from 'react'

import type {
  AddressComplexSearchResult,
} from '../../shared/official-price'
import type { PortfolioItemSeed } from '../../shared/portfolio'
import type {
  AddressComplexSelection,
  AddressSearchResult,
} from '../../shared/search'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { pnuForAddressSearchResult } from '../search/address-result-pnu'
import { fetchAddressComplexes } from '../sidebar/address-api'
import { AddressPanel } from './AddressPanel'

const LEGAL_DONG_CODE_LENGTH = 10
const LOT_PREFIX_PATTERN = /^\s*\(\s*\d+(?:-\d+)?\s*\)\s*/

function cleanComplexName(name: string): string {
  return name.replace(LOT_PREFIX_PATTERN, '').trim() || name
}

type AddressComplexLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: AddressComplexSearchResult }
  | { readonly status: 'failed' }

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const addressSelection = (
  result: AddressSearchResult,
  response: Extract<AddressComplexSearchResult, { readonly status: 'found' }>,
  aptCode: string,
  complexName: string,
): AddressComplexSelection => ({
  origin: 'address',
  complexId: null,
  pnu: response.pnu,
  aptCode,
  complexName: cleanComplexName(complexName),
  legalDongCode: response.pnu.slice(0, LEGAL_DONG_CODE_LENGTH),
  address: result.address,
  ...(result.roadAddress ? { roadAddress: result.roadAddress } : {}),
  lat: result.lat,
  lng: result.lng,
})

export function AddressLookupPanel({
  result,
  onAddToPortfolio,
}: {
  readonly result: AddressSearchResult
  readonly onAddToPortfolio: (seed: PortfolioItemSeed) => void
}) {
  const [requestSeq, setRequestSeq] = useState(0)
  const [loadState, setLoadState] = useState<AddressComplexLoadState>({
    status: 'loading',
  })
  const [selectedAptCode, setSelectedAptCode] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const pnu = pnuForAddressSearchResult(result)
    fetchAddressComplexes({
      address: result.address,
      ...(pnu ? { pnu } : {}),
    }, controller.signal)
      .then((value) => setLoadState({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setLoadState({ status: 'failed' })
      })
    return () => controller.abort()
  }, [requestSeq, result])

  const retry = () => {
    setLoadState({ status: 'loading' })
    setSelectedAptCode(null)
    setRequestSeq((seq) => seq + 1)
  }

  if (loadState.status === 'loading') {
    return (
      <div className="complex-sidebar">
        <p className="complex-sidebar__loading" role="status">
          {SIDEBAR_MESSAGES.addressComplexLoading}
        </p>
      </div>
    )
  }

  const requestFailed = loadState.status === 'failed' ||
    loadState.value.status === 'failed'
  if (requestFailed) {
    return (
      <div className="complex-sidebar">
        <div className="complex-sidebar__error" role="alert">
          <p>{SIDEBAR_MESSAGES.addressComplexFailed}</p>
          <button type="button" onClick={retry}>
            {SIDEBAR_MESSAGES.retry}
          </button>
        </div>
      </div>
    )
  }

  const noData = loadState.value.status === 'noData' ||
    loadState.value.complexes.length === 0
  if (noData) {
    return (
      <div className="complex-sidebar">
        <p className="complex-sidebar__empty" role="status">
          {SIDEBAR_MESSAGES.addressComplexNoData}
        </p>
      </div>
    )
  }

  const response = loadState.value
  const selected = response.complexes.length === 1
    ? response.complexes[0]
    : response.complexes.find(({ code }) => code === selectedAptCode)

  if (selected) {
    return (
      <AddressPanel
        complex={addressSelection(
          result,
          response,
          selected.code,
          selected.name,
        )}
        onAddToPortfolio={onAddToPortfolio}
      />
    )
  }

  return (
    <div className="complex-sidebar">
      <div className="complex-sidebar__content">
        <header className="complex-sidebar__header">
          <p className="complex-sidebar__eyebrow">
            {SIDEBAR_MESSAGES.apartmentComplexLabel}
          </p>
          <h2>{SIDEBAR_MESSAGES.addressComplexChoiceTitle}</h2>
          <address>{result.roadAddress ?? result.address}</address>
        </header>
        <section className="complex-sidebar__section">
          <h3>{SIDEBAR_MESSAGES.addressComplexChoiceGuide}</h3>
          <div className="address-complex-choice">
            {response.complexes.map((complex) => (
              <button
                key={complex.code}
                type="button"
                onClick={() => setSelectedAptCode(complex.code)}
              >
                {cleanComplexName(complex.name)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

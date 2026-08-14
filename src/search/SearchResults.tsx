import type { ComplexStagingRecord } from '../../shared/complex'
import type { AddressSearchResult } from '../../shared/search'
import { SEARCH_MESSAGES } from '../messages/search'
import {
  addressResultLabel,
  type AddressSearchOption,
  type SearchOption,
  type SearchStatus,
} from './search-options'

interface SearchResultsProps {
  readonly listId: string
  readonly complexItems: readonly ComplexStagingRecord[]
  readonly addressResults: readonly AddressSearchOption[]
  readonly complexStatus: SearchStatus
  readonly addressStatus: SearchStatus
  readonly placeStatus: SearchStatus
  readonly activeIndex: number
  readonly onSelect: (option: SearchOption) => void
}

const addressResultDetail = (
  result: AddressSearchResult,
): string | undefined => {
  if (result.placeName) return result.roadAddress ?? result.address
  if (result.roadAddress && result.roadAddress !== result.address) {
    return result.address
  }
  return undefined
}

export function SearchResults({
  listId,
  complexItems,
  addressResults,
  complexStatus,
  addressStatus,
  placeStatus,
  activeIndex,
  onSelect,
}: SearchResultsProps) {
  const complexSectionId = `${listId}-complex-section`
  const addressSectionId = `${listId}-address-section`
  const addressLoading = addressStatus === 'loading' || placeStatus === 'loading'
  const addressFailed = addressStatus === 'failed' || placeStatus === 'failed'
  const addressSearchComplete = addressStatus === 'success' &&
    placeStatus === 'success'

  return (
    <div id={listId} className="complex-search__results" role="listbox">
      <section
        className="complex-search__section"
        role="group"
        aria-labelledby={complexSectionId}
      >
        <h3 id={complexSectionId} className="complex-search__section-label">
          {SEARCH_MESSAGES.complexSectionLabel}
        </h3>
        {complexStatus === 'loading' && (
          <p className="complex-search__section-status" role="status">
            {SEARCH_MESSAGES.complexLoading}
          </p>
        )}
        {complexStatus === 'failed' && (
          <p
            className="complex-search__section-status complex-search__section-status--error"
            role="alert"
          >
            {SEARCH_MESSAGES.complexFailed}
          </p>
        )}
        {complexStatus === 'success' && complexItems.length === 0 && (
          <p className="complex-search__section-status">
            {SEARCH_MESSAGES.noComplexResults}
          </p>
        )}
        <ul className="complex-search__section-results" role="presentation">
          {complexItems.map((item, index) => (
            <li
              id={`${listId}-option-${index}`}
              key={item.complexId}
              role="option"
              aria-selected={index === activeIndex}
              className="complex-search__result"
            >
              <button
                type="button"
                onClick={() => onSelect({ kind: 'complex', item })}
              >
                <strong>{item.name}</strong>
                <span>{item.roadAddress ?? item.legalAddress}</span>
                {(item.lat === null || item.lng === null) && (
                  <small>{SEARCH_MESSAGES.locationUnavailable}</small>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="complex-search__section"
        role="group"
        aria-labelledby={addressSectionId}
      >
        <h3 id={addressSectionId} className="complex-search__section-label">
          {SEARCH_MESSAGES.addressSectionLabel}
        </h3>
        {addressLoading && (
          <p className="complex-search__section-status" role="status">
            {SEARCH_MESSAGES.addressLoading}
          </p>
        )}
        {addressFailed && (
          <p
            className="complex-search__section-status complex-search__section-status--error"
            role="alert"
          >
            {SEARCH_MESSAGES.addressFailed}
          </p>
        )}
        {addressSearchComplete && addressResults.length === 0 && (
          <p className="complex-search__section-status">
            {SEARCH_MESSAGES.noAddressResults}
          </p>
        )}
        <ul className="complex-search__section-results" role="presentation">
          {addressResults.map((option, addressIndex) => {
            const index = complexItems.length + addressIndex
            const detail = addressResultDetail(option.item)
            const notHousing = option.housingCheckStatus === 'notHousing'
            return (
              <li
                id={`${listId}-option-${index}`}
                key={`${option.kind}-${option.item.lat}-${option.item.lng}-${addressIndex}`}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={notHousing}
                className={
                  `complex-search__result${notHousing
                    ? ' complex-search__result--not-housing'
                    : ''}`
                }
              >
                <button
                  type="button"
                  disabled={notHousing}
                  title={notHousing ? SEARCH_MESSAGES.notHousing : undefined}
                  onClick={() => onSelect(option)}
                >
                  <strong>{addressResultLabel(option.item)}</strong>
                  {detail && <span>{detail}</span>}
                  {option.housingCheckStatus === 'pending' && (
                    <small className="complex-search__housing-check">
                      <span aria-hidden="true">●</span>
                      {SEARCH_MESSAGES.housingCheckPending}
                    </small>
                  )}
                  {notHousing && (
                    <small className="complex-search__not-housing">
                      {SEARCH_MESSAGES.notHousing}
                    </small>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

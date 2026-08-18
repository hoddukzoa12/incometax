import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import type { AddressSearchResult } from '../../shared/search'
import { SEARCH_MESSAGES } from '../messages/search'
import { fetchComplexSearch } from './api'
import { searchKakaoAddresses, searchKakaoPlaces } from './kakao'
import { SearchResults } from './SearchResults'
import {
  addressResultLabel,
  type AddressSearchOption,
  type SearchOption,
  type SearchStatus,
} from './search-options'
import './complex-search.css'

const SEARCH_DEBOUNCE_MS = 250

interface ComplexSearchProps {
  readonly onSelectComplex: (complex: ComplexStagingRecord) => void
  readonly onSelectAddress: (result: AddressSearchResult) => void
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export function ComplexSearch({
  onSelectComplex,
  onSelectAddress,
}: ComplexSearchProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [complexItems, setComplexItems] = useState<
    readonly ComplexStagingRecord[]
  >([])
  const [addressItems, setAddressItems] = useState<
    readonly AddressSearchOption[]
  >([])
  const [placeItems, setPlaceItems] = useState<
    readonly AddressSearchOption[]
  >([])
  const [complexStatus, setComplexStatus] = useState<SearchStatus>('idle')
  const [addressStatus, setAddressStatus] = useState<SearchStatus>('idle')
  const [placeStatus, setPlaceStatus] = useState<SearchStatus>('idle')
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedQuery = useRef('')

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || trimmedQuery === selectedQuery.current) return

    const controller = new AbortController()
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setComplexStatus('loading')
      setAddressStatus('loading')
      setPlaceStatus('loading')

      void fetchComplexSearch(trimmedQuery, controller.signal)
        .then((results) => {
          if (cancelled) return
          setComplexItems(results)
          setComplexStatus('success')
          setActiveIndex(-1)
        })
        .catch((error: unknown) => {
          if (cancelled || isAbortError(error)) return
          setComplexItems([])
          setComplexStatus('failed')
          setActiveIndex(-1)
        })

      void searchKakaoAddresses(trimmedQuery)
        .then((results) => {
          if (cancelled) return
          setAddressItems(results.map((item) => ({
            kind: 'address',
            item,
          })))
          setAddressStatus('success')
          setActiveIndex(-1)
        })
        .catch(() => {
          if (cancelled) return
          setAddressItems([])
          setAddressStatus('failed')
          setActiveIndex(-1)
        })

      void searchKakaoPlaces(trimmedQuery)
        .then((results) => {
          if (cancelled) return
          setPlaceItems(results.map((item) => ({
            kind: 'place',
            item,
          })))
          setPlaceStatus('success')
          setActiveIndex(-1)
        })
        .catch(() => {
          if (cancelled) return
          setPlaceItems([])
          setPlaceStatus('failed')
          setActiveIndex(-1)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  const addressResults: readonly AddressSearchOption[] = [
    ...addressItems,
    ...placeItems,
  ]
  const options: readonly SearchOption[] = [
    ...complexItems.map((item) => ({ kind: 'complex' as const, item })),
    ...addressResults,
  ]
  const dropdownOpen = complexStatus !== 'idle' ||
    addressStatus !== 'idle' ||
    placeStatus !== 'idle'

  const clearResults = () => {
    setComplexItems([])
    setAddressItems([])
    setPlaceItems([])
    setComplexStatus('idle')
    setAddressStatus('idle')
    setPlaceStatus('idle')
    setActiveIndex(-1)
  }

  const select = (option: SearchOption) => {
    const label = option.kind === 'complex'
      ? option.item.name
      : addressResultLabel(option.item)
    selectedQuery.current = label
    setQuery(label)
    clearResults()

    if (option.kind === 'complex') {
      onSelectComplex(option.item)
      return
    }
    onSelectAddress(option.item)
  }

  const moveSelection = (direction: 1 | -1) => {
    if (!options.length) return
    setActiveIndex((current) =>
      (current + direction + options.length) % options.length)
  }

  const activeOptionId = activeIndex >= 0
    ? `${listId}-option-${activeIndex}`
    : undefined

  return (
    <section className="complex-search" aria-label={SEARCH_MESSAGES.label}>
      <label className="complex-search__label" htmlFor={`${listId}-input`}>
        {SEARCH_MESSAGES.label}
      </label>
      <input
        id={`${listId}-input`}
        className="complex-search__input"
        type="search"
        value={query}
        placeholder={SEARCH_MESSAGES.placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={dropdownOpen}
        aria-activedescendant={activeOptionId}
        onChange={(event) => {
          selectedQuery.current = ''
          clearResults()
          setQuery(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveSelection(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveSelection(-1)
          } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault()
            select(options[activeIndex])
          } else if (event.key === 'Escape') {
            clearResults()
          }
        }}
      />

      {dropdownOpen && (
        <SearchResults
          listId={listId}
          complexItems={complexItems}
          addressResults={addressResults}
          complexStatus={complexStatus}
          addressStatus={addressStatus}
          placeStatus={placeStatus}
          activeIndex={activeIndex}
          onSelect={select}
        />
      )}
    </section>
  )
}

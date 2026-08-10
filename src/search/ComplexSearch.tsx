import { useEffect, useId, useRef, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import { SEARCH_MESSAGES } from '../messages/search'
import { fetchComplexSearch } from './api'
import './complex-search.css'

const SEARCH_DEBOUNCE_MS = 250

type SearchStatus = 'idle' | 'loading' | 'success' | 'failed'

export function ComplexSearch({
  onSelectComplex,
}: {
  readonly onSelectComplex: (complex: ComplexStagingRecord) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<readonly ComplexStagingRecord[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedQuery = useRef('')

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || trimmedQuery === selectedQuery.current) {
      setItems([])
      setStatus('idle')
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setStatus('loading')
      fetchComplexSearch(trimmedQuery, controller.signal)
        .then((results) => {
          setItems(results)
          setStatus('success')
          setActiveIndex(-1)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setItems([])
          setStatus('failed')
          setActiveIndex(-1)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  const select = (item: ComplexStagingRecord) => {
    selectedQuery.current = item.name
    setQuery(item.name)
    setItems([])
    setStatus('idle')
    setActiveIndex(-1)
    onSelectComplex(item)
  }

  const moveSelection = (direction: 1 | -1) => {
    if (!items.length) return
    setActiveIndex((current) => {
      const next = current + direction
      if (next < 0) return items.length - 1
      if (next >= items.length) return 0
      return next
    })
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
        aria-expanded={items.length > 0}
        aria-activedescendant={activeOptionId}
        onChange={(event) => {
          selectedQuery.current = ''
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
            select(items[activeIndex])
          } else if (event.key === 'Escape') {
            setItems([])
            setActiveIndex(-1)
          }
        }}
      />

      {status === 'loading' && (
        <p className="complex-search__status" role="status">
          {SEARCH_MESSAGES.loading}
        </p>
      )}
      {status === 'failed' && (
        <p className="complex-search__status complex-search__status--error" role="alert">
          {SEARCH_MESSAGES.failed}
        </p>
      )}
      {status === 'success' && items.length === 0 && (
        <p className="complex-search__status">{SEARCH_MESSAGES.noResults}</p>
      )}
      {items.length > 0 && (
        <ul id={listId} className="complex-search__results" role="listbox">
          {items.map((item, index) => (
            <li
              id={`${listId}-option-${index}`}
              key={item.complexId}
              role="option"
              aria-selected={index === activeIndex}
              className="complex-search__result"
            >
              <button type="button" onClick={() => select(item)}>
                <strong>{item.name}</strong>
                <span>{item.roadAddress ?? item.legalAddress}</span>
                {(item.lat === null || item.lng === null) && (
                  <small>{SEARCH_MESSAGES.locationUnavailable}</small>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

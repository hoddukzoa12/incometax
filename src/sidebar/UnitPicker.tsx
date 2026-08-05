import { useEffect, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import type {
  ApartmentUnitOptionsResult,
  OfficialPriceLookupResult,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  fetchApartmentUnitOptions,
  fetchOfficialPrice,
} from './api'
import { formatArea, formatWon } from './format'
import './official-price.css'

type RemoteResult<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: T }
  | { readonly status: 'failed' }

const PRICE_HISTORY_PAGE_SIZE = 6

const optionLabel = (name: string, suffix: string): string =>
  name.endsWith(suffix) ? name : `${name}${suffix}`

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const sourceFailureMessage = (
  result: ApartmentUnitOptionsResult,
): string | null => {
  if (result.status !== 'failed') return null
  return result.failure.kind === 'captchaRequired'
    ? SIDEBAR_MESSAGES.captchaRequired
    : result.failure.message
}

export function UnitPicker({
  complex,
}: {
  readonly complex: ComplexStagingRecord
}) {
  const [dongOptions, setDongOptions] = useState<
    RemoteResult<ApartmentUnitOptionsResult>
  >({ status: 'loading' })
  const [selectedDong, setSelectedDong] = useState('')
  const [roomOptions, setRoomOptions] = useState<
    RemoteResult<ApartmentUnitOptionsResult> | null
  >(null)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [priceResult, setPriceResult] = useState<
    RemoteResult<OfficialPriceLookupResult> | null
  >(null)
  const [visiblePriceCount, setVisiblePriceCount] = useState(
    PRICE_HISTORY_PAGE_SIZE,
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchApartmentUnitOptions(complex.complexId, undefined, controller.signal)
      .then((value) => setDongOptions({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setDongOptions({ status: 'failed' })
      })
    return () => controller.abort()
  }, [complex.complexId])

  useEffect(() => {
    if (!selectedDong) return
    const controller = new AbortController()
    fetchApartmentUnitOptions(
      complex.complexId,
      selectedDong,
      controller.signal,
    )
      .then((value) => setRoomOptions({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setRoomOptions({ status: 'failed' })
      })
    return () => controller.abort()
  }, [complex.complexId, selectedDong])

  const dongs = dongOptions.status === 'loaded' &&
    dongOptions.value.status === 'found'
    ? dongOptions.value.value.dongs
    : []
  const rooms = roomOptions?.status === 'loaded' &&
    roomOptions.value.status === 'found'
    ? roomOptions.value.value.rooms
    : []
  const pnu = dongOptions.status === 'loaded' &&
    dongOptions.value.status === 'found'
    ? dongOptions.value.value.pnu
    : undefined
  const optionsFailure = dongOptions.status === 'loaded'
    ? sourceFailureMessage(dongOptions.value)
    : null
  const optionsHaveNoData = dongOptions.status === 'loaded' &&
    (dongOptions.value.status === 'noData' ||
      (dongOptions.value.status === 'found' && dongs.length === 0))
  const roomFailure = roomOptions?.status === 'loaded'
    ? sourceFailureMessage(roomOptions.value)
    : null
  const roomsHaveNoData = roomOptions?.status === 'loaded' &&
    (roomOptions.value.status === 'noData' ||
      (roomOptions.value.status === 'found' && rooms.length === 0))

  const submit = async () => {
    if (!selectedDong || !selectedRoom) return
    const controller = new AbortController()
    setVisiblePriceCount(PRICE_HISTORY_PAGE_SIZE)
    setPriceResult({ status: 'loading' })
    try {
      const value = await fetchOfficialPrice({
        key: `${complex.complexId}:${selectedDong}:${selectedRoom}`,
        assetKind: 'apartment',
        address: complex.legalAddress,
        complexName: complex.name,
        dong: selectedDong,
        room: selectedRoom,
        pnu,
      }, controller.signal)
      setPriceResult({ status: 'loaded', value })
    } catch {
      setPriceResult({ status: 'failed' })
    }
  }

  return (
    <section className="complex-sidebar__section unit-picker">
      <h3>{SIDEBAR_MESSAGES.officialPriceTitle}</h3>
      {dongOptions.status === 'loading' && (
        <p className="complex-sidebar__loading">{SIDEBAR_MESSAGES.unitLoading}</p>
      )}
      {(dongOptions.status === 'failed' || optionsFailure) && (
        <p className="complex-sidebar__error" role="alert">
          {optionsFailure ?? SIDEBAR_MESSAGES.unitFailed}
        </p>
      )}
      {optionsHaveNoData && (
        <p className="complex-sidebar__empty">{SIDEBAR_MESSAGES.unitNoData}</p>
      )}
      {dongs.length > 0 && (
        <div className="unit-picker__fields">
          <label>
            <span>{SIDEBAR_MESSAGES.dongLabel}</span>
            <select
              value={selectedDong}
              onChange={(event) => {
                const dong = event.target.value
                setSelectedDong(dong)
                setSelectedRoom('')
                setPriceResult(null)
                setVisiblePriceCount(PRICE_HISTORY_PAGE_SIZE)
                setRoomOptions(dong ? { status: 'loading' } : null)
              }}
            >
              <option value="">{SIDEBAR_MESSAGES.selectDong}</option>
              {dongs.map((option) => (
                <option key={option.code} value={option.name}>
                  {optionLabel(option.name, SIDEBAR_MESSAGES.dongSuffix)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{SIDEBAR_MESSAGES.roomLabel}</span>
            <select
              value={selectedRoom}
              disabled={!selectedDong || roomOptions?.status === 'loading'}
              onChange={(event) => {
                setSelectedRoom(event.target.value)
                setPriceResult(null)
                setVisiblePriceCount(PRICE_HISTORY_PAGE_SIZE)
              }}
            >
              <option value="">{SIDEBAR_MESSAGES.selectRoom}</option>
              {rooms.map((option) => (
                <option key={option.code} value={option.name}>
                  {optionLabel(option.name, SIDEBAR_MESSAGES.roomSuffix)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(roomOptions?.status === 'failed' || roomFailure) && (
        <p className="complex-sidebar__error" role="alert">
          {roomFailure ?? SIDEBAR_MESSAGES.unitFailed}
        </p>
      )}
      {roomsHaveNoData && (
        <p className="complex-sidebar__empty">{SIDEBAR_MESSAGES.unitNoData}</p>
      )}
      <button
        className="unit-picker__lookup"
        type="button"
        disabled={!selectedDong || !selectedRoom || priceResult?.status === 'loading'}
        onClick={submit}
      >
        {SIDEBAR_MESSAGES.priceLookup}
      </button>

      {priceResult?.status === 'loading' && (
        <p className="complex-sidebar__loading">{SIDEBAR_MESSAGES.priceLoading}</p>
      )}
      {priceResult?.status === 'failed' && (
        <p className="complex-sidebar__error" role="alert">
          {SIDEBAR_MESSAGES.priceFailed}
        </p>
      )}
      {priceResult?.status === 'loaded' && priceResult.value.status === 'noData' && (
        <p className="complex-sidebar__empty">{SIDEBAR_MESSAGES.priceNoData}</p>
      )}
      {priceResult?.status === 'loaded' && priceResult.value.status === 'failed' && (
        <p className="complex-sidebar__error" role="alert">
          {priceResult.value.failure.kind === 'captchaRequired'
            ? SIDEBAR_MESSAGES.captchaRequired
            : priceResult.value.failure.message}
        </p>
      )}
      {priceResult?.status === 'loaded' && priceResult.value.status === 'found' && (
        <>
          <ol className="official-price-history">
            {priceResult.value.value.items
              .slice(0, visiblePriceCount)
              .map((item) => (
                <li key={item.baseDate}>
                  <time>{item.baseDate}</time>
                  <strong>{formatWon(item.price)}</strong>
                  {item.exclusiveArea !== null && (
                    <span>{formatArea(item.exclusiveArea)}</span>
                  )}
                </li>
              ))}
          </ol>
          {priceResult.value.value.items.length > visiblePriceCount && (
            <button
              className="complex-sidebar__more"
              type="button"
              onClick={() => setVisiblePriceCount((count) =>
                count + PRICE_HISTORY_PAGE_SIZE)}
            >
              {SIDEBAR_MESSAGES.morePrices}
            </button>
          )}
        </>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import type {
  ApartmentUnitOptionsResult,
  OfficialPriceResolutionResult,
} from '../../shared/official-price'
import type { PortfolioItemSeed } from '../../shared/portfolio'
import type { AddressComplexSelection } from '../../shared/search'
import { formatWon } from '../format/won'
import { PORTFOLIO_MESSAGES } from '../messages/portfolio'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { formatArea } from './format'
import {
  officialPriceFailureMessage,
  officialPriceNoDataMessage,
  unitOptionsFailureMessage,
  unitOptionsNoDataMessage,
} from './official-price-feedback'
import {
  fetchUnitOptions,
  isAddressComplex,
  lookupUnitOfficialPrice,
  unitSelectionAddress,
  unitSelectionIdentity,
  unitSelectionName,
} from './unit-selection-source'
import { UnitSelectionFields } from './UnitSelectionFields'
import './official-price.css'

type RemoteResult<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: T }
  | { readonly status: 'failed' }

const PRICE_HISTORY_PAGE_SIZE = 6
const CURRENT_PRICE_HISTORY_ITEM_INDEX = 0

interface PriceQuery {
  readonly dong: string
  readonly room: string
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export function UnitPicker({
  complex,
  onAddToPortfolio,
}: {
  readonly complex: ComplexStagingRecord | AddressComplexSelection
  readonly onAddToPortfolio: (seed: PortfolioItemSeed) => void
}) {
  const identity = unitSelectionIdentity(complex)
  const complexName = unitSelectionName(complex)
  const selectedAptCode = isAddressComplex(complex) ? complex.aptCode : null
  const [dongOptions, setDongOptions] = useState<
    RemoteResult<ApartmentUnitOptionsResult>
  >({ status: 'loading' })
  const [selectedDong, setSelectedDong] = useState('')
  const [roomOptions, setRoomOptions] = useState<
    RemoteResult<ApartmentUnitOptionsResult> | null
  >(null)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [priceResult, setPriceResult] = useState<
    RemoteResult<OfficialPriceResolutionResult> | null
  >(null)
  const [priceQuery, setPriceQuery] = useState<PriceQuery | null>(null)
  const [visiblePriceCount, setVisiblePriceCount] = useState(
    PRICE_HISTORY_PAGE_SIZE,
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchUnitOptions(complex, undefined, selectedAptCode, controller.signal)
      .then((value) => {
        setDongOptions({ status: 'loaded', value })
        if (value.status === 'found' && value.value.dongs.length === 1) {
          setSelectedDong(value.value.dongs[0].name)
          setRoomOptions({ status: 'loading' })
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setDongOptions({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, selectedAptCode])

  const optionsFailure = dongOptions.status === 'loaded'
    ? unitOptionsFailureMessage(dongOptions.value)
    : null
  const manualDong = dongOptions.status === 'failed' || Boolean(optionsFailure)

  useEffect(() => {
    if (!selectedDong || manualDong) return
    const controller = new AbortController()
    fetchUnitOptions(
      complex,
      selectedDong,
      selectedAptCode,
      controller.signal,
    )
      .then((value) => setRoomOptions({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setRoomOptions({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, manualDong, selectedAptCode, selectedDong])

  useEffect(() => {
    if (!priceQuery) return
    const controller = new AbortController()
    lookupUnitOfficialPrice(complex, {
      key: `${identity}:${priceQuery.dong}:${priceQuery.room}`,
      dong: priceQuery.dong,
      room: priceQuery.room,
    }, selectedAptCode, controller.signal)
      .then((value) => setPriceResult({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setPriceResult({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, priceQuery, selectedAptCode])

  const dongs = dongOptions.status === 'loaded' &&
    dongOptions.value.status === 'found'
    ? dongOptions.value.value.dongs
    : []
  const rooms = roomOptions?.status === 'loaded' &&
    roomOptions.value.status === 'found'
    ? roomOptions.value.value.rooms
    : []
  const optionsNoData = dongOptions.status === 'loaded'
    ? unitOptionsNoDataMessage(dongOptions.value, 'dongs')
    : null
  const roomFailure = roomOptions?.status === 'loaded'
    ? unitOptionsFailureMessage(roomOptions.value)
    : null
  const manualRoom = manualDong || roomOptions?.status === 'failed' ||
    Boolean(roomFailure)
  const roomsNoData = roomOptions?.status === 'loaded'
    ? unitOptionsNoDataMessage(roomOptions.value, 'rooms')
    : null
  const priceFailure = priceResult?.status === 'loaded'
    ? officialPriceFailureMessage(priceResult.value)
    : null
  const priceNoData = priceResult?.status === 'loaded'
    ? officialPriceNoDataMessage(priceResult.value)
    : null
  const resolvedPrice = priceResult?.status === 'loaded' &&
    priceResult.value.status === 'found'
    ? priceResult.value.value.items[CURRENT_PRICE_HISTORY_ITEM_INDEX] ?? null
    : null
  const priorOfficialPrices = priceResult?.status === 'loaded' &&
    priceResult.value.status === 'found'
    ? priceResult.value.value.items.slice(CURRENT_PRICE_HISTORY_ITEM_INDEX + 1)
      .map(({ baseDate, price }) => ({ baseDate, price }))
    : []

  const requestPrice = (dong: string, room: string) => {
    const query = { dong: dong.trim(), room: room.trim() }
    if (!query.dong || !query.room) return
    setVisiblePriceCount(PRICE_HISTORY_PAGE_SIZE)
    setPriceResult({ status: 'loading' })
    setPriceQuery(query)
  }

  const resetPrice = () => {
    setPriceQuery(null)
    setPriceResult(null)
    setVisiblePriceCount(PRICE_HISTORY_PAGE_SIZE)
  }

  const changeDong = (dong: string) => {
    setSelectedDong(dong)
    setSelectedRoom('')
    resetPrice()
    setRoomOptions(dong && !manualDong ? { status: 'loading' } : null)
  }

  const changeRoom = (room: string) => {
    setSelectedRoom(room)
    resetPrice()
  }

  const selectRoom = (room: string) => {
    setSelectedRoom(room)
    if (room) requestPrice(selectedDong, room)
    else resetPrice()
  }

  return (
    <section className="complex-sidebar__section unit-picker">
      <h3>{SIDEBAR_MESSAGES.officialPriceTitle}</h3>
      {priceQuery === null && (
        <p className="unit-picker__guide">{SIDEBAR_MESSAGES.exactPriceGuide}</p>
      )}
      <UnitSelectionFields
        dongs={dongs}
        rooms={rooms}
        hideDongField={dongs.length === 1 && !manualDong}
        selectedDong={selectedDong}
        selectedRoom={selectedRoom}
        dongLoading={dongOptions.status === 'loading'}
        roomLoading={roomOptions?.status === 'loading'}
        dongError={optionsFailure ?? (
          dongOptions.status === 'failed' ? SIDEBAR_MESSAGES.dongFailed : null
        )}
        roomError={roomFailure ?? (
          roomOptions?.status === 'failed' ? SIDEBAR_MESSAGES.roomFailed : null
        )}
        dongNoData={optionsNoData}
        roomNoData={roomsNoData}
        manualDong={manualDong}
        manualRoom={manualRoom}
        lookupLoading={priceResult?.status === 'loading'}
        onDongChange={changeDong}
        onRoomChange={changeRoom}
        onRoomSelect={selectRoom}
        onLookup={() => requestPrice(selectedDong, selectedRoom)}
      />

      {priceResult?.status === 'loading' && (
        <p className="complex-sidebar__loading">{SIDEBAR_MESSAGES.priceLoading}</p>
      )}
      {priceResult?.status === 'failed' && (
        <p className="complex-sidebar__error" role="alert">
          {SIDEBAR_MESSAGES.priceFailed}
        </p>
      )}
      {priceNoData && (
        <p className="complex-sidebar__empty">{priceNoData}</p>
      )}
      {priceFailure && (
        <p className="complex-sidebar__error" role="alert">
          {priceFailure}
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
      <p className="unit-picker__add-guide">
        {PORTFOLIO_MESSAGES.addIncompleteGuide}
      </p>
      <button
        className="unit-picker__add"
        type="button"
        onClick={() => onAddToPortfolio({
          assetKind: 'apartment',
          complexId: isAddressComplex(complex) ? null : complex.complexId,
          pnu: isAddressComplex(complex) ? complex.pnu : null,
          aptCode: isAddressComplex(complex) ? complex.aptCode : null,
          legalDongCode: complex.legalDongCode,
          complexName,
          address: unitSelectionAddress(complex),
          dong: selectedDong || null,
          ho: selectedRoom || null,
          exclusiveArea: resolvedPrice?.exclusiveArea ?? null,
          officialPrice: resolvedPrice?.price ?? null,
          officialPriceBaseDate: resolvedPrice?.baseDate ?? null,
          priorOfficialPrices,
        })}
      >
        {PORTFOLIO_MESSAGES.addFromSidebar}
      </button>
    </section>
  )
}

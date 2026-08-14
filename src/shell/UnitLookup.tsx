import { useEffect, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import type { PortfolioItemSeed } from '../../shared/portfolio'
import type {
  ApartmentUnitOptionsResult,
  OfficialPriceLookupResult,
} from '../../shared/official-price'
import type { AddressComplexSelection } from '../../shared/search'
import { formatWon } from '../format/won'
import { SHELL_MESSAGES } from '../messages/shell'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  fetchUnitOptions,
  isAddressComplex,
  lookupUnitOfficialPrice,
  unitSelectionAddress,
  unitSelectionIdentity,
  unitSelectionName,
} from '../sidebar/unit-selection-source'
import { formatArea } from '../format/property'

const CURRENT_PRICE_INDEX = 0

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: T }
  | { readonly status: 'failed' }

const optionNames = (
  state: Loadable<ApartmentUnitOptionsResult> | null,
  field: 'dongs' | 'rooms',
): readonly string[] =>
  state?.status === 'loaded' && state.value.status === 'found'
    ? state.value.value[field].map((option) => option.name)
    : []

const ambiguousCandidates = (
  state: Loadable<ApartmentUnitOptionsResult> | null,
): readonly { readonly code: string; readonly name: string }[] | null =>
  state?.status === 'loaded' && state.value.status === 'ambiguous'
    ? state.value.candidates
    : null

/**
 * 「어느 집인가요?」 — 동과 호를 칩으로 고르고 그 자리에서 공시가격을 보여 준다.
 *
 * 왜 모달인가: 공시가격은 동·호가 정해져야 나오는 값이라 사이드바에 상시로 두면
 * 대부분의 시간 동안 빈 자리다. 물어볼 때만 앞에 세운다.
 *
 * 왜 칩인가: 드롭다운은 몇 개가 있는지 열어야 안다. 은마는 동 28·호 196개인데
 * 그 규모 자체가 정보다. 다만 그만큼 길어지므로 목록에 최대 높이를 준다.
 */
export function UnitLookup({
  complex,
  mode,
  onCancel,
  onConfirm,
}: {
  readonly complex: ComplexStagingRecord | AddressComplexSelection
  readonly mode: 'add' | 'calculate'
  readonly onCancel: () => void
  readonly onConfirm: (seed: PortfolioItemSeed) => void
}) {
  const identity = unitSelectionIdentity(complex)
  const complexName = unitSelectionName(complex)
  const [dong, setDong] = useState<string | null>(null)
  const [ho, setHo] = useState<string | null>(null)
  const [selectedAptCode, setSelectedAptCode] = useState<string | null>(
    isAddressComplex(complex) ? complex.aptCode : null,
  )
  const [dongState, setDongState] = useState<
    Loadable<ApartmentUnitOptionsResult>
  >({ status: 'loading' })
  const [hoState, setHoState] = useState<
    Loadable<ApartmentUnitOptionsResult> | null
  >(null)
  const [priceState, setPriceState] = useState<
    Loadable<OfficialPriceLookupResult> | null
  >(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchUnitOptions(complex, undefined, selectedAptCode, controller.signal)
      .then((value) => {
        setDongState({ status: 'loaded', value })
        if (value.status === 'found' && value.value.aptCode && !selectedAptCode) {
          setSelectedAptCode(value.value.aptCode)
        }
        if (value.status === 'found' && value.value.dongs.length === 1) {
          setDong(value.value.dongs[0].name)
          setHoState({ status: 'loading' })
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setDongState({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, selectedAptCode])

  useEffect(() => {
    if (dong === null) return
    const controller = new AbortController()
    fetchUnitOptions(complex, dong, selectedAptCode, controller.signal)
      .then((value) => setHoState({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setHoState({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, dong, selectedAptCode])

  useEffect(() => {
    if (dong === null || ho === null) return
    const controller = new AbortController()
    lookupUnitOfficialPrice(complex, {
      key: `${identity}:${dong}:${ho}`,
      dong,
      room: ho,
    }, selectedAptCode, controller.signal)
      .then((value) => setPriceState({ status: 'loaded', value }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setPriceState({ status: 'failed' })
    })
    return () => controller.abort()
  }, [complex, identity, dong, ho, selectedAptCode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  // 후보 목록은 첫 응답에서만 온다. 단지를 골라서 다시 fetch하면 found가 오므로
  // 첫 응답의 후보를 따로 보관한다.
  const [savedCandidates, setSavedCandidates] = useState<
    readonly { readonly code: string; readonly name: string }[] | null
  >(null)
  const freshCandidates = ambiguousCandidates(dongState)
  if (freshCandidates !== null && savedCandidates === null) {
    setSavedCandidates(freshCandidates)
  }
  const candidates = savedCandidates
  const dongs = optionNames(dongState, 'dongs')
  const skipDongSelection = dongs.length === 1
  const hos = optionNames(hoState, 'rooms')
  const found = priceState?.status === 'loaded' &&
      priceState.value.status === 'found'
    ? priceState.value.value
    : null
  const current = found?.items[CURRENT_PRICE_INDEX] ?? null
  const prior = found?.items.slice(CURRENT_PRICE_INDEX + 1) ?? []
  const ready = dong !== null && ho !== null && current !== null

  return (
    <div
      className="mbox"
      role="dialog"
      aria-modal="true"
      aria-label={SHELL_MESSAGES.unitLookupTitle}
    >
      <div className="mbox__card">
        <div className="mbox__head">
          <p>{complexName}</p>
          <h2>{SHELL_MESSAGES.unitLookupTitle}</h2>
        </div>

        <div className="mbox__body">
          {candidates !== null && (
            <div>
              <h3>{SIDEBAR_MESSAGES.addressComplexAmbiguousTitle}</h3>
              <div className="chips">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.code}
                    type="button"
                    aria-pressed={selectedAptCode === candidate.code}
                    onClick={() => {
                      setSelectedAptCode(candidate.code)
                      setDong(null)
                      setHo(null)
                      setPriceState(null)
                      setHoState(null)
                    }}
                  >
                    {candidate.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(candidates === null || selectedAptCode !== null) && !skipDongSelection && (
          <div>
            <h3>{SIDEBAR_MESSAGES.dongLabel}</h3>
            {dongState.status === 'loading' && (
              <p className="mbox__hint">{SIDEBAR_MESSAGES.loading}</p>
            )}
            {dongState.status === 'failed' && (
              <p className="mbox__hint">{SIDEBAR_MESSAGES.dongFailed}</p>
            )}
            <div className="chips">
              {dongs.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={dong === name}
                  onClick={() => {
                    setDong(name)
                    setHo(null)
                    setHoState({ status: 'loading' })
                    setPriceState(null)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          )}

          {dong !== null && (
            <div>
              <h3>{SIDEBAR_MESSAGES.roomLabel}</h3>
              {hoState?.status === 'loading' && (
                <p className="mbox__hint">{SIDEBAR_MESSAGES.loading}</p>
              )}
              <div className="chips">
                {hos.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={ho === name}
                    onClick={() => {
                      setHo(name)
                      setPriceState({ status: 'loading' })
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {priceState?.status === 'loading' && (
            <p className="mbox__hint">{SHELL_MESSAGES.priceLoading}</p>
          )}

          {current !== null && (
            <dl className="mbox__found">
              <dt>
                {dong} {ho}
                {current.exclusiveArea !== null &&
                  ` · ${formatArea(current.exclusiveArea)}`}
                {' · '}
                {SHELL_MESSAGES.priceOn(current.baseDate)}
              </dt>
              <dd>{formatWon(current.price)}</dd>
              {prior.length > 0 && (
                <>
                  <dt className="mbox__found-prior">
                    {SHELL_MESSAGES.priorPrices}
                  </dt>
                  {prior.map((item) => (
                    <dd key={item.baseDate} className="mbox__found-row">
                      {item.baseDate} · {formatWon(item.price)}
                    </dd>
                  ))}
                </>
              )}
            </dl>
          )}
        </div>

        <div className="mbox__foot">
          <button
            className="cta"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!ready || current === null) return
              onConfirm({
                assetKind: 'apartment',
                complexId: isAddressComplex(complex) ? null : complex.complexId,
                pnu: isAddressComplex(complex) ? complex.pnu : null,
                aptCode: isAddressComplex(complex) ? complex.aptCode : null,
                legalDongCode: complex.legalDongCode,
                complexName,
                address: unitSelectionAddress(complex),
                dong,
                ho,
                exclusiveArea: current.exclusiveArea,
                officialPrice: current.price,
                officialPriceBaseDate: current.baseDate,
                priorOfficialPrices: prior.map(({ baseDate, price }) => ({
                  baseDate,
                  price,
                })),
              })
            }}
          >
            <span>
              {mode === 'add'
                ? SHELL_MESSAGES.confirmAdd
                : SHELL_MESSAGES.confirmCalculate}
            </span>
            <span className="cta__badge" aria-hidden="true">
              {SHELL_MESSAGES.ctaChevron}
            </span>
          </button>
          <button className="ghost" type="button" onClick={onCancel}>
            {SHELL_MESSAGES.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

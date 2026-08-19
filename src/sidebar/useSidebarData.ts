import { useEffect, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import { addressApartmentIdentity } from '../../shared/official-price'
import type { AddressComplexSelection } from '../../shared/search'
import type { AddressTradesResponse } from '../../shared/trade'
import { fetchAddressTrades } from './address-api'
import { fetchComplexDetail, fetchComplexTrades } from './api'

export type SidebarLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed'

interface ResourceState<T> {
  readonly key: string
  readonly value: T | null
  readonly failed: boolean
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export function useTradeData(
  complexId: string | null,
  addressTarget: AddressComplexSelection | null = null,
) {
  const [tradeState, setTradeState] = useState<ResourceState<AddressTradesResponse>>({
    key: '',
    value: null,
    failed: false,
  })
  const [tradeAttempt, setTradeAttempt] = useState(0)
  const legalDongCode = addressTarget?.legalDongCode ?? ''
  const jibunAddress = addressTarget?.address ?? ''
  const complexName = addressTarget?.complexName ?? ''
  const addressKey = addressTarget
    ? addressApartmentIdentity(addressTarget.pnu, addressTarget.aptCode)
    : ''
  const targetKey = complexId ? `complex:${complexId}` :
    addressKey ? `address:${addressKey}` : ''
  const tradeKey = targetKey ? `${targetKey}:${tradeAttempt}` : ''

  useEffect(() => {
    if (!complexId && !addressKey) return
    const controller = new AbortController()
    const pending = complexId
      ? fetchComplexTrades(complexId, controller.signal)
      : fetchAddressTrades({
          legalDongCode,
          jibunAddress,
          complexName,
        }, controller.signal)
    pending
      .then((result) => {
        setTradeState({ key: tradeKey, value: result, failed: false })
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setTradeState({ key: tradeKey, value: null, failed: true })
      })
    return () => controller.abort()
  }, [addressKey, complexId, complexName, jibunAddress, legalDongCode, tradeKey])

  const tradeStatus: SidebarLoadStatus = !tradeKey
    ? 'idle'
    : tradeState.key !== tradeKey
      ? 'loading'
      : tradeState.failed ? 'failed' : 'loaded'

  return {
    trades: tradeState.key === tradeKey ? tradeState.value : null,
    tradeStatus,
    retryTrades: () => setTradeAttempt((attempt) => attempt + 1),
  }
}

export function useSidebarData(complexId: string | null) {
  const [detailState, setDetailState] = useState<ResourceState<ComplexStagingRecord>>({
    key: '',
    value: null,
    failed: false,
  })
  const [detailAttempt, setDetailAttempt] = useState(0)
  const tradeData = useTradeData(complexId)
  const detailKey = complexId ? `${complexId}:${detailAttempt}` : ''

  useEffect(() => {
    if (!complexId) return
    const controller = new AbortController()
    fetchComplexDetail(complexId, controller.signal)
      .then((result) => {
        setDetailState({ key: detailKey, value: result, failed: false })
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setDetailState({ key: detailKey, value: null, failed: true })
      })
    return () => controller.abort()
  }, [complexId, detailKey])

  const status = <T,>(
    state: ResourceState<T>,
    key: string,
  ): SidebarLoadStatus => {
    if (!key) return 'idle'
    if (state.key !== key) return 'loading'
    return state.failed ? 'failed' : 'loaded'
  }

  return {
    detail: detailState.key === detailKey ? detailState.value : null,
    detailStatus: status(detailState, detailKey),
    ...tradeData,
    retryDetail: () => setDetailAttempt((attempt) => attempt + 1),
  }
}

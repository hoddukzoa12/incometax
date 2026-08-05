import { useEffect, useState } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import type { ComplexTradesResponse } from '../../shared/trade'
import { fetchComplexDetail, fetchComplexTrades } from './api'

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'failed'

interface ResourceState<T> {
  readonly key: string
  readonly value: T | null
  readonly failed: boolean
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export function useSidebarData(complexId: string | null) {
  const [detailState, setDetailState] = useState<ResourceState<ComplexStagingRecord>>({
    key: '',
    value: null,
    failed: false,
  })
  const [tradeState, setTradeState] = useState<ResourceState<ComplexTradesResponse>>({
    key: '',
    value: null,
    failed: false,
  })
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [tradeAttempt, setTradeAttempt] = useState(0)
  const detailKey = complexId ? `${complexId}:${detailAttempt}` : ''
  const tradeKey = complexId ? `${complexId}:${tradeAttempt}` : ''

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

  useEffect(() => {
    if (!complexId) return
    const controller = new AbortController()
    fetchComplexTrades(complexId, controller.signal)
      .then((result) => {
        setTradeState({ key: tradeKey, value: result, failed: false })
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setTradeState({ key: tradeKey, value: null, failed: true })
      })
    return () => controller.abort()
  }, [complexId, tradeKey])

  const status = <T,>(
    state: ResourceState<T>,
    key: string,
  ): LoadStatus => {
    if (!key) return 'idle'
    if (state.key !== key) return 'loading'
    return state.failed ? 'failed' : 'loaded'
  }

  return {
    detail: detailState.key === detailKey ? detailState.value : null,
    detailStatus: status(detailState, detailKey),
    trades: tradeState.key === tradeKey ? tradeState.value : null,
    tradeStatus: status(tradeState, tradeKey),
    retryDetail: () => setDetailAttempt((attempt) => attempt + 1),
    retryTrades: () => setTradeAttempt((attempt) => attempt + 1),
  }
}

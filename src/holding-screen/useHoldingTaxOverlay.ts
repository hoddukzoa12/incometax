import { useCallback, useEffect, useState } from 'react'

const VIEW_QUERY_KEY = 'view'
const HOLDING_TAX_VIEW = 'holding-tax'
const HISTORY_STATE_KEY = 'holdingTaxOverlay'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isHoldingTaxUrl = (): boolean =>
  new URL(window.location.href).searchParams.get(VIEW_QUERY_KEY) ===
    HOLDING_TAX_VIEW

const urlWithHoldingTaxView = (open: boolean): string => {
  const url = new URL(window.location.href)
  if (open) url.searchParams.set(VIEW_QUERY_KEY, HOLDING_TAX_VIEW)
  else url.searchParams.delete(VIEW_QUERY_KEY)
  return `${url.pathname}${url.search}${url.hash}`
}

export const useHoldingTaxOverlay = () => {
  const [open, setOpen] = useState(isHoldingTaxUrl)

  useEffect(() => {
    const handlePopState = () => setOpen(isHoldingTaxUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const show = useCallback(() => {
    if (isHoldingTaxUrl()) {
      setOpen(true)
      return
    }
    const previousState = isRecord(window.history.state)
      ? window.history.state
      : {}
    window.history.pushState(
      { ...previousState, [HISTORY_STATE_KEY]: true },
      '',
      urlWithHoldingTaxView(true),
    )
    setOpen(true)
  }, [])

  const hide = useCallback(() => {
    const state = window.history.state
    if (isRecord(state) && state[HISTORY_STATE_KEY] === true) {
      window.history.back()
      return
    }
    window.history.replaceState(state, '', urlWithHoldingTaxView(false))
    setOpen(false)
  }, [])

  return { open, show, hide }
}

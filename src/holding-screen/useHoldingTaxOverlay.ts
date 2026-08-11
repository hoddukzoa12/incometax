import { useCallback, useState } from 'react'

/**
 * 보유세 결과 화면의 열림 여부.
 *
 * 이 화면만 주소에 남긴다 — 새로고침하거나 링크를 다시 열었을 때 결과로 돌아오게
 * 하려는 것이다. 다른 겹침(단지 패널·동호 모달·조건 모달)은 잠깐 덮였다 사라지는
 * 것이라 주소에 적을 것이 없다.
 *
 * 히스토리에 칸을 쌓지는 않는다. 뒤로가기로 닫는 일은 `useLayerHistory` 가 층 전체를
 * 한 곳에서 맡는다 — 여기서 따로 밀면 다른 층이 같은 순간에 미는 것과 부딪혀,
 * 열리자마자 닫히는 화면이 생긴다(그 주석 참조).
 */
const VIEW_QUERY_KEY = 'view'
const HOLDING_TAX_VIEW = 'holding-tax'

const isHoldingTaxUrl = (): boolean =>
  new URL(window.location.href).searchParams.get(VIEW_QUERY_KEY) ===
    HOLDING_TAX_VIEW

const writeUrl = (open: boolean): void => {
  const url = new URL(window.location.href)
  if (open) url.searchParams.set(VIEW_QUERY_KEY, HOLDING_TAX_VIEW)
  else url.searchParams.delete(VIEW_QUERY_KEY)
  // 칸을 쌓지 않고 지금 칸의 주소만 고쳐 쓴다.
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

export const useHoldingTaxOverlay = () => {
  const [open, setOpen] = useState(isHoldingTaxUrl)

  const show = useCallback(() => {
    writeUrl(true)
    setOpen(true)
  }, [])

  const hide = useCallback(() => {
    writeUrl(false)
    setOpen(false)
  }, [])

  return { open, show, hide }
}

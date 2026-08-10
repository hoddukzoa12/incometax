import { useEffect, useState } from 'react'

/**
 * 45rem(720px)가 이 앱의 유일한 논리 해상도다 — tokens.css 주석 참조.
 * 좁은 화면에서는 사이드 패널 대신 바텀시트를 쓴다.
 */
const COMPACT_QUERY = '(max-width: 45rem)'

export const useCompactLayout = (): boolean => {
  const [compact, setCompact] = useState(
    () => window.matchMedia(COMPACT_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY)
    const handle = (event: MediaQueryListEvent) => setCompact(event.matches)
    query.addEventListener('change', handle)
    return () => query.removeEventListener('change', handle)
  }, [])

  return compact
}

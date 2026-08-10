const MARKER_DIAMETER_PX = 16
const MARKER_RING_PX = 3
const ACCENT_TOKEN = '--color-accent'
const SURFACE_TOKEN = '--color-neutral-0'
const ACCENT_FALLBACK = '#70161a'
const SURFACE_FALLBACK = '#ffffff'

const tokenValue = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value === '' ? fallback : value
}

/**
 * 클러스터가 풀린 구간의 낱개 마커.
 *
 * 카카오 `Marker` 에 `image` 를 주지 않으면 SDK 기본 아이콘(파란 물방울)이 나온다.
 * 그건 우리 브랜드와 무관한 색이라 지도 위에서 혼자 튄다.
 * 라벨 구간의 `.pin__dot` 과 같은 모양 — 액센트 점에 흰 테 — 으로 맞춘다.
 *
 * 색은 토큰에서 읽는다. SVG data URI 는 CSS 변수를 풀지 못하므로 값이 필요한데,
 * 여기에 색을 적어 두면 tokens.css 와 두 곳이 되어 브랜드가 바뀔 때 갈린다.
 */
export const createComplexMarkerImage = (): kakao.maps.MarkerImage => {
  const accent = tokenValue(ACCENT_TOKEN, ACCENT_FALLBACK)
  const surface = tokenValue(SURFACE_TOKEN, SURFACE_FALLBACK)
  const size = MARKER_DIAMETER_PX + MARKER_RING_PX * 2
  const centre = size / 2
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<circle cx="${centre}" cy="${centre}" r="${centre - 0.5}"`,
    ` fill="${surface}" opacity="0.92"/>`,
    `<circle cx="${centre}" cy="${centre}" r="${MARKER_DIAMETER_PX / 2}"`,
    ` fill="${accent}"/>`,
    '</svg>',
  ].join('')

  return new kakao.maps.MarkerImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    new kakao.maps.Size(size, size),
    { offset: new kakao.maps.Point(centre, centre) },
  )
}

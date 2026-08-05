import { COMPLEX_BBOX_ITEM_LIMIT } from '../../shared/complex'

export const COMPLEX_MARKER_CAP = COMPLEX_BBOX_ITEM_LIMIT
export const BOUNDS_REQUEST_DEBOUNCE_MS = 250

// Kakao map levels are inverted: smaller values are closer zoom levels.
export const MAXIMUM_LABEL_DISPLAY_LEVEL = 3
export const KAKAO_MINIMUM_MAP_LEVEL = 1

export const INITIAL_MAP_CENTER = {
  latitude: 37.5172,
  longitude: 127.0473,
} as const
export const INITIAL_MAP_LEVEL = 6

export const MAP_LEVEL_CHANGE_ANIMATION_DURATION_MS = 200

export const CLUSTER_GRID_SIZE_PX = 90
export const CLUSTER_CALCULATOR = [10, 30, 50] as const
const CLUSTER_WIDTHS_PX = [64, 68, 72, 76] as const
const CLUSTER_STYLE = {
  height: 'calc(var(--space-6) + var(--space-2))',
  background: 'var(--color-accent)',
  color: 'var(--color-neutral-0)',
  border:
    '2px solid color-mix(in srgb, var(--color-neutral-0) 90%, transparent)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-semibold)',
  lineHeight: 'calc(var(--space-6) + var(--space-1))',
  textAlign: 'center',
  boxShadow: 'var(--shadow-sm)',
} as const

export const CLUSTER_STYLES = CLUSTER_WIDTHS_PX.map((width) => ({
  ...CLUSTER_STYLE,
  width: `${width}px`,
}))

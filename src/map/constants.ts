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
export const CLUSTER_STYLES = [
  {
    width: '64px',
    height: '32px',
    background: '#173f5f',
    color: '#ffffff',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '17px',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: '28px',
    textAlign: 'center',
    boxShadow: '0 5px 18px rgba(23, 63, 95, 0.28)',
  },
  {
    width: '68px',
    height: '34px',
    background: '#20639b',
    color: '#ffffff',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '18px',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: '30px',
    textAlign: 'center',
    boxShadow: '0 5px 18px rgba(32, 99, 155, 0.3)',
  },
  {
    width: '72px',
    height: '36px',
    background: '#2b8a86',
    color: '#ffffff',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '19px',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: '32px',
    textAlign: 'center',
    boxShadow: '0 5px 18px rgba(43, 138, 134, 0.3)',
  },
  {
    width: '76px',
    height: '38px',
    background: '#3caea3',
    color: '#102f3d',
    border: '2px solid rgba(255, 255, 255, 0.92)',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '800',
    lineHeight: '34px',
    textAlign: 'center',
    boxShadow: '0 6px 20px rgba(60, 174, 163, 0.32)',
  },
] as const

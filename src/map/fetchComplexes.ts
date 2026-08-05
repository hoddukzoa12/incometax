import type { ComplexBboxResponse } from '../../shared/complex'

const COMPLEX_BBOX_ENDPOINT = '/api/complexes'

export interface MapBounds {
  readonly south: number
  readonly north: number
  readonly west: number
  readonly east: number
}

export const fetchComplexes = async (
  bounds: MapBounds,
  signal: AbortSignal,
): Promise<ComplexBboxResponse> => {
  const searchParams = new URLSearchParams({
    south: String(bounds.south),
    north: String(bounds.north),
    west: String(bounds.west),
    east: String(bounds.east),
  })
  const response = await fetch(`${COMPLEX_BBOX_ENDPOINT}?${searchParams}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(`Complex bbox request failed with ${response.status}`)
  }
  return (await response.json()) as ComplexBboxResponse
}

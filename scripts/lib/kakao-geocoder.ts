import { EXTERNAL_API_URLS } from '../../worker/config/external-apis.ts'
import { fetchJson } from './http.ts'

const KAKAO_AUTH_SCHEME = 'KakaoAK'

type JsonRecord = Record<string, unknown>

export interface GeocodingInput {
  readonly complexId: string
  readonly address: string
}

export type GeocodingResult =
  | {
      readonly status: 'success'
      readonly complexId: string
      readonly sourceAddress: string
      readonly resolvedAddress: string
      readonly lat: number
      readonly lng: number
    }
  | {
      readonly status: 'notFound'
      readonly complexId: string
      readonly sourceAddress: string
    }
  | {
      readonly status: 'failed'
      readonly complexId: string
      readonly sourceAddress: string
      readonly reason: string
    }

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const coordinate = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError(`Invalid ${label} coordinate`)
  }

  return parsed
}

export const parseKakaoGeocodingResponse = (
  input: GeocodingInput,
  payload: unknown,
): GeocodingResult => {
  if (!isRecord(payload) || !Array.isArray(payload.documents)) {
    throw new TypeError('Kakao geocoding response is missing documents')
  }

  if (payload.documents.length === 0) {
    return {
      status: 'notFound',
      complexId: input.complexId,
      sourceAddress: input.address,
    }
  }

  const document = payload.documents[0]
  if (!isRecord(document) || typeof document.address_name !== 'string') {
    throw new TypeError('Kakao geocoding document is malformed')
  }

  return {
    status: 'success',
    complexId: input.complexId,
    sourceAddress: input.address,
    resolvedAddress: document.address_name,
    lat: coordinate(document.y, 'latitude', -90, 90),
    lng: coordinate(document.x, 'longitude', -180, 180),
  }
}

export const geocodeAddress = async (
  input: GeocodingInput,
  restApiKey: string,
): Promise<GeocodingResult> => {
  const url = new URL(EXTERNAL_API_URLS.kakaoAddressSearch)
  url.searchParams.set('query', input.address)

  try {
    const payload = await fetchJson(url, {
      headers: { authorization: `${KAKAO_AUTH_SCHEME} ${restApiKey}` },
    })
    return parseKakaoGeocodingResponse(input, payload)
  } catch (error) {
    return {
      status: 'failed',
      complexId: input.complexId,
      sourceAddress: input.address,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

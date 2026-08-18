import type { AddressSearchResult } from '../../shared/search'
import { loadKakaoMapsSdk } from '../map/loadKakaoMapsSdk'

const KAKAO_ADDRESS_SEARCH_ERROR = 'Kakao address search failed'
const KAKAO_KEYWORD_SEARCH_ERROR = 'Kakao keyword search failed'
const KAKAO_SERVICES_UNAVAILABLE_ERROR = 'Kakao Maps services are unavailable'
const KAKAO_SEARCH_TIMEOUT_MS = 5_000
const KAKAO_SEARCH_MAX_ATTEMPTS = 2

type KakaoSearchStarter<T> = (
  callback: (
    results: readonly T[],
    status: kakao.maps.services.Status,
  ) => void,
) => void

const optionalText = (value: string | undefined): string | undefined =>
  value?.trim() || undefined

const coordinates = (
  x: string,
  y: string,
): { readonly lat: number; readonly lng: number } | null => {
  const lat = Number(y)
  const lng = Number(x)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export const toAddressSearchResult = (
  item: kakao.maps.services.AddressSearchResult,
): AddressSearchResult | null => {
  const position = coordinates(item.x, item.y)
  const address = optionalText(item.address?.address_name) ??
    optionalText(item.address_name)
  if (!position || !address) return null

  return {
    address,
    roadAddress: optionalText(item.road_address?.address_name),
    ...position,
    bCode: optionalText(item.address?.b_code),
    ...(item.address?.mountain_yn
      ? { isMountain: item.address.mountain_yn === 'Y' }
      : {}),
    mainNumber: optionalText(item.address?.main_address_no),
    subNumber: optionalText(item.address?.sub_address_no),
  }
}

const HOUSING_CATEGORIES = ['아파트', '빌라,주택', '도시형생활주택'] as const

const isHousingCategory = (categoryName: string | undefined): boolean => {
  if (!categoryName) return false
  return HOUSING_CATEGORIES.some((cat) => categoryName.includes(cat))
}

export const toPlaceSearchResult = (
  item: kakao.maps.services.PlacesSearchResultItem,
): AddressSearchResult | null => {
  if (!isHousingCategory(item.category_name)) return null

  const position = coordinates(item.x, item.y)
  const address = optionalText(item.address_name)
  if (!position || !address) return null

  return {
    address,
    roadAddress: optionalText(item.road_address_name),
    placeName: optionalText(item.place_name),
    ...position,
  }
}

const getKakaoServices = async (): Promise<typeof kakao.maps.services> => {
  await loadKakaoMapsSdk(import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY)
  const services = window.kakao?.maps.services
  if (!services) throw new Error(KAKAO_SERVICES_UNAVAILABLE_ERROR)
  return services
}

const runKakaoSearchAttempt = <T>(
  services: typeof kakao.maps.services,
  start: KakaoSearchStarter<T>,
  mapResult: (item: T) => AddressSearchResult | null,
  errorMessage: string,
): Promise<readonly AddressSearchResult[]> => new Promise((resolve, reject) => {
  const timeout = window.setTimeout(() => {
    reject(new Error(errorMessage))
  }, KAKAO_SEARCH_TIMEOUT_MS)

  const finish = (callback: () => void): void => {
    window.clearTimeout(timeout)
    callback()
  }

  try {
    start((results, status) => {
      if (status === services.Status.ZERO_RESULT) {
        finish(() => resolve([]))
        return
      }
      if (status !== services.Status.OK) {
        finish(() => reject(new Error(errorMessage)))
        return
      }
      const mappedResults = results
        .map(mapResult)
        .filter((item) => item !== null)
      finish(() => resolve(mappedResults))
    })
  } catch (error) {
    finish(() => reject(error))
  }
})

const runKakaoSearch = async <T>(
  services: typeof kakao.maps.services,
  start: KakaoSearchStarter<T>,
  mapResult: (item: T) => AddressSearchResult | null,
  errorMessage: string,
): Promise<readonly AddressSearchResult[]> => {
  let lastError: unknown
  for (let attempt = 0; attempt < KAKAO_SEARCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runKakaoSearchAttempt(
        services,
        start,
        mapResult,
        errorMessage,
      )
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function searchKakaoAddresses(
  query: string,
): Promise<readonly AddressSearchResult[]> {
  const services = await getKakaoServices()
  const geocoder = new services.Geocoder()
  return runKakaoSearch(
    services,
    (callback) => geocoder.addressSearch(query, callback),
    toAddressSearchResult,
    KAKAO_ADDRESS_SEARCH_ERROR,
  )
}

export async function searchKakaoPlaces(
  query: string,
): Promise<readonly AddressSearchResult[]> {
  const services = await getKakaoServices()
  const places = new services.Places()
  return runKakaoSearch(
    services,
    (callback) => places.keywordSearch(query, callback),
    toPlaceSearchResult,
    KAKAO_KEYWORD_SEARCH_ERROR,
  )
}

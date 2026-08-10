import { parseLotAddress } from '../../worker/ldong/address.ts'

const EARTH_RADIUS_METERS = 6_371_000
export const KAKAO_PLACE_MAX_DISTANCE_METERS = 500
const MINIMUM_NAME_SIMILARITY = 0.45
const GENERIC_APARTMENT_NAME_PATTERN = /(?:아파트|a\.?p\.?t\.?)|\s/giu
const NON_NAME_CHARACTER_PATTERN = /[^\p{L}\p{N}]/gu
const KAKAO_COMPLEX_CATEGORY_PATTERN =
  /(?:^|>\s*)(?:아파트|주상복합|빌라,연립|도시형생활주택)\s*$/u

export interface KakaoPlaceCandidate {
  readonly placeName: string
  readonly categoryName: string
  readonly legalAddress: string
  readonly lat: number
  readonly lng: number
}

const normalizedLotAddressKey = (value: string): string | null => {
  const parsed = parseLotAddress(value.normalize('NFKC'))
  if (parsed === null) return null
  const legalDongName = parsed.legalDongName.split(/\s+/u).at(-1)
  if (legalDongName === undefined) return null

  // Province and district labels differ between the master data and Kakao
  // (for example 서울특별시/서울 and reorganized districts). The legal-dong
  // leaf plus normalized mountain/main/sub lot numbers is the stable suffix.
  return JSON.stringify([
    legalDongName,
    parsed.isMountain,
    Number(parsed.mainNumber),
    Number(parsed.subNumber),
  ])
}

const normalizedPlaceName = (value: string): string => {
  const normalized = value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(GENERIC_APARTMENT_NAME_PATTERN, '')
    .replace(NON_NAME_CHARACTER_PATTERN, '')
  return normalized === ''
    ? value.normalize('NFKC').replace(NON_NAME_CHARACTER_PATTERN, '')
    : normalized
}

const bigrams = (value: string): readonly string[] => {
  const characters = Array.from(value)
  if (characters.length < 2) return characters
  return characters.slice(0, -1).map((character, index) =>
    `${character}${characters[index + 1] ?? ''}`,
  )
}

export const kakaoPlaceNameSimilarity = (
  complexName: string,
  placeName: string,
): number => {
  const expected = normalizedPlaceName(complexName)
  const candidate = normalizedPlaceName(placeName)
  if (expected === candidate) return 1

  const expectedBigrams = bigrams(expected)
  const availableCandidateBigrams = [...bigrams(candidate)]
  let intersection = 0
  for (const bigram of expectedBigrams) {
    const index = availableCandidateBigrams.indexOf(bigram)
    if (index === -1) continue
    intersection += 1
    availableCandidateBigrams.splice(index, 1)
  }
  const total = expectedBigrams.length + bigrams(candidate).length
  return total === 0 ? 0 : (2 * intersection) / total
}

export const kakaoPlaceDistanceMeters = (
  first: { readonly lat: number; readonly lng: number },
  second: { readonly lat: number; readonly lng: number },
): number => {
  const radians = (degrees: number): number => degrees * Math.PI / 180
  const latitudeDelta = radians(second.lat - first.lat)
  const longitudeDelta = radians(second.lng - first.lng)
  const firstLatitude = radians(first.lat)
  const secondLatitude = radians(second.lat)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}

export const isKakaoComplexPlaceCandidate = (
  complexName: string,
  candidate: KakaoPlaceCandidate,
): boolean =>
  KAKAO_COMPLEX_CATEGORY_PATTERN.test(candidate.categoryName) &&
  kakaoPlaceNameSimilarity(complexName, candidate.placeName) >=
    MINIMUM_NAME_SIMILARITY

export interface RankedKakaoPlaceCandidate<Candidate extends KakaoPlaceCandidate> {
  readonly candidate: Candidate
  readonly distanceMeters: number
  readonly nameSimilarity: number
}

export const rankKakaoPlaceCandidates = <Candidate extends KakaoPlaceCandidate>(
  complex: {
    readonly name: string
    readonly legalAddress: string
    readonly lat: number
    readonly lng: number
  },
  candidates: readonly Candidate[],
): readonly RankedKakaoPlaceCandidate<Candidate>[] => {
  const ranked = candidates.map((candidate) => ({
    candidate,
    distanceMeters: kakaoPlaceDistanceMeters(complex, candidate),
    nameSimilarity: kakaoPlaceNameSimilarity(
      complex.name,
      candidate.placeName,
    ),
  }))
  const expectedLotAddress = normalizedLotAddressKey(complex.legalAddress)
  const exactLotCandidates = expectedLotAddress === null
    ? []
    : ranked.filter(({ candidate }) =>
        KAKAO_COMPLEX_CATEGORY_PATTERN.test(candidate.categoryName) &&
        normalizedLotAddressKey(candidate.legalAddress) === expectedLotAddress,
      )
  const accepted = exactLotCandidates.length > 0
    ? exactLotCandidates
    : ranked.filter(({ candidate, distanceMeters }) =>
        distanceMeters <= KAKAO_PLACE_MAX_DISTANCE_METERS &&
        isKakaoComplexPlaceCandidate(complex.name, candidate),
      )

  return accepted.sort((left, right) =>
    right.nameSimilarity - left.nameSimilarity ||
    left.distanceMeters - right.distanceMeters,
  )
}

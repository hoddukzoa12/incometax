const HANGUL_SYLLABLE_START = 0xac00
const HANGUL_SYLLABLE_END = 0xd7a3
const HANGUL_JONGSEONG_COUNT = 28
const NO_JONGSEONG = 0
const GIYEOK_JONGSEONG = 1
const RIEUL_JONGSEONG = 8
const MIEUM_JONGSEONG = 16
const IEUNG_JONGSEONG = 21

const DIGIT_JONGSEONG = {
  '0': IEUNG_JONGSEONG, // 영
  '1': RIEUL_JONGSEONG, // 일
  '2': NO_JONGSEONG, // 이
  '3': MIEUM_JONGSEONG, // 삼
  '4': NO_JONGSEONG, // 사
  '5': NO_JONGSEONG, // 오
  '6': GIYEOK_JONGSEONG, // 육
  '7': RIEUL_JONGSEONG, // 칠
  '8': RIEUL_JONGSEONG, // 팔
  '9': NO_JONGSEONG, // 구
} as const

// 영문으로 끝난 값은 마지막 알파벳의 한국어 이름(에프, 엘 등)을 기준으로 읽어요.
const LATIN_LETTER_WITH_JONGSEONG = new Set(['F', 'L', 'M', 'N', 'R'])
const LATIN_LETTER_WITH_RIEUL = new Set(['L', 'R'])
const SIGNIFICANT_ENDING_PATTERN = /[0-9A-Za-z\uAC00-\uD7A3]/u

type KoreanParticlePair =
  | '은/는'
  | '이/가'
  | '을/를'
  | '와/과'
  | '로/으로'

type EndingKind = 'vowel' | 'consonant' | 'rieul'

const PARTICLE_BY_ENDING = {
  '은/는': { vowel: '는', consonant: '은', rieul: '은' },
  '이/가': { vowel: '가', consonant: '이', rieul: '이' },
  '을/를': { vowel: '를', consonant: '을', rieul: '을' },
  '와/과': { vowel: '와', consonant: '과', rieul: '과' },
  '로/으로': { vowel: '로', consonant: '으로', rieul: '로' },
} as const satisfies Readonly<
  Record<KoreanParticlePair, Readonly<Record<EndingKind, string>>>
>

const lastSignificantCharacter = (value: string): string | null => {
  const characters = Array.from(value.trim())
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (SIGNIFICANT_ENDING_PATTERN.test(characters[index])) {
      return characters[index]
    }
  }
  return null
}

const endingKind = (value: string): EndingKind => {
  const character = lastSignificantCharacter(value)
  if (character === null) return 'vowel'

  const codePoint = character.codePointAt(0)
  if (
    codePoint !== undefined &&
    codePoint >= HANGUL_SYLLABLE_START &&
    codePoint <= HANGUL_SYLLABLE_END
  ) {
    const jongseong = (codePoint - HANGUL_SYLLABLE_START) %
      HANGUL_JONGSEONG_COUNT
    if (jongseong === NO_JONGSEONG) return 'vowel'
    return jongseong === RIEUL_JONGSEONG ? 'rieul' : 'consonant'
  }

  if (character in DIGIT_JONGSEONG) {
    const jongseong = DIGIT_JONGSEONG[
      character as keyof typeof DIGIT_JONGSEONG
    ]
    if (jongseong === NO_JONGSEONG) return 'vowel'
    return jongseong === RIEUL_JONGSEONG ? 'rieul' : 'consonant'
  }

  const upperCharacter = character.toUpperCase()
  if (LATIN_LETTER_WITH_RIEUL.has(upperCharacter)) return 'rieul'
  return LATIN_LETTER_WITH_JONGSEONG.has(upperCharacter)
    ? 'consonant'
    : 'vowel'
}

export const selectKoreanParticle = (
  value: string,
  pair: KoreanParticlePair,
): string => PARTICLE_BY_ENDING[pair][endingKind(value)]

export const withKoreanParticle = (
  value: string,
  pair: KoreanParticlePair,
): string => `${value}${selectKoreanParticle(value, pair)}`

export const COMPLEX_NOT_FOUND_MESSAGE = '단지를 찾을 수 없습니다.'
export const INVALID_COMPLEX_ID_MESSAGE = 'Invalid complex id'

export const decodeComplexId = (encodedComplexId: string): string | null => {
  try {
    return decodeURIComponent(encodedComplexId).trim() || null
  } catch (error) {
    if (error instanceof URIError) return null
    throw error
  }
}

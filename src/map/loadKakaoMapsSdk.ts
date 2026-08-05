import { MAP_MESSAGES } from '../messages/map'

const KAKAO_MAPS_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'
const KAKAO_MAPS_SDK_SCRIPT_ID = 'kakao-maps-sdk'
const KAKAO_MAPS_SDK_LIBRARIES = ['services', 'clusterer'] as const

let sdkLoadPromise: Promise<void> | undefined

const finishKakaoMapsLoad = (resolve: () => void): void => {
  if (!window.kakao?.maps) {
    throw new Error('Kakao Maps SDK did not initialize')
  }
  window.kakao.maps.load(resolve)
}

export const loadKakaoMapsSdk = (
  javascriptKey: string | undefined,
): Promise<void> => {
  if (!javascriptKey) {
    return Promise.reject(new Error(MAP_MESSAGES.missingKey))
  }
  if (window.kakao?.maps) {
    return new Promise((resolve) => finishKakaoMapsLoad(resolve))
  }
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      KAKAO_MAPS_SDK_SCRIPT_ID,
    ) as HTMLScriptElement | null
    const script = existingScript ?? document.createElement('script')

    const handleLoad = (): void => {
      try {
        finishKakaoMapsLoad(resolve)
      } catch (error) {
        reject(error)
      }
    }
    const handleError = (): void => {
      reject(new Error('Kakao Maps SDK failed to load'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.id = KAKAO_MAPS_SDK_SCRIPT_ID
      script.src = [
        `${KAKAO_MAPS_SDK_URL}?appkey=${encodeURIComponent(javascriptKey)}`,
        'autoload=false',
        `libraries=${KAKAO_MAPS_SDK_LIBRARIES.join(',')}`,
      ].join('&')
      script.async = true
      document.head.appendChild(script)
    }
  }).catch((error: unknown) => {
    sdkLoadPromise = undefined
    document.getElementById(KAKAO_MAPS_SDK_SCRIPT_ID)?.remove()
    throw error
  })

  return sdkLoadPromise
}

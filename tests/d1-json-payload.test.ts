import { describe, expect, it } from 'vitest'

import { extractD1JsonPayload } from '../scripts/lib/d1.ts'

const ESC = String.fromCharCode(27)
const GREY = `${ESC}[90m`
const RESET = `${ESC}[39m`

// 실제 wrangler 출력 그대로. ANSI 이스케이프가 `[`를 품고 있다는 점이 이 버그의 핵심이다 —
// 첫 `[`를 그냥 찾으면 머리말 안에서 잘못 걸린다.
const REMOTE_FILE_PREAMBLE = [
  `${GREY}\u250c${RESET} Checking if file needs uploading`,
  `${GREY}\u2502${RESET}`,
  `${GREY}\u251c${RESET} Uploading 3a7736e2-13fc-4e8e-96e6-109d3954b9d4.4bc7db60.sql`,
  `${GREY}\u2502${RESET} Uploading complete.`,
  `${GREY}\u2502${RESET}`,
].join('\n')

const PAYLOAD = JSON.stringify([
  { results: [{ x: 1 }], success: true },
])

describe('extractD1JsonPayload', () => {
  it('reads clean JSON unchanged', () => {
    expect(JSON.parse(extractD1JsonPayload(PAYLOAD))).toEqual([
      { results: [{ x: 1 }], success: true },
    ])
  })

  // 원격 --file 실행은 업로드 진행 상황을 ANSI 색상이 입혀진 표로 stdout에 먼저 쓴다.
  // --command 와 로컬 실행에는 없어서 프로덕션 첫 적재에서야 드러났다.
  it('skips the ANSI upload preamble that only --remote --file emits', () => {
    const stdout = `${REMOTE_FILE_PREAMBLE}\n${PAYLOAD}`
    expect(JSON.parse(extractD1JsonPayload(stdout))).toEqual([
      { results: [{ x: 1 }], success: true },
    ])
  })

  it('keeps brackets that appear inside the payload', () => {
    const stdout = `${REMOTE_FILE_PREAMBLE}\n${JSON.stringify([
      { results: [{ note: 'a [bracket] inside' }], success: true },
    ])}`
    const parsed = JSON.parse(extractD1JsonPayload(stdout)) as readonly {
      readonly results: readonly { readonly note: string }[]
    }[]
    expect(parsed[0]?.results[0]?.note).toBe('a [bracket] inside')
  })

  it('fails loudly when there is no JSON at all', () => {
    expect(() => extractD1JsonPayload(REMOTE_FILE_PREAMBLE)).toThrow(TypeError)
  })
})

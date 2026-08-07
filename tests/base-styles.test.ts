import { readFileSync, statSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readProjectFile = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const TOKENS_STYLES = readProjectFile('src/styles/tokens.css')
const FONT_STYLES = readProjectFile('src/styles/fonts.css')
const BASE_STYLES = readProjectFile('src/styles/base.css')
const MAIN_SOURCE = readProjectFile('src/main.tsx')
const PRETENDARD_FONT_PATH = new URL(
  '../public/fonts/pretendard/PretendardVariable.woff2',
  import.meta.url,
)
const PRETENDARD_LICENSE_PATH = new URL(
  '../public/fonts/pretendard/LICENSE.txt',
  import.meta.url,
)

describe('base typography', () => {
  it('applies the sans token to body and inherits it in form controls', () => {
    expect(TOKENS_STYLES).toMatch(
      /--font-family-sans:\s*Pretendard\s*,/,
    )
    expect(BASE_STYLES).toMatch(
      /body\s*\{[^}]*font-family:\s*var\(--font-family-sans\);[^}]*\}/s,
    )
    expect(BASE_STYLES).toMatch(
      /button,\s*input,\s*select,\s*textarea\s*\{[^}]*font:\s*inherit;[^}]*\}/s,
    )
  })

  it('loads the self-hosted Pretendard variable font with a visible fallback', () => {
    expect(MAIN_SOURCE).toContain("import './styles/fonts.css'")
    expect(MAIN_SOURCE).toContain("import './styles/base.css'")
    expect(FONT_STYLES).toMatch(/font-family:\s*["']Pretendard["'];/)
    expect(FONT_STYLES).toMatch(/font-weight:\s*45 920;/)
    expect(FONT_STYLES).toMatch(/font-display:\s*swap;/)
    expect(FONT_STYLES).toContain('/fonts/pretendard/PretendardVariable.woff2')
    expect(statSync(PRETENDARD_FONT_PATH).size).toBeGreaterThan(0)
    expect(readFileSync(PRETENDARD_LICENSE_PATH, 'utf8')).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
    )
  })
})

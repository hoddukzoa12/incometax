import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = new URL('../', import.meta.url)
const SOURCE_FILE_PATTERN = 'src/**/*.{ts,tsx}'
const FORMAT_WON_DEFINITION_PATTERN =
  /\b(?:const|let|var)\s+formatWon\b|\bfunction\s+formatWon\b/g
const WON_CURRENCY_SYMBOL = '₩'

const sourceFiles = globSync(SOURCE_FILE_PATTERN, {
  cwd: SOURCE_ROOT,
}).map((path) => ({
  path,
  source: readFileSync(new URL(path, SOURCE_ROOT), 'utf8'),
}))

describe('won format SSOT', () => {
  it('defines formatWon exactly once in the app-wide formatter', () => {
    const definitions = sourceFiles.flatMap(({ path, source }) =>
      [...source.matchAll(FORMAT_WON_DEFINITION_PATTERN)].map(() => path))

    expect(definitions).toEqual(['src/format/won.ts'])
  })

  it('does not use the won currency symbol in source', () => {
    const filesWithCurrencySymbol = sourceFiles
      .filter(({ source }) => source.includes(WON_CURRENCY_SYMBOL))
      .map(({ path }) => path)

    expect(filesWithCurrencySymbol).toEqual([])
  })
})

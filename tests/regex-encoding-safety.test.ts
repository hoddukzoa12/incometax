import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOTS = ['src', 'shared'] as const
const SOURCE_EXTENSIONS = new Set([
  '.cts',
  '.js',
  '.jsx',
  '.mts',
  '.ts',
  '.tsx',
])
const MAX_ASCII_CODE_POINT = 0x7f

type CharacterClassAtom = 'hyphen' | 'rawNonAscii' | 'other'

interface UnsafeRegularExpression {
  readonly filePath: string
  readonly line: number
  readonly literal: string
}

const sourceFilesBelow = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFilesBelow(filePath)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [filePath] : []
  })

const codePointLengthAt = (value: string, index: number): number =>
  String.fromCodePoint(value.codePointAt(index) ?? 0).length

const classifyRawAtom = (character: string): CharacterClassAtom => {
  if (character === '-') return 'hyphen'
  return (character.codePointAt(0) ?? 0) > MAX_ASCII_CODE_POINT
    ? 'rawNonAscii'
    : 'other'
}

const characterClassAtomsAt = (
  literal: string,
  openingBracketIndex: number,
): { readonly atoms: readonly CharacterClassAtom[]; readonly endIndex: number } => {
  const atoms: CharacterClassAtom[] = []

  for (
    let index = openingBracketIndex + 1;
    index < literal.length;
    index += 1
  ) {
    const character = literal[index]
    if (character === ']') return { atoms, endIndex: index }

    if (character === '\\') {
      const escapedCharacterIndex = index + 1
      const escapedCharacter = literal[escapedCharacterIndex]
      if (escapedCharacter === undefined) return { atoms, endIndex: index }

      atoms.push(
        (escapedCharacter.codePointAt(0) ?? 0) > MAX_ASCII_CODE_POINT
          ? 'rawNonAscii'
          : 'other',
      )
      index += codePointLengthAt(literal, escapedCharacterIndex)
      continue
    }

    atoms.push(classifyRawAtom(character))
    index += codePointLengthAt(literal, index) - 1
  }

  return { atoms, endIndex: literal.length }
}

const hasRawNonAsciiRange = (literal: string): boolean => {
  for (let index = 0; index < literal.length; index += 1) {
    const character = literal[index]
    if (character === '\\') {
      index += codePointLengthAt(literal, index + 1)
      continue
    }
    if (character !== '[') continue

    const { atoms, endIndex } = characterClassAtomsAt(literal, index)
    const hasUnsafeRange = atoms.some((atom, atomIndex) =>
      atom === 'hyphen' &&
      atomIndex > 0 &&
      atomIndex < atoms.length - 1 &&
      (atoms[atomIndex - 1] === 'rawNonAscii' ||
        atoms[atomIndex + 1] === 'rawNonAscii'),
    )
    if (hasUnsafeRange) return true
    index = endIndex
  }

  return false
}

const unsafeRegularExpressionsIn = (
  filePath: string,
  source: string,
): readonly UnsafeRegularExpression[] => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const unsafeRegularExpressions: UnsafeRegularExpression[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isRegularExpressionLiteral(node) &&
      hasRawNonAsciiRange(node.text)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      )
      unsafeRegularExpressions.push({
        filePath,
        line: line + 1,
        literal: node.text,
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return unsafeRegularExpressions
}

describe('regular expression encoding safety', () => {
  it('distinguishes raw range endpoints from escaped ones and strings', () => {
    const fixtureSource = [
      String.raw`const safeRange = /[\uAC00-\uD7A3]/u`,
      `const lookalikeString = '/[가-힣]/u'`,
      `const unsafeRange = /[가-힣]/u`,
    ].join('\n')

    expect(unsafeRegularExpressionsIn('fixture.ts', fixtureSource)).toEqual([
      {
        filePath: 'fixture.ts',
        line: 3,
        literal: `/[가-힣]/u`,
      },
    ])
  })

  it('keeps raw non-ASCII ranges out of src and shared regex literals', () => {
    const unsafeRegularExpressions = SOURCE_ROOTS.flatMap((sourceRoot) =>
      sourceFilesBelow(sourceRoot).flatMap((filePath) =>
        unsafeRegularExpressionsIn(filePath, readFileSync(filePath, 'utf8')),
      ),
    ).map((result) => ({
      ...result,
      filePath: relative(process.cwd(), result.filePath),
    }))

    expect(unsafeRegularExpressions).toEqual([])
  })
})

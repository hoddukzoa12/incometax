import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DATABASE_BINDING = 'COMPLEX_DB'

export type D1Location = 'local' | 'remote'

export interface D1ExecutionMeasurement {
  readonly operation: 'read' | 'write'
  readonly durationMs: number
}

export type D1ExecutionObserver = (
  measurement: D1ExecutionMeasurement,
) => void

interface D1ExecutionOptions {
  readonly input?: 'command' | 'file'
  readonly operation?: D1ExecutionMeasurement['operation']
  readonly observer?: D1ExecutionObserver
}

type D1Result = {
  readonly success: boolean
  readonly results: readonly Record<string, unknown>[]
}

/** 줄 첫머리의 `[` 만 JSON 배열의 시작으로 본다. */
const JSON_ARRAY_LINE_START = /^\[/m

const MISSING_JSON_PAYLOAD_MESSAGE =
  'Wrangler D1 output contained no JSON payload'

/**
 * `--json`을 줘도 Wrangler는 JSON 앞에 사람용 출력을 붙일 수 있다.
 * `--remote --file`은 업로드 진행 상황을 ANSI 색상이 입혀진 표로 stdout에 먼저 쓴다
 * (`--command`나 로컬 실행에는 없어서 원격 첫 실행에서야 드러났다).
 *
 * 첫 `[`를 그냥 찾으면 안 된다 — ANSI 이스케이프 `ESC[90m` 자체가 `[`를 품고 있어
 * 색이 입혀진 머리말 안에서 잘못 걸린다. Wrangler는 JSON을 항상 새 줄에서 시작하므로
 * **줄 첫머리의 `[`** 를 기준으로 자른다.
 */
export const extractD1JsonPayload = (stdout: string): string => {
  const match = JSON_ARRAY_LINE_START.exec(stdout)
  if (match?.index === undefined) {
    throw new TypeError(MISSING_JSON_PAYLOAD_MESSAGE)
  }
  return stdout.slice(match.index)
}

export const runD1 = async (
  sql: string,
  location: D1Location,
  options: D1ExecutionOptions = {},
): Promise<readonly D1Result[]> => {
  const startedAt = performance.now()
  const input = options.input ?? 'command'
  let temporaryDirectory: string | null = null
  try {
    temporaryDirectory =
      input === 'file' ? await mkdtemp(join(tmpdir(), 'incometax-d1-')) : null
    const inputPath =
      temporaryDirectory === null
        ? null
        : join(temporaryDirectory, 'statements.sql')
    if (inputPath !== null) await writeFile(inputPath, sql, 'utf8')
    const args = [
      '--no-install',
      'wrangler',
      'd1',
      'execute',
      DATABASE_BINDING,
      `--${location}`,
      input === 'file' ? '--file' : '--command',
      inputPath ?? sql,
      '--yes',
      '--json',
    ]
    const result = await new Promise<{
      readonly code: number | null
      readonly stdout: string
      readonly stderr: string
    }>((resolve, reject) => {
      const child = spawn('npx', args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk
      })
      child.on('error', reject)
      child.on('close', (code) => resolve({ code, stdout, stderr }))
    })

    if (result.code !== 0) {
      throw new Error(
        `D1 command failed (${String(result.code)}): ${result.stderr || result.stdout}`,
      )
    }
    const parsed: unknown = JSON.parse(extractD1JsonPayload(result.stdout))
    if (!Array.isArray(parsed)) {
      throw new TypeError('Unexpected Wrangler D1 JSON output')
    }
    const results = parsed as D1Result[]
    if (results.some((entry) => entry.success !== true)) {
      throw new Error('One or more D1 statements were not successful')
    }
    return results
  } finally {
    try {
      if (temporaryDirectory !== null) {
        await rm(temporaryDirectory, { recursive: true, force: true })
      }
    } finally {
      options.observer?.({
        operation: options.operation ?? 'write',
        durationMs: performance.now() - startedAt,
      })
    }
  }
}

export const queryD1Rows = async <T extends object>(
  sql: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<readonly T[]> => {
  const results = await runD1(sql, location, {
    operation: 'read',
    observer,
  })
  const first = results[0]
  if (!first?.success || !Array.isArray(first.results)) {
    throw new Error('D1 query was not successful')
  }
  return first.results as readonly T[]
}

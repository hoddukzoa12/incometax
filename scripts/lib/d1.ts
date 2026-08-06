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
  readonly runner?: D1CommandRunner
}

type D1Result = {
  readonly success: boolean
  readonly results: readonly Record<string, unknown>[]
}

export interface D1CommandResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

export type D1CommandRunner = (
  args: readonly string[],
) => Promise<D1CommandResult>

/** 줄 첫머리의 `[` 만 JSON 배열의 시작으로 본다. */
const JSON_ARRAY_LINE_START = /^\[/m

const MISSING_JSON_PAYLOAD_MESSAGE =
  'Wrangler D1 output contained no JSON payload'

const D1_RETRY_BACKOFF_MS = [1_000, 2_000] as const
const D1_MAX_ATTEMPTS = D1_RETRY_BACKOFF_MS.length + 1

const DETERMINISTIC_D1_FAILURE_PATTERNS = [
  /\bSQLITE_(?:AUTH|CONSTRAINT(?:_\w+)?|CORRUPT|ERROR|FORMAT|MISMATCH|MISUSE|NOTADB|PERM|RANGE|READONLY|SCHEMA|TOOBIG)\b/i,
  /\b(?:CHECK|FOREIGN KEY|NOT NULL|UNIQUE) constraint failed\b/i,
  /\bconstraint (?:failed|violation)\b/i,
  /\bsyntax error\b/i,
  /\bno such (?:column|table)\b/i,
  /\b(?:invalid|missing|unknown) binding\b/i,
  /\b(?:could not|couldn't) find.{0,40}\bbinding\b/is,
  /\bbinding.{0,40}\bnot found\b/is,
  /\b(?:authentication|authorization) failed\b/i,
  /\b(?:forbidden|invalid (?:api )?token|invalid credentials|unauthorized)\b/i,
  /\b(?:HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?)\D*(?:401|403)\b/i,
  /\bcode\D*10000\b/i,
] as const

const TRANSIENT_D1_FAILURE_PATTERNS = [
  /\bfile could not be uploaded\b/i,
  /\b(?:failed|failure|error).{0,30}\bupload/i,
  /\bupload.{0,30}\b(?:failed|failure|error)/i,
  /<Code>InternalError<\/Code>/i,
  /\bInternalError\b/i,
  /\b(?:bad gateway|gateway timeout|internal server error|service unavailable)\b/i,
  /\b(?:HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?|response status)\D*5\d{2}\b/i,
  /\b(?:api|cloudflare).{0,40}\b5\d{2}\b/is,
  /\b(?:EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|ETIMEDOUT|UND_ERR_(?:BODY_TIMEOUT|CONNECT_TIMEOUT|HEADERS_TIMEOUT|SOCKET))\b/i,
  /\b(?:connection (?:was )?reset|network error|socket hang up|timed out|timeout(?:error)?)\b/i,
] as const

const wait = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs))

const defaultD1CommandRunner: D1CommandRunner = async (args) =>
  new Promise((resolve, reject) => {
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

const d1FailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isTransientD1Failure = (error: unknown): boolean => {
  const message = d1FailureMessage(error)
  if (DETERMINISTIC_D1_FAILURE_PATTERNS.some((pattern) => pattern.test(message))) {
    return false
  }
  return TRANSIENT_D1_FAILURE_PATTERNS.some((pattern) => pattern.test(message))
}

const d1CommandError = (result: D1CommandResult): Error => {
  const upstreamOutput = [result.stderr, result.stdout]
    .filter((output) => output.length > 0)
    .join('\n')
  return new Error(
    `D1 command failed (${String(result.code)}): ${upstreamOutput}`,
  )
}

const executeD1Command = async (
  args: readonly string[],
  location: D1Location,
  runner: D1CommandRunner,
): Promise<D1CommandResult> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await runner(args)
      if (result.code !== 0) throw d1CommandError(result)
      return result
    } catch (error) {
      const backoffMs = D1_RETRY_BACKOFF_MS[attempt - 1]
      if (
        location !== 'remote' ||
        !isTransientD1Failure(error) ||
        backoffMs === undefined
      ) {
        throw error
      }
      console.warn(
        `D1 transient failure on attempt ${attempt}/${D1_MAX_ATTEMPTS}; ` +
          `retrying in ${backoffMs}ms: ${d1FailureMessage(error)}`,
      )
      await wait(backoffMs)
    }
  }
}

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
    const result = await executeD1Command(
      args,
      location,
      options.runner ?? defaultD1CommandRunner,
    )
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

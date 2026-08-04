import { describe, expect, it, vi } from 'vitest'

import {
  collectResumableKaptList,
  type ComplexListCheckpoint,
} from '../scripts/lib/complex-list.ts'
import type { KaptListPage } from '../scripts/lib/complex-source.ts'

const EXPECTED_FIELDS = [
  'as1',
  'as2',
  'as3',
  'as4',
  'bjdCode',
  'kaptCode',
  'kaptName',
] as const
const TOTAL_COUNT = 2_001

const item = (index: number): Record<string, unknown> => ({
  kaptCode: `A${String(index).padStart(8, '0')}`,
  kaptName: `Complex ${index}`,
  bjdCode: String(11_000_000_00 + index).padStart(10, '0'),
  as1: '서울특별시',
  as2: index === 1_094 ? null : '강남구',
  as3: '대치동',
  as4: null,
})

const page = (pageNo: number, start: number, count: number): KaptListPage => ({
  items: Array.from({ length: count }, (_, offset) => item(start + offset)),
  pageNo,
  numOfRows: 1_000,
  totalCount: TOTAL_COUNT,
  raw: {},
})

describe('collectResumableKaptList', () => {
  it('resumes at the saved page after a mid-list failure', async () => {
    let checkpoint: ComplexListCheckpoint = {
      nextPage: 1,
      records: [],
      fields: [],
    }
    const firstRunRead = vi.fn(async (pageNo: number) => {
      if (pageNo === 1) return page(1, 0, 1_000)
      throw new DOMException('source timed out', 'TimeoutError')
    })

    await expect(
      collectResumableKaptList({
        checkpoint,
        expectedCount: TOTAL_COUNT,
        expectedFields: EXPECTED_FIELDS,
        readPage: firstRunRead,
        savePage: async (saved) => {
          checkpoint = {
            nextPage: saved.page + 1,
            records: [...checkpoint.records, ...saved.records],
            fields: saved.fields,
          }
        },
        log: () => undefined,
      }),
    ).rejects.toThrow('K-apt list page 2/3 failed after retries: source timed out')
    expect(checkpoint.nextPage).toBe(2)

    const resumedRead = vi.fn(async (pageNo: number) => {
      if (pageNo === 2) return page(2, 1_000, 1_000)
      if (pageNo === 3) return page(3, 2_000, 1)
      throw new Error(`Unexpected page ${pageNo}`)
    })
    const completed = await collectResumableKaptList({
      checkpoint,
      expectedCount: TOTAL_COUNT,
      expectedFields: EXPECTED_FIELDS,
      readPage: resumedRead,
      savePage: async (saved) => {
        checkpoint = {
          nextPage: saved.page + 1,
          records: [...checkpoint.records, ...saved.records],
          fields: saved.fields,
        }
      },
      log: () => undefined,
    })

    expect(resumedRead.mock.calls.map(([pageNo]) => pageNo)).toEqual([2, 3])
    expect(completed.records).toHaveLength(TOTAL_COUNT)
    expect(completed.records[1_094]?.district).toBeNull()
  })

  it('adds page context when retries are exhausted', async () => {
    const bareTimeout = new DOMException('operation aborted', 'TimeoutError')

    const request = collectResumableKaptList({
      checkpoint: { nextPage: 1, records: [], fields: [] },
      expectedCount: 1_000,
      expectedFields: EXPECTED_FIELDS,
      readPage: async () => {
        throw bareTimeout
      },
      savePage: async () => undefined,
      log: () => undefined,
    })

    await expect(request).rejects.not.toBe(bareTimeout)
    await expect(request).rejects.toThrow(
      'K-apt list page 1/1 failed after retries: operation aborted',
    )
  })
})

import {
  KAPT_LIST_PAGE_SIZE,
  type KaptListPage,
  recordFields,
  requireString,
} from './complex-source.ts'
import type {
  CompleteComplexListRecord,
  ComplexListRecord,
} from '../../shared/complex.ts'

export type { ComplexListRecord }

export interface ComplexListCheckpoint {
  readonly nextPage: number
  readonly records: readonly ComplexListRecord[]
  readonly fields: readonly string[]
}

export interface CompletedComplexList {
  readonly records: readonly ComplexListRecord[]
  readonly fields: readonly string[]
}

interface SavedComplexListPage {
  readonly page: number
  readonly records: readonly ComplexListRecord[]
  readonly fields: readonly string[]
}

interface CollectComplexListOptions {
  readonly checkpoint: ComplexListCheckpoint
  readonly expectedCount: number
  readonly expectedFields: readonly string[]
  readonly readPage: (page: number) => Promise<KaptListPage>
  readonly savePage: (page: SavedComplexListPage) => Promise<void>
  readonly log?: (message: string) => void
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const sameFields = (
  actual: readonly string[],
  expected: readonly string[],
): boolean => {
  const sortedActual = [...actual].sort()
  const sortedExpected = [...expected].sort()
  return (
    sortedActual.length === sortedExpected.length &&
    sortedActual.every((field, index) => field === sortedExpected[index])
  )
}

const optionalString = (value: unknown, path: string): string | null => {
  if (value === null || value === undefined || value === '') return null
  return requireString(value, path)
}

export const hasCompleteSearchLocation = (
  record: ComplexListRecord,
): record is CompleteComplexListRecord =>
  record.province !== null &&
  record.legalDong !== null

const validateCheckpoint = (
  checkpoint: ComplexListCheckpoint,
  totalPages: number,
  expectedCount: number,
): void => {
  if (
    !Number.isInteger(checkpoint.nextPage) ||
    checkpoint.nextPage < 1 ||
    checkpoint.nextPage > totalPages + 1
  ) {
    throw new Error(`Invalid K-apt list checkpoint page: ${checkpoint.nextPage}`)
  }
  if (checkpoint.records.length > expectedCount) {
    throw new Error(
      `Invalid K-apt list checkpoint count: ${checkpoint.records.length}/${expectedCount}`,
    )
  }
  const completedRecordCount = Math.min(
    (checkpoint.nextPage - 1) * KAPT_LIST_PAGE_SIZE,
    expectedCount,
  )
  if (checkpoint.records.length !== completedRecordCount) {
    throw new Error(
      `K-apt list checkpoint page ${checkpoint.nextPage} requires ${completedRecordCount} records, received ${checkpoint.records.length}`,
    )
  }
  const uniqueIds = new Set(checkpoint.records.map((record) => record.complexId))
  if (uniqueIds.size !== checkpoint.records.length) {
    throw new Error('K-apt list checkpoint contains duplicate complex codes')
  }
}

export const collectResumableKaptList = async ({
  checkpoint,
  expectedCount,
  expectedFields,
  readPage,
  savePage,
  log = console.log,
}: CollectComplexListOptions): Promise<CompletedComplexList> => {
  const totalPages = Math.ceil(expectedCount / KAPT_LIST_PAGE_SIZE)
  validateCheckpoint(checkpoint, totalPages, expectedCount)

  const records = [...checkpoint.records]
  const fields = new Set(checkpoint.fields)
  const sourceIds = new Set(records.map((record) => record.complexId))

  for (let page = checkpoint.nextPage; page <= totalPages; page += 1) {
    let response: KaptListPage
    try {
      response = await readPage(page)
    } catch (error) {
      throw new Error(
        `K-apt list page ${page}/${totalPages} failed after retries: ${errorMessage(error)}`,
        { cause: error },
      )
    }

    if (response.pageNo !== page) {
      throw new Error(
        `K-apt list page mismatch: requested ${page}, received ${response.pageNo}`,
      )
    }
    if (response.totalCount !== expectedCount) {
      throw new Error(
        `K-apt list page ${page}/${totalPages} source count changed: ${expectedCount} -> ${response.totalCount}`,
      )
    }

    const pageRecords = response.items.map((record, index) => ({
      complexId: requireString(
        record.kaptCode,
        `K-apt list page ${page} items[${index}].kaptCode`,
      ),
      name: requireString(
        record.kaptName,
        `K-apt list page ${page} items[${index}].kaptName`,
      ),
      legalDongCode: requireString(
        record.bjdCode,
        `K-apt list page ${page} items[${index}].bjdCode`,
      ),
      province: requireString(
        record.as1,
        `K-apt list page ${page} items[${index}].as1`,
      ),
      district: optionalString(
        record.as2,
        `K-apt list page ${page} items[${index}].as2`,
      ),
      legalDong: requireString(
        record.as3,
        `K-apt list page ${page} items[${index}].as3`,
      ),
      ri: optionalString(
        record.as4,
        `K-apt list page ${page} items[${index}].as4`,
      ),
    }))
    for (const record of pageRecords) {
      if (sourceIds.has(record.complexId)) {
        throw new Error(
          `K-apt list page ${page}/${totalPages} contains duplicate complex code ${record.complexId}`,
        )
      }
      sourceIds.add(record.complexId)
    }
    for (const field of recordFields(response.items)) fields.add(field)

    const savedPage = {
      page,
      records: pageRecords,
      fields: [...fields].sort(),
    }
    try {
      await savePage(savedPage)
    } catch (error) {
      throw new Error(
        `Failed to checkpoint K-apt list page ${page}/${totalPages}: ${errorMessage(error)}`,
        { cause: error },
      )
    }
    records.push(...pageRecords)
    log(`Collected list page ${page}/${totalPages}: ${records.length} records`)
  }

  if (records.length !== expectedCount) {
    throw new Error(
      `K-apt list pagination count mismatch: expected ${expectedCount}, received ${records.length}`,
    )
  }
  const completedFields = [...fields].sort()
  if (!sameFields(completedFields, expectedFields)) {
    throw new Error('K-apt list fields changed after verification')
  }

  return { records, fields: completedFields }
}

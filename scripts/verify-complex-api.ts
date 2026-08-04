import { resolve } from 'node:path'

import {
  collectPages,
  type JsonRecord,
  readKaptBasis,
  readKaptPage,
  readRebPage,
  recordFields,
  requireKaptResponse,
  requireRecord,
  requireString,
} from './lib/complex-source.ts'
import { writeJsonReport } from './lib/json-report.ts'

const SERVICE_KEY_ENV_NAME = 'DATA_GO_KR_SERVICE_KEY'
const ARTIFACT_ROOT = '.artifacts/complex-api-verification'

const COORDINATE_FIELD_PATTERN = /^(lat|latitude|lng|lon|long|longitude|x|y)$/i

const coordinateFields = (records: JsonRecord[]): string[] =>
  [...new Set(records.flatMap((record) => Object.keys(record)))].filter((field) =>
    COORDINATE_FIELD_PATTERN.test(field),
  )

const fieldShapeCount = (records: JsonRecord[]): number =>
  new Set(records.map((record) => Object.keys(record).sort().join(','))).size

const recordsWithCoordinates = (
  records: JsonRecord[],
  fields: string[],
): number =>
  records.filter((record) => fields.some((field) => record[field] != null)).length

const main = async (): Promise<void> => {
  const serviceKey = process.env[SERVICE_KEY_ENV_NAME]
  if (!serviceKey) {
    throw new Error(
      `Missing ${SERVICE_KEY_ENV_NAME}. Put it in the process environment; the script never writes the key to artifacts.`,
    )
  }

  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const outputDirectory = resolve(ARTIFACT_ROOT, timestamp)

  const firstKaptPage = await readKaptPage(serviceKey, 1)
  if (firstKaptPage.items.length === 0) {
    throw new Error('K-apt list API returned zero records')
  }

  const kaptRecords = await collectPages(
    firstKaptPage.items,
    firstKaptPage.totalCount,
    async (page) => (await readKaptPage(serviceKey, page)).items,
  )
  const sampleKaptCode = requireString(
    firstKaptPage.items[0]?.kaptCode,
    'response.body.items[0].kaptCode',
  )
  const kaptBasis = await readKaptBasis(serviceKey, sampleKaptCode)
  const kaptBasisResponse = requireKaptResponse(kaptBasis)
  const kaptBasisItem = requireRecord(
    requireRecord(kaptBasisResponse.body, 'response.body').item,
    'response.body.item',
  )

  const firstRebPage = await readRebPage(serviceKey, 1)
  const rebRecords = await collectPages(
    firstRebPage.data,
    firstRebPage.totalCount,
    async (page) => (await readRebPage(serviceKey, page)).data,
  )

  const kaptCoordinateFields = coordinateFields(kaptRecords)
  const rebCoordinateFields = coordinateFields(rebRecords)
  const summary = {
    observedAt: new Date().toISOString(),
    kaptList: {
      pagination: {
        pageNo: firstKaptPage.pageNo,
        numOfRows: firstKaptPage.numOfRows,
        totalCount: firstKaptPage.totalCount,
      },
      itemFields: recordFields(kaptRecords),
      fieldShapeCount: fieldShapeCount(kaptRecords),
      coordinateFields: kaptCoordinateFields,
      recordsWithCoordinates: recordsWithCoordinates(
        kaptRecords,
        kaptCoordinateFields,
      ),
      recordsNeedingGeocoding:
        kaptRecords.length -
        recordsWithCoordinates(kaptRecords, kaptCoordinateFields),
    },
    kaptBasis: {
      sampleKaptCode,
      responseFields: Object.keys(kaptBasisItem).sort(),
      coordinateFields: coordinateFields([kaptBasisItem]),
    },
    rebComplexInfo: {
      pagination: {
        page: firstRebPage.page,
        perPage: firstRebPage.perPage,
        totalCount: firstRebPage.totalCount,
        currentCount: firstRebPage.currentCount,
      },
      itemFields: recordFields(rebRecords),
      fieldShapeCount: fieldShapeCount(rebRecords),
      coordinateFields: rebCoordinateFields,
      recordsWithCoordinates: recordsWithCoordinates(
        rebRecords,
        rebCoordinateFields,
      ),
      recordsNeedingGeocoding:
        rebRecords.length - recordsWithCoordinates(rebRecords, rebCoordinateFields),
    },
  }

  await Promise.all([
    writeJsonReport(
      resolve(outputDirectory, 'kapt-list-first-page.json'),
      firstKaptPage.raw,
    ),
    writeJsonReport(
      resolve(outputDirectory, 'kapt-basis-sample.json'),
      kaptBasis,
    ),
    writeJsonReport(
      resolve(outputDirectory, 'reb-complex-first-page.json'),
      firstRebPage.raw,
    ),
    writeJsonReport(resolve(outputDirectory, 'summary.json'), summary),
  ])

  console.log(JSON.stringify({ outputDirectory, ...summary }, null, 2))
}

await main()

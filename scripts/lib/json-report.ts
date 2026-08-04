import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const writeJsonReport = async (
  path: string,
  value: unknown,
): Promise<void> => {
  const outputPath = resolve(path)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

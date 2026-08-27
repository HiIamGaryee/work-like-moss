import { HR_DATASET_PATH, REQUIRED_SHEETS, type HrSheetName } from '@/data/hr-data.constants'
import type { SheetRow } from '@/utils/normalise'

export type WorkbookSheets = Record<HrSheetName, SheetRow[]>

export class HrDatasetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HrDatasetError'
  }
}

const MISSING_FILE_MESSAGE = [
  'Unable to load HR dataset.',
  `Expected file: public${HR_DATASET_PATH}`,
].join('\n')

const ZIP_SIGNATURE = [0x50, 0x4b]

function assertXlsxBytes(buffer: ArrayBuffer): void {
  const header = new Uint8Array(buffer.slice(0, ZIP_SIGNATURE.length))
  const isXlsx = ZIP_SIGNATURE.every((byte, index) => header[index] === byte)
  if (!isXlsx) {
    throw new HrDatasetError(
      `${MISSING_FILE_MESSAGE}\nThe server returned something other than an .xlsx workbook.`,
    )
  }
}

export async function fetchHrWorkbook(): Promise<WorkbookSheets> {
  let response: Response
  try {
    response = await fetch(HR_DATASET_PATH)
  } catch {
    throw new HrDatasetError(MISSING_FILE_MESSAGE)
  }

  if (!response.ok) throw new HrDatasetError(MISSING_FILE_MESSAGE)

  const buffer = await response.arrayBuffer()
  assertXlsxBytes(buffer)

  const { read, utils } = await import('xlsx')
  const workbook = read(buffer, { type: 'array' })

  const missing = REQUIRED_SHEETS.filter((sheet) => !workbook.SheetNames.includes(sheet))
  if (missing.length > 0) {
    throw new HrDatasetError(
      `HR dataset is missing required sheet(s): ${missing.join(', ')}.\nFound: ${workbook.SheetNames.join(', ')}.`,
    )
  }

  return Object.fromEntries(
    REQUIRED_SHEETS.map((sheet) => [
      sheet,
      utils.sheet_to_json<SheetRow>(workbook.Sheets[sheet], { defval: null, raw: true }),
    ]),
  ) as WorkbookSheets
}

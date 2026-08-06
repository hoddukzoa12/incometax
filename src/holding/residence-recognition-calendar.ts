const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_CONSTRUCTOR_BASE_YEAR = 0
const LAST_DAY_OF_PREVIOUS_MONTH = 0
const MONTHS_PER_YEAR = 12

const INVALID_DATE_MESSAGE =
  'Residence-recognition dates must be valid ISO calendar dates'
const INVALID_DATE_ORDER_MESSAGE =
  'Residence-recognition end dates must not precede their start dates'

const createUtcDate = (
  year: number,
  monthIndex: number,
  day: number,
): Date => {
  const date = new Date(
    Date.UTC(DATE_CONSTRUCTOR_BASE_YEAR, monthIndex, day),
  )
  date.setUTCFullYear(year)
  return date
}

export const parseRecognitionCalendarDate = (value: string): Date => {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    throw new RangeError(INVALID_DATE_MESSAGE)
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const day = Number(dayText)
  const date = createUtcDate(year, monthIndex, day)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(INVALID_DATE_MESSAGE)
  }

  return date
}

const getDaysInMonth = (year: number, monthIndex: number): number =>
  createUtcDate(
    year,
    monthIndex + 1,
    LAST_DAY_OF_PREVIOUS_MONTH,
  ).getUTCDate()

export const addRecognitionCalendarMonths = (
  date: Date,
  months: number,
): Date => {
  const absoluteMonth =
    date.getUTCFullYear() * MONTHS_PER_YEAR +
    date.getUTCMonth() +
    months
  const year = Math.floor(absoluteMonth / MONTHS_PER_YEAR)
  const monthIndex = absoluteMonth - year * MONTHS_PER_YEAR
  const day = Math.min(
    date.getUTCDate(),
    getDaysInMonth(year, monthIndex),
  )

  return createUtcDate(year, monthIndex, day)
}

const addCalendarYears = (date: Date, years: number): Date =>
  addRecognitionCalendarMonths(date, years * MONTHS_PER_YEAR)

export const elapsedRecognitionCalendarYears = (
  start: Date,
  end: Date,
): number => {
  if (end.getTime() < start.getTime()) {
    throw new RangeError(INVALID_DATE_ORDER_MESSAGE)
  }

  let completedYears = end.getUTCFullYear() - start.getUTCFullYear()
  let completedAnniversary = addCalendarYears(start, completedYears)
  if (completedAnniversary.getTime() > end.getTime()) {
    completedYears -= 1
    completedAnniversary = addCalendarYears(start, completedYears)
  }

  const nextAnniversary = addCalendarYears(start, completedYears + 1)
  const partialYear =
    (end.getTime() - completedAnniversary.getTime()) /
    (nextAnniversary.getTime() - completedAnniversary.getTime())

  return completedYears + partialYear
}

export const meetsMinimumRecognitionCalendarYears = (
  start: Date,
  end: Date,
  minimumYears: number,
): boolean =>
  end.getTime() >= start.getTime() &&
  elapsedRecognitionCalendarYears(start, end) >= minimumYears

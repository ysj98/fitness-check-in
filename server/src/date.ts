const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000

export function getChinaDayRange(date = new Date()) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS)
  const start = Date.UTC(
    chinaDate.getUTCFullYear(),
    chinaDate.getUTCMonth(),
    chinaDate.getUTCDate(),
  ) - CHINA_OFFSET_MS

  return {
    start: new Date(start),
    end: new Date(start + 24 * 60 * 60 * 1000),
  }
}

export function getChinaWeekRange(date = new Date()) {
  const dayRange = getChinaDayRange(date)
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS)
  const day = chinaDate.getUTCDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const start = dayRange.start.getTime() - daysFromMonday * 24 * 60 * 60 * 1000

  return {
    start: new Date(start),
    end: new Date(start + 7 * 24 * 60 * 60 * 1000),
  }
}

export function addChinaDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function getChinaMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) {
    throw new Error('month must be YYYY-MM')
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('month must be YYYY-MM')
  }

  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - CHINA_OFFSET_MS),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) - CHINA_OFFSET_MS),
  }
}

export function formatChinaDate(date: Date) {
  return new Date(date.getTime() + CHINA_OFFSET_MS).toISOString().slice(0, 10)
}

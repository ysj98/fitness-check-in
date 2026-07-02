import type { WeightUnit } from '@/utils/weight'
import { http } from '@/http/http'

export interface MonthlyReport {
  month: string
  checkin: {
    days: number
    count: number
    durationMinutes: number
    averageDurationMinutes: number
  }
  weight: {
    recordCount: number
    startWeightKg: number | null
    endWeightKg: number | null
    changeKg: number | null
    weightUnit: WeightUnit
  }
}

export function getMonthlyReport(month: string) {
  return http.get<MonthlyReport>('/api/reports/month', { month })
}

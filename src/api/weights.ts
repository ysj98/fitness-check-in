import type { IUserInfoRes } from './types/login'
import type { WeightUnit } from '@/utils/weight'
import { http } from '@/http/http'

export type { WeightUnit } from '@/utils/weight'
export { fromWeightKg, toWeightKg } from '@/utils/weight'
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export interface WeightRecord {
  id: number
  weightKg: number
  bmi: number | null
  measuredAt: string
}

export interface WeightListRes {
  items: WeightRecord[]
  total: number
  page: number
  pageSize: number
}

export interface WeightTrendPoint {
  date: string
  weightKg: number
  bmi: number | null
}

export interface WeightStatsRes {
  days: 7 | 30 | 90
  currentWeightKg: number | null
  previousWeightKg: number | null
  changeKg: number | null
  targetWeightKg: number | null
  distanceToTargetKg: number | null
  heightCm: number | null
  weightUnit: WeightUnit
  bmi: number | null
  bmiCategory: BmiCategory | null
  bmiLabel: string
  trend: WeightTrendPoint[]
}

export interface WeightRecordPayload {
  weightKg: number
  measuredAt: string
}

export interface WeightSettingsPayload {
  heightCm: number | null
  targetWeightKg: number | null
  weightUnit: WeightUnit
}

export function getWeights(page = 1, pageSize = 20) {
  return http.get<WeightListRes>('/api/weights', { page, pageSize })
}

export function getWeightStats(days: 7 | 30 | 90) {
  return http.get<WeightStatsRes>('/api/weights/stats', { days })
}

export function createWeight(payload: WeightRecordPayload) {
  return http.post<WeightRecord>('/api/weights', payload)
}

export function updateWeight(id: number, payload: WeightRecordPayload) {
  return http<WeightRecord>({
    url: `/api/weights/${id}`,
    method: 'PATCH' as UniApp.RequestOptions['method'],
    data: payload,
  })
}

export function deleteWeight(id: number) {
  return http.delete<{ id: number }>(`/api/weights/${id}`)
}

export function updateWeightSettings(payload: WeightSettingsPayload) {
  return http<IUserInfoRes>({
    url: '/api/user/weight-settings',
    method: 'PATCH' as UniApp.RequestOptions['method'],
    data: payload,
  })
}

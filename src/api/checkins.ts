import { http } from '@/http/http'

export interface CheckInRecord {
  id: number
  checkedAt: string
  isBackfill: boolean
  backfillReason: string
}

export interface TodayCheckInRes {
  count: number
  records: CheckInRecord[]
}

export interface MonthCheckInRes {
  month: string
  days: Record<string, number>
  backfillDays: Record<string, number>
  backfillUsed: number
  backfillLimit: number
}

export type BackfillReason = '忘记打卡' | '已运动未记录' | '其他'

export interface CheckInBadge {
  key: string
  name: string
  description: string
  unlocked: boolean
}

export interface CheckInStatsRes {
  currentStreak: number
  totalCount: number
  todayGoal: number
  todayCompleted: boolean
  badges: CheckInBadge[]
}

export function getTodayCheckIns() {
  return http.get<TodayCheckInRes>('/api/checkins/today')
}

export function createCheckIn() {
  return http.post<CheckInRecord>('/api/checkins', {})
}

export function createBackfillCheckIn(date: string, reason: BackfillReason) {
  return http.post<CheckInRecord>('/api/checkins/backfill', { date, reason })
}

export function getRecentCheckIns(limit = 20) {
  return http.get<CheckInRecord[]>('/api/checkins/recent', { limit })
}

export function getMonthCheckIns(month: string) {
  return http.get<MonthCheckInRes>('/api/checkins/month', { month })
}

export function getCheckInStats() {
  return http.get<CheckInStatsRes>('/api/checkins/stats')
}

export function deleteCheckIn(id: number) {
  return http.delete<{ id: number }>(`/api/checkins/${id}`)
}

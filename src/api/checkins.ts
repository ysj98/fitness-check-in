import { http } from '@/http/http'

export interface CheckInRecord {
  id: number
  checkedAt: string
}

export interface TodayCheckInRes {
  count: number
  records: CheckInRecord[]
}

export interface MonthCheckInRes {
  month: string
  days: Record<string, number>
}

export interface WeekDayStat {
  date: string
  count: number
}

export interface CheckInBadge {
  key: string
  name: string
  description: string
  unlocked: boolean
}

export interface CheckInStatsRes {
  weekStart: string
  weekEnd: string
  weekTotal: number
  activeDays: number
  currentStreak: number
  weekDays: WeekDayStat[]
  totalCount: number
  todayGoal: number
  todayCompleted: boolean
  badges: CheckInBadge[]
}

export function getTodayCheckIns() {
  return http.get<TodayCheckInRes>('/api/checkins/today')
}

export function createCheckIn() {
  return http.post<CheckInRecord>('/api/checkins')
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

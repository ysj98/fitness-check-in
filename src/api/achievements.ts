import { http } from '@/http/http'

export type AchievementCategory = 'checkin' | 'streak' | 'weight' | 'profile'
export type AchievementBadge = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
export type AchievementIcon = 'checkin' | 'streak' | 'weight' | 'profile'
export type AchievementMetricKey = 'totalCheckinCount' | 'currentStreak' | 'weightRecordCount' | 'profileCompleted'

export interface AchievementProgress {
  current: number
  displayCurrent: number
  target: number
  percent: number
}

export interface AchievementLevelProgress {
  key: string
  threshold: number
  title: string
  description: string
  badge: AchievementBadge
  completed: boolean
  isCurrent: boolean
  progress: AchievementProgress
}

export interface AchievementSeriesProgress {
  key: string
  category: AchievementCategory
  metricKey: AchievementMetricKey
  icon: AchievementIcon
  seriesName: string
  metricValue: number
  completedLevelCount: number
  totalLevelCount: number
  allCompleted: boolean
  currentLevel: AchievementLevelProgress
  levels: AchievementLevelProgress[]
}

export function getAchievements() {
  return http.get<AchievementSeriesProgress[]>('/api/achievements')
}

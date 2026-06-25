import { http } from '@/http/http'

export type AchievementCategory = 'checkin' | 'streak' | 'weight' | 'profile'
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type AchievementIcon = 'checkin' | 'streak' | 'target' | 'weight' | 'profile' | 'badge'
export type AchievementAccent = 'green' | 'blue' | 'orange' | 'pink' | 'gold'

export interface AchievementProgress {
  current: number
  target: number
  percent: number
}

export interface Achievement {
  key: string
  name: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  icon: AchievementIcon
  accent: AchievementAccent
  unlocked: boolean
  progress: AchievementProgress
}

export function getAchievements() {
  return http.get<Achievement[]>('/api/achievements')
}

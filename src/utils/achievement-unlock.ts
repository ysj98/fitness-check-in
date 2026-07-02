import type {
  AchievementCategory,
  AchievementIcon,
  AchievementLevelProgress,
  AchievementSeriesProgress,
} from '@/api/achievements'

export interface UnlockedAchievement {
  seriesKey: string
  levelKey: string
  seriesName: string
  category: AchievementCategory
  icon: AchievementIcon
  badge: AchievementLevelProgress['badge']
  title: string
  description: string
  completedLevelCount: number
  totalLevelCount: number
}

export function createAchievementLevelKey(seriesKey: string, levelKey: string) {
  return `${seriesKey}:${levelKey}`
}

export function getCompletedAchievementKeys(seriesList: AchievementSeriesProgress[]) {
  const keys = new Set<string>()

  seriesList.forEach((series) => {
    series.levels.forEach((level) => {
      if (level.completed) {
        keys.add(createAchievementLevelKey(series.key, level.key))
      }
    })
  })

  return keys
}

export function findNewUnlockedAchievements(
  previousKeys: Set<string>,
  seriesList: AchievementSeriesProgress[],
): UnlockedAchievement[] {
  return seriesList.flatMap((series) =>
    series.levels
      .filter((level) => level.completed && !previousKeys.has(createAchievementLevelKey(series.key, level.key)))
      .map((level) => ({
        seriesKey: series.key,
        levelKey: level.key,
        seriesName: series.seriesName,
        category: series.category,
        icon: series.icon,
        badge: level.badge,
        title: level.title,
        description: level.description,
        completedLevelCount: series.completedLevelCount,
        totalLevelCount: series.totalLevelCount,
      })),
  )
}

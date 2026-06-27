import type { AchievementCategory, AchievementSeriesProgress } from '@/api/achievements'

export const achievementCategories: { label: string; value: AchievementCategory }[] = [
  { label: '打卡', value: 'checkin' },
  { label: '连续', value: 'streak' },
  { label: '体重', value: 'weight' },
  { label: '资料', value: 'profile' },
]

export function getAchievementTotals(seriesList: AchievementSeriesProgress[]) {
  const completed = seriesList.reduce((total, item) => total + item.completedLevelCount, 0)
  const total = seriesList.reduce((sum, item) => sum + item.totalLevelCount, 0)
  return {
    completed,
    total,
    text: `${completed}/${total}`,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export function getAchievementCategoryOptions(seriesList: AchievementSeriesProgress[]) {
  return achievementCategories.map((category) => {
    const categorySeries = seriesList.filter((item) => item.category === category.value)
    const totals = getAchievementTotals(categorySeries)
    return {
      label: `${category.label} ${totals.completed}/${totals.total}`,
      value: category.value,
    }
  })
}

export function filterAchievementSeries(seriesList: AchievementSeriesProgress[], category: AchievementCategory) {
  return seriesList.filter((item) => item.category === category)
}

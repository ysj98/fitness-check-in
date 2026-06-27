import type { AchievementSeriesProgress } from '@/api/achievements'
import { describe, expect, it } from 'vitest'
import { filterAchievementSeries, getAchievementCategoryOptions, getAchievementTotals } from './achievement-progress'

function makeSeries(
  override: Partial<AchievementSeriesProgress> & Pick<AchievementSeriesProgress, 'key' | 'category'>,
): AchievementSeriesProgress {
  return {
    key: override.key,
    category: override.category,
    metricKey: 'totalCheckinCount',
    icon: 'checkin',
    seriesName: '累计打卡',
    metricValue: 0,
    completedLevelCount: 0,
    totalLevelCount: 1,
    allCompleted: false,
    currentLevel: {
      key: `${override.key}-1`,
      threshold: 1,
      title: '初次点亮',
      description: '完成第一次运动打卡',
      badge: 'BRONZE',
      completed: false,
      isCurrent: true,
      progress: { current: 0, displayCurrent: 0, target: 1, percent: 0 },
    },
    levels: [],
    ...override,
  }
}

describe('achievement progress helpers', () => {
  it('calculates total stage progress', () => {
    const totals = getAchievementTotals([
      makeSeries({ key: 'total-checkin', category: 'checkin', completedLevelCount: 3, totalLevelCount: 7 }),
      makeSeries({ key: 'profile-complete', category: 'profile', completedLevelCount: 1, totalLevelCount: 1 }),
    ])

    expect(totals).toEqual({ completed: 4, total: 8, text: '4/8', percent: 50 })
  })

  it('returns zero progress for empty data', () => {
    expect(getAchievementTotals([])).toEqual({ completed: 0, total: 0, text: '0/0', percent: 0 })
  })

  it('builds category labels from completed stages', () => {
    const options = getAchievementCategoryOptions([
      makeSeries({ key: 'total-checkin', category: 'checkin', completedLevelCount: 3, totalLevelCount: 7 }),
      makeSeries({ key: 'weight-record', category: 'weight', completedLevelCount: 2, totalLevelCount: 5 }),
    ])

    expect(options).toMatchObject([
      { label: '打卡 3/7', value: 'checkin' },
      { label: '连续 0/0', value: 'streak' },
      { label: '体重 2/5', value: 'weight' },
      { label: '资料 0/0', value: 'profile' },
    ])
  })

  it('filters series by category', () => {
    const seriesList = [
      makeSeries({ key: 'total-checkin', category: 'checkin' }),
      makeSeries({ key: 'current-streak', category: 'streak' }),
    ]

    expect(filterAchievementSeries(seriesList, 'streak')).toHaveLength(1)
    expect(filterAchievementSeries(seriesList, 'streak')[0]?.key).toBe('current-streak')
  })
})

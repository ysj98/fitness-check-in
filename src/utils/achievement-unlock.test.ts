import type { AchievementSeriesProgress } from '@/api/achievements'
import { describe, expect, it } from 'vitest'
import { findNewUnlockedAchievements, getCompletedAchievementKeys } from './achievement-unlock'

function makeSeries(levels: AchievementSeriesProgress['levels']): AchievementSeriesProgress {
  return {
    key: 'total-checkin',
    category: 'checkin',
    metricKey: 'totalCheckinCount',
    icon: 'checkin',
    seriesName: '累计打卡',
    metricValue: 10,
    completedLevelCount: levels.filter((level) => level.completed).length,
    totalLevelCount: levels.length,
    allCompleted: levels.every((level) => level.completed),
    currentLevel: levels[0],
    levels,
  }
}

function makeLevel(key: string, completed: boolean): AchievementSeriesProgress['levels'][number] {
  return {
    key,
    threshold: 1,
    title: key === 'first' ? '初次点亮' : '坚持十次',
    description: key === 'first' ? '完成第一次运动打卡' : '累计完成 10 次打卡',
    badge: key === 'first' ? 'BRONZE' : 'SILVER',
    completed,
    isCurrent: !completed,
    progress: { current: completed ? 1 : 0, displayCurrent: completed ? 1 : 0, target: 1, percent: completed ? 100 : 0 },
  }
}

describe('achievement unlock helpers', () => {
  it('collects completed level keys', () => {
    const keys = getCompletedAchievementKeys([makeSeries([makeLevel('first', true), makeLevel('ten', false)])])

    expect(keys.has('total-checkin:first')).toBe(true)
    expect(keys.has('total-checkin:ten')).toBe(false)
  })

  it('finds only newly completed levels', () => {
    const previousKeys = new Set(['total-checkin:first'])
    const unlocked = findNewUnlockedAchievements(previousKeys, [
      makeSeries([makeLevel('first', true), makeLevel('ten', true)]),
    ])

    expect(unlocked).toHaveLength(1)
    expect(unlocked[0]).toMatchObject({
      levelKey: 'ten',
      seriesName: '累计打卡',
      title: '坚持十次',
      badge: 'SILVER',
    })
  })
})

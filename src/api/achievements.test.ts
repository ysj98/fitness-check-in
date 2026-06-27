import { describe, expect, it, vi } from 'vitest'
import { getAchievements } from './achievements'

describe('achievements api', () => {
  it('requests the achievements endpoint', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      expect(options.url).toBe('/api/achievements')
      expect(options.method).toBe('GET')
      options.success?.({
        cookies: [],
        data: {
          code: 0,
          data: [
            {
              key: 'total-checkin',
              category: 'checkin',
              metricKey: 'totalCheckinCount',
              icon: 'checkin',
              seriesName: '累计打卡',
              metricValue: 0,
              completedLevelCount: 0,
              totalLevelCount: 7,
              allCompleted: false,
              currentLevel: {
                key: 'total-checkin-1',
                threshold: 1,
                title: '初次点亮',
                description: '完成第一次运动打卡',
                badge: 'BRONZE',
                completed: false,
                isCurrent: true,
                progress: { current: 0, displayCurrent: 0, target: 1, percent: 0 },
              },
              levels: [],
            },
          ],
          message: 'ok',
        },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(getAchievements()).resolves.toMatchObject([
      {
        key: 'total-checkin',
        currentLevel: {
          progress: { current: 0, displayCurrent: 0, target: 1, percent: 0 },
        },
      },
    ])
  })
})

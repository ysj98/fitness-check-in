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
              key: 'checkin_first',
              name: '初次点亮',
              description: '完成第一次运动打卡',
              category: 'checkin',
              tier: 'bronze',
              icon: 'checkin',
              accent: 'green',
              unlocked: false,
              progress: { current: 0, target: 1, percent: 0 },
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
        key: 'checkin_first',
        progress: { current: 0, target: 1, percent: 0 },
      },
    ])
  })
})

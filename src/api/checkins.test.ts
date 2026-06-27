import { describe, expect, it, vi } from 'vitest'
import { createBackfillCheckIn, createCheckIn } from './checkins'

describe('checkins api', () => {
  it('posts sport details when creating a check-in', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      expect(options.url).toBe('/api/checkins')
      expect(options.method).toBe('POST')
      expect(options.data).toEqual({ sportType: '跑步', durationMinutes: 45 })
      options.success?.({
        cookies: [],
        data: {
          code: 0,
          data: {
            id: 1,
            checkedAt: '2026-06-25T00:00:00.000Z',
            isBackfill: false,
            backfillReason: '',
            sportType: '跑步',
            durationMinutes: 45,
          },
          message: 'ok',
        },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(createCheckIn({ sportType: '跑步', durationMinutes: 45 })).resolves.toEqual({
      id: 1,
      checkedAt: '2026-06-25T00:00:00.000Z',
      isBackfill: false,
      backfillReason: '',
      sportType: '跑步',
      durationMinutes: 45,
    })
  })

  it('posts date and reason when creating a backfill check-in', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      expect(options.url).toBe('/api/checkins/backfill')
      expect(options.method).toBe('POST')
      expect(options.data).toEqual({
        date: '2026-06-26',
        reason: '忘记打卡',
        sportType: '游泳',
        durationMinutes: 60,
      })
      options.success?.({
        cookies: [],
        data: {
          code: 0,
          data: {
            id: 2,
            checkedAt: '2026-06-26T04:00:00.000Z',
            isBackfill: true,
            backfillReason: '忘记打卡',
            sportType: '游泳',
            durationMinutes: 60,
          },
          message: 'ok',
        },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(
      createBackfillCheckIn({
        date: '2026-06-26',
        reason: '忘记打卡',
        sportType: '游泳',
        durationMinutes: 60,
      }),
    ).resolves.toEqual({
      id: 2,
      checkedAt: '2026-06-26T04:00:00.000Z',
      isBackfill: true,
      backfillReason: '忘记打卡',
      sportType: '游泳',
      durationMinutes: 60,
    })
  })
})

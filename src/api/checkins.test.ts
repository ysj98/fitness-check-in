import { describe, expect, it, vi } from 'vitest'
import { createCheckIn } from './checkins'

describe('checkins api', () => {
  it('sends an empty object body when creating a check-in', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      expect(options.url).toBe('/api/checkins')
      expect(options.method).toBe('POST')
      expect(options.data).toEqual({})
      options.success?.({
        cookies: [],
        data: {
          code: 0,
          data: { id: 1, checkedAt: '2026-06-25T00:00:00.000Z' },
          message: 'ok',
        },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(createCheckIn()).resolves.toEqual({
      id: 1,
      checkedAt: '2026-06-25T00:00:00.000Z',
    })
  })
})

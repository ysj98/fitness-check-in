import { describe, expect, it, vi } from 'vitest'
import { getMonthlyReport } from './monthly-reports'

describe('monthly reports api', () => {
  it('requests the monthly report endpoint', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      expect(options.url).toBe('/api/reports/month')
      expect(options.method).toBe('GET')
      expect((options as UniApp.RequestOptions & { query?: Record<string, unknown> }).query).toEqual({
        month: '2026-06',
      })
      options.success?.({
        cookies: [],
        data: {
          code: 0,
          data: {
            month: '2026-06',
            checkin: {
              days: 8,
              count: 12,
              durationMinutes: 360,
              averageDurationMinutes: 45,
            },
            weight: {
              recordCount: 2,
              startWeightKg: 70,
              endWeightKg: 69.5,
              changeKg: -0.5,
              weightUnit: 'kg',
            },
          },
          message: 'ok',
        },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(getMonthlyReport('2026-06')).resolves.toMatchObject({
      month: '2026-06',
      checkin: { days: 8, durationMinutes: 360 },
      weight: { changeKg: -0.5 },
    })
  })
})

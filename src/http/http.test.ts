import type { IAuthLoginRes } from '@/api/types/login'
import { describe, expect, it, vi } from 'vitest'
import { useTokenStore } from '@/store/token'
import { http } from './http'

const loginResult: IAuthLoginRes = {
  token: 'jwt-token',
  expiresIn: 3600,
  user: {
    userId: 1,
    username: 'openid',
    nickname: '运动达人',
    avatar: '',
    avatarUrl: '',
    gender: '',
    birthday: '',
    goalPeriod: 'week',
    goalMode: 'count',
    goalCount: 4,
    goalDuration: 180,
    heightCm: null,
    targetWeightKg: null,
    weightUnit: 'kg',
  },
}

describe('http client', () => {
  it('unwraps a successful API response', async () => {
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      options.success?.({
        cookies: [],
        data: { code: 0, data: { value: 42 }, message: 'ok' },
        header: {},
        statusCode: 200,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(http<{ value: number }>({ url: '/api/test' })).resolves.toEqual({ value: 42 })
  })

  it('clears local authentication after a 401 response', async () => {
    const tokenStore = useTokenStore()
    tokenStore.setAuth(loginResult)
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      options.success?.({
        cookies: [],
        data: { code: 401, data: null, message: 'Unauthorized' },
        header: {},
        statusCode: 401,
      } as UniApp.RequestSuccessCallbackResult)
      return {} as UniApp.RequestTask
    })

    await expect(http({ url: '/api/protected' })).rejects.toThrow('Unauthorized')
    expect(tokenStore.hasLogin()).toBe(false)
  })
})

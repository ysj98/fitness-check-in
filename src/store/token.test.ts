import type { IAuthLoginRes } from '@/api/types/login'
import { getWxCode, wxLogin } from '@/api/login'
import { describe, expect, it, vi } from 'vitest'
import { useTokenStore } from './token'

vi.mock('@/api/login', () => ({
  getWxCode: vi.fn(),
  wxLogin: vi.fn(),
}))

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
    dailyGoal: 1,
    heightCm: null,
    targetWeightKg: null,
    weightUnit: 'kg',
  },
}

describe('token store', () => {
  it('stores a successful WeChat login', async () => {
    vi.mocked(getWxCode).mockResolvedValue('wx-code')
    vi.mocked(wxLogin).mockResolvedValue(loginResult)
    const store = useTokenStore()

    await store.wxLogin()

    expect(store.hasLogin()).toBe(true)
    expect(store.getValidToken()).toBe('jwt-token')
  })

  it('clears authentication state', () => {
    const store = useTokenStore()
    store.setAuth(loginResult)

    store.clearAuth()

    expect(store.hasLogin()).toBe(false)
    expect(store.getValidToken()).toBe('')
  })
})

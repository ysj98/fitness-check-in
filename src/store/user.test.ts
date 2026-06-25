import type { IUserInfoRes } from '@/api/types/login'
import { getUserInfo } from '@/api/login'
import { describe, expect, it, vi } from 'vitest'
import { useUserStore } from './user'

vi.mock('@/api/login', () => ({
  getUserInfo: vi.fn(),
}))

function createUser(overrides: Partial<IUserInfoRes> = {}): IUserInfoRes {
  return {
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
    ...overrides,
  }
}

describe('user store', () => {
  it('uses the default avatar initially', () => {
    const store = useUserStore()

    expect(store.userInfo.userId).toBe(-1)
    expect(store.userInfo.avatar).toBe('/static/images/default-avatar.png')
  })

  it('normalizes missing avatar and optional defaults', () => {
    const store = useUserStore()
    store.setUserInfo(createUser({ dailyGoal: 0 }))

    expect(store.userInfo.avatar).toBe('/static/images/default-avatar.png')
    expect(store.userInfo.dailyGoal).toBe(1)
    expect(store.userInfo.weightUnit).toBe('kg')
  })

  it('clears user data', () => {
    const store = useUserStore()
    store.setUserInfo(createUser({ userId: 8 }))

    store.clearUserInfo()

    expect(store.userInfo.userId).toBe(-1)
  })

  it('fetches and stores user data', async () => {
    const user = createUser({ userId: 42, nickname: 'API User' })
    vi.mocked(getUserInfo).mockResolvedValue(user)
    const store = useUserStore()

    await store.fetchUserInfo()

    expect(store.userInfo.userId).toBe(42)
    expect(store.userInfo.nickname).toBe('API User')
  })
})

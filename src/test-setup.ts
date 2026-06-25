import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const uniMock = {
  getMenuButtonBoundingClientRect: vi.fn().mockReturnValue({ top: 24, height: 32 }),
  getStorageSync: vi.fn().mockReturnValue(null),
  getSystemInfoSync: vi.fn().mockReturnValue({ platform: 'devtools' }),
  getWindowInfo: vi.fn().mockReturnValue({ statusBarHeight: 20 }),
  removeStorageSync: vi.fn(),
  request: vi.fn(),
  setStorageSync: vi.fn(),
  showToast: vi.fn(),
  vibrateShort: vi.fn(),
}

Object.defineProperty(globalThis, 'uni', {
  value: uniMock,
  writable: true,
  configurable: true,
})

Object.defineProperty(globalThis, 'getCurrentPages', {
  value: vi.fn().mockReturnValue([{ route: '/pages/index/index' }]),
  writable: true,
  configurable: true,
})

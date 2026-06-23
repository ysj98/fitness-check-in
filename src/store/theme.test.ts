import { describe, expect, it } from 'vitest'
import { useThemeStore } from './theme'

describe('useThemeStore', () => {
  it('defaults to light when the system theme is unavailable', () => {
    const store = useThemeStore()
    expect(store.mode).toBe('light')
    expect(store.isDark).toBe(false)
  })

  it('switches between light and dark modes', () => {
    const store = useThemeStore()
    store.setMode('dark')
    expect(store.mode).toBe('dark')
    expect(store.isDark).toBe(true)
    store.setMode('light')
    expect(store.mode).toBe('light')
  })
})

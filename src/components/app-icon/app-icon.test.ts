import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from './app-icon.vue'

describe('app icon', () => {
  it('maps fitness icon names to custom icon classes', () => {
    const wrapper = mount(AppIcon, {
      props: { name: 'checkin', accent: 'green', active: true, label: '打卡' },
    })

    expect(wrapper.html()).toContain('i-fit-checkin')
    expect(wrapper.classes()).toContain('active')
    expect(wrapper.attributes('aria-label')).toBe('打卡')
  })

  it('keeps explicit icon classes untouched', () => {
    const wrapper = mount(AppIcon, {
      props: { name: 'i-carbon-settings' },
    })

    expect(wrapper.html()).toContain('i-carbon-settings')
  })
})

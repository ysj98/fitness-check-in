import type { CustomTabBarItem } from './types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '@/components/app-icon/app-icon.vue'
import TabbarItem from './TabbarItem.vue'

const item: CustomTabBarItem = {
  text: '打卡',
  pagePath: 'pages/index/index',
  icon: 'checkin',
}

describe('tabbar item', () => {
  it('renders its label and custom fitness icon', () => {
    const wrapper = mount(TabbarItem, {
      props: { item },
      global: { components: { AppIcon } },
    })

    expect(wrapper.text()).toContain('打卡')
    expect(wrapper.html()).toContain('i-fit-checkin')
  })

  it('marks the icon as active when selected', () => {
    const wrapper = mount(TabbarItem, {
      props: { item, active: true },
      global: { components: { AppIcon } },
    })

    expect(wrapper.classes()).toContain('active')
    expect(wrapper.findComponent(AppIcon).props('active')).toBe(true)
  })
})

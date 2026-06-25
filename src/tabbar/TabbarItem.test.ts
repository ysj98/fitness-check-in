import type { CustomTabBarItem } from './types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TabbarItem from './TabbarItem.vue'

const item: CustomTabBarItem = {
  text: '打卡',
  pagePath: 'pages/index/index',
  icon: 'i-carbon-calendar',
}

describe('tabbar item', () => {
  it('renders its label and icon', () => {
    const wrapper = mount(TabbarItem, { props: { item } })

    expect(wrapper.text()).toContain('打卡')
    expect(wrapper.html()).toContain('i-carbon-calendar')
  })
})

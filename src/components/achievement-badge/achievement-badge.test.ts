import type { Achievement } from '@/api/achievements'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '@/components/app-icon/app-icon.vue'
import AchievementBadge from './achievement-badge.vue'

const achievement: Achievement = {
  key: 'checkin_first',
  name: '初次点亮',
  description: '完成第一次运动打卡',
  category: 'checkin',
  tier: 'bronze',
  icon: 'checkin',
  accent: 'green',
  unlocked: true,
  progress: { current: 1, target: 1, percent: 100 },
}

describe('achievement badge', () => {
  it('renders achievement copy and progress', () => {
    const wrapper = mount(AchievementBadge, {
      props: { achievement },
      global: {
        components: { AppIcon },
      },
    })

    expect(wrapper.text()).toContain('初次点亮')
    expect(wrapper.text()).toContain('1/1')
    expect(wrapper.classes()).toContain('unlocked')
    expect(wrapper.html()).toContain('width: 100%')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '@/components/app-icon/app-icon.vue'
import AchievementUnlockSheet from './achievement-unlock-sheet.vue'

describe('achievement unlock sheet', () => {
  it('renders unlocked achievement details and queue hint', () => {
    const wrapper = mount(AchievementUnlockSheet, {
      props: {
        achievement: {
          seriesKey: 'total-checkin',
          levelKey: 'total-checkin-10',
          seriesName: '累计打卡',
          category: 'checkin',
          icon: 'checkin',
          badge: 'SILVER',
          title: '坚持十次',
          description: '累计完成 10 次打卡',
          completedLevelCount: 2,
          totalLevelCount: 7,
        },
        remainingCount: 1,
      },
      global: {
        components: { AppIcon },
      },
    })

    expect(wrapper.text()).toContain('成就解锁')
    expect(wrapper.text()).toContain('坚持十次')
    expect(wrapper.text()).toContain('累计打卡')
    expect(wrapper.text()).toContain('已完成 2/7 阶段')
    expect(wrapper.text()).toContain('继续查看 · 1')
  })
})

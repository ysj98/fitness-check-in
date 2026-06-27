import type { AchievementSeriesProgress } from '@/api/achievements'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '@/components/app-icon/app-icon.vue'
import AchievementBadge from './achievement-badge.vue'

const series: AchievementSeriesProgress = {
  key: 'total-checkin',
  category: 'checkin',
  metricKey: 'totalCheckinCount',
  icon: 'checkin',
  seriesName: '累计打卡',
  metricValue: 30,
  completedLevelCount: 3,
  totalLevelCount: 7,
  allCompleted: false,
  currentLevel: {
    key: 'total-checkin-60',
    threshold: 60,
    title: '坚持进阶',
    description: '累计完成 60 次打卡',
    badge: 'PLATINUM',
    completed: false,
    isCurrent: true,
    progress: { current: 30, displayCurrent: 30, target: 60, percent: 50 },
  },
  levels: [],
}

describe('achievement badge', () => {
  it('renders current stage copy and clamped progress', () => {
    const wrapper = mount(AchievementBadge, {
      props: { series },
      global: {
        components: { AppIcon },
      },
    })

    expect(wrapper.text()).toContain('累计打卡')
    expect(wrapper.text()).toContain('坚持进阶')
    expect(wrapper.text()).toContain('30/60')
    expect(wrapper.text()).toContain('已完成 3/7 阶段')
    expect(wrapper.classes()).not.toContain('completed')
    expect(wrapper.html()).toContain('width: 50%')
  })
})

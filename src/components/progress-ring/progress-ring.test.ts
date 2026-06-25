import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProgressRing from './progress-ring.vue'

describe('progress ring', () => {
  it('clamps percent and renders the label', () => {
    const wrapper = mount(ProgressRing, {
      props: { percent: 130, label: '目标', accent: 'blue' },
    })

    expect(wrapper.text()).toContain('100%')
    expect(wrapper.text()).toContain('目标')
    expect(wrapper.classes()).toContain('accent-blue')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppSegmentedControl from './app-segmented-control.vue'

describe('app segmented control', () => {
  it('emits the selected value', async () => {
    const wrapper = mount(AppSegmentedControl, {
      props: {
        modelValue: 'light',
        options: [
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' },
        ],
      },
    })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['dark'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['dark'])
  })

  it('does not emit disabled options', async () => {
    const wrapper = mount(AppSegmentedControl, {
      props: {
        modelValue: 'weight',
        options: [
          { label: '体重', value: 'weight' },
          { label: 'BMI', value: 'bmi', disabled: true },
        ],
      },
    })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })
})

import type { Preset } from 'unocss'
import { presetUni } from '@uni-helper/unocss-preset-uni'
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUni({ attributify: false }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetLegacyCompat({
      commaStyleColorFunction: true,
      legacyColorSpace: true,
    }) as Preset,
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: [
    'i-carbon-add',
    'i-carbon-calendar',
    'i-carbon-chart-bar-target',
    'i-carbon-checkmark',
    'i-carbon-checkmark-filled',
    'i-carbon-chevron-left',
    'i-carbon-chevron-right',
    'i-carbon-edit',
    'i-carbon-gender-male',
    'i-carbon-moon',
    'i-carbon-ruler',
    'i-carbon-scale',
    'i-carbon-settings',
    'i-carbon-sun',
    'i-carbon-trash-can',
    'i-carbon-trophy',
    'i-carbon-trophy-filled',
    'i-carbon-user',
  ],
  rules: [
    ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
  ],
})

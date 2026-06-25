import type { Preset } from 'unocss'
import { presetUni } from '@uni-helper/unocss-preset-uni'
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import { defineConfig, presetIcons, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetUni({ attributify: false }),
    presetIcons({
      scale: 1.2,
      warn: true,
      collections: {
        fit: {
          checkin:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 3.25a.75.75 0 0 1 .75.75v1h7.5V4a.75.75 0 0 1 1.5 0v1H18a3.25 3.25 0 0 1 3.25 3.25V18A3.25 3.25 0 0 1 18 21.25H6A3.25 3.25 0 0 1 2.75 18V8.25A3.25 3.25 0 0 1 6 5h.75V4a.75.75 0 0 1 .75-.75ZM4.25 10v8A1.75 1.75 0 0 0 6 19.75h12A1.75 1.75 0 0 0 19.75 18v-8H4.25Zm10.78 3.03a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0l-1.75-1.75a.75.75 0 1 1 1.06-1.06l1.22 1.22l2.72-2.72a.75.75 0 0 1 1.06 0Z"/></svg>',
          weight:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.5 4.75A3.25 3.25 0 0 1 11.75 1.5h.5a3.25 3.25 0 0 1 3.25 3.25V6h1.08a3.25 3.25 0 0 1 3.21 2.73l1.42 8.75a4.25 4.25 0 0 1-4.2 4.92H6.99a4.25 4.25 0 0 1-4.2-4.92l1.42-8.75A3.25 3.25 0 0 1 7.42 6H8.5V4.75Zm1.5 0V6h4V4.75A1.75 1.75 0 0 0 12.25 3h-.5A1.75 1.75 0 0 0 10 4.75ZM12 9.25a4.25 4.25 0 0 0-4.25 4.25a.75.75 0 0 0 1.5 0a2.75 2.75 0 1 1 5.5 0a.75.75 0 0 0 1.5 0A4.25 4.25 0 0 0 12 9.25Z"/></svg>',
          profile:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.75a4.75 4.75 0 1 1 0 9.5a4.75 4.75 0 0 1 0-9.5Zm0 11.5c4.2 0 7.5 2.45 7.5 5.25c0 1.24-1 2.25-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5c0-2.8 3.3-5.25 7.5-5.25Z"/></svg>',
          streak:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.4 2.34a.75.75 0 0 1 .35.8c-.28 1.25-.1 2.34.48 3.23c.58.9 1.61 1.66 3.1 2.22a.75.75 0 0 1 .46.52c1.28 4.7-1.4 9.83-5.91 11.68a.75.75 0 0 1-.82-.17C7.8 17.35 7.28 12.7 9.63 9.1c.57-.87.8-1.82.6-2.84a.75.75 0 0 1 1.18-.74c1.37.98 2.23 2.25 2.55 3.77c.57-.86.8-1.77.67-2.74c-.17-1.24-.82-2.27-1.95-3.08a.75.75 0 0 1 .72-1.13Zm-1.15 10.2c-.86 1.1-1.22 2.2-1.07 3.28c.1.75.43 1.48.98 2.18c1.38-.84 2.2-2.38 2-3.93c-.61-.24-1.1-.58-1.48-1.02a3.7 3.7 0 0 1-.43-.51Z"/></svg>',
          target:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.75a9.25 9.25 0 1 1 0 18.5a9.25 9.25 0 0 1 0-18.5Zm0 3a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 0 0 0-12.5Zm0 3.25a3 3 0 1 1 0 6a3 3 0 0 1 0-6Z"/></svg>',
          badge:
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.02 2.08l2.87-.42l1.32 2.58l2.58 1.32l-.42 2.87L22.5 13l-2.08 2.02l.42 2.87l-2.58 1.32l-1.32 2.58l-2.87-.42L12 23.5l-2.02-2.08l-2.87.42l-1.32-2.58l-2.58-1.32l.42-2.87L1.5 13l2.08-2.02l-.42-2.87l2.58-1.32l1.32-2.58l2.87.42L12 2.5Zm3.4 7.1a.75.75 0 0 0-1.06 0l-3.36 3.36l-1.32-1.31a.75.75 0 0 0-1.06 1.06l1.85 1.84a.75.75 0 0 0 1.06 0l3.89-3.89a.75.75 0 0 0 0-1.06Z"/></svg>',
        },
      },
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetLegacyCompat({
      commaStyleColorFunction: true,
      legacyColorSpace: true,
    }) as Preset,
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
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
    'i-fit-badge',
    'i-fit-checkin',
    'i-fit-profile',
    'i-fit-streak',
    'i-fit-target',
    'i-fit-weight',
  ],
  rules: [['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }]],
})

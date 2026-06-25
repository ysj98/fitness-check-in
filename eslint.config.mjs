import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const autoImportGlobals = {
  computed: 'readonly',
  defineEmits: 'readonly',
  defineExpose: 'readonly',
  defineOptions: 'readonly',
  definePage: 'readonly',
  defineProps: 'readonly',
  nextTick: 'readonly',
  onLaunch: 'readonly',
  onLoad: 'readonly',
  onPullDownRefresh: 'readonly',
  onReachBottom: 'readonly',
  onReady: 'readonly',
  onShareAppMessage: 'readonly',
  onShow: 'readonly',
  reactive: 'readonly',
  ref: 'readonly',
  shallowRef: 'readonly',
  toRef: 'readonly',
  toRefs: 'readonly',
  watch: 'readonly',
  watchEffect: 'readonly',
}

const uniGlobals = {
  Component: 'readonly',
  Page: 'readonly',
  UniApp: 'readonly',
  WeixinJSBridge: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  uni: 'readonly',
  wx: 'readonly',
}

export default [
  {
    ignores: [
      '**/uni_modules/**',
      'dist/**',
      'node_modules/**',
      'auto-import.d.ts',
      'uni-pages.d.ts',
      'src/pages.json',
      'src/manifest.json',
      'src/components/qiun-*/**',
      'server/release/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
        ...autoImportGlobals,
        ...uniGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'no-undef': 'off',
      'vue/block-order': [
        'error',
        {
          order: [['script', 'template'], 'style'],
        },
      ],
      'vue/html-self-closing': [
        'error',
        {
          html: {
            component: 'always',
            normal: 'always',
            void: 'never',
          },
          math: 'always',
          svg: 'always',
        },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'uno.config.ts', 'server/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
]

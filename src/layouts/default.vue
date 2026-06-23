<script lang="ts" setup>
import { useThemeStore } from '@/store/theme'

const themeStore = useThemeStore()
</script>

<template>
  <view class="app-shell" :class="`theme-${themeStore.mode}`">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-shell {
  min-height: 100vh;
  color: var(--app-label-primary);
  background: var(--app-bg);
  transition:
    color var(--app-motion-normal) ease-out,
    background-color var(--app-motion-normal) ease-out;
}
</style>

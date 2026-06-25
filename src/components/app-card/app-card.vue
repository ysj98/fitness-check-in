<script lang="ts" setup>
withDefaults(defineProps<{
  accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold'
  elevated?: boolean
  interactive?: boolean
  showAccent?: boolean
}>(), {
  accent: 'green',
  elevated: false,
  interactive: false,
  showAccent: true,
})
</script>

<template>
  <view class="app-card" :class="[`accent-${accent}`, { elevated, interactive, 'no-accent': !showAccent }]">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-card {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
}

.app-card::before {
  position: absolute;
  top: 0;
  right: 30rpx;
  left: 30rpx;
  height: 4rpx;
  border-radius: 0 0 999rpx 999rpx;
  background: var(--accent, var(--app-green));
  opacity: 0.72;
  content: '';
}

.app-card.no-accent::before {
  display: none;
}

.elevated {
  box-shadow: var(--app-shadow-strong);
}

.interactive {
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out;
}

.interactive:active {
  opacity: 0.86;
  transform: scale(0.985);
}
</style>

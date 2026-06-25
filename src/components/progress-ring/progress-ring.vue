<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  percent: number
  label?: string
  accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold'
  size?: 'md' | 'lg'
}>(), {
  label: '完成度',
  accent: 'green',
  size: 'md',
})

const normalized = computed(() => Math.max(0, Math.min(100, props.percent)))
const ringStyle = computed(() => ({
  background: `conic-gradient(var(--accent) ${normalized.value}%, var(--app-fill) ${normalized.value}% 100%)`,
}))
</script>

<template>
  <view class="progress-ring" :class="[`accent-${accent}`, `size-${size}`]" :style="ringStyle">
    <view class="ring-inner">
      <text class="ring-value numeric">{{ normalized }}%</text>
      <text class="ring-label">{{ label }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.progress-ring {
  --accent: var(--app-green);
  flex: 0 0 auto;
  padding: 14rpx;
  border-radius: 50%;
  box-sizing: border-box;
  transition: background var(--app-motion-slow) var(--app-ease-out);
  animation: ring-enter var(--app-motion-slow) var(--app-ease-out) both;
}

.size-md {
  width: 174rpx;
  height: 174rpx;
}

.size-lg {
  width: 210rpx;
  height: 210rpx;
  padding: 16rpx;
}

.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--app-surface-solid);
}

.ring-value {
  color: var(--accent);
  font-size: 34rpx;
  font-weight: 820;
}

.size-lg .ring-value {
  font-size: 42rpx;
}

.ring-label {
  margin-top: 2rpx;
  color: var(--app-label-secondary);
  font-size: 20rpx;
}

@keyframes ring-enter {
  from {
    opacity: 0;
    transform: scale(0.86) rotate(-12deg);
  }

  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}
</style>

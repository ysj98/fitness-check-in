<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'purple' | 'red'
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  muted?: boolean
  label?: string
}>(), {
  accent: 'green',
  size: 'md',
  active: false,
  muted: false,
  label: '',
})

const iconClass = computed(() => props.name.startsWith('i-') ? props.name : `i-fit-${props.name}`)
</script>

<template>
  <view
    class="app-icon"
    :class="[`accent-${accent}`, `size-${size}`, { active, muted }]"
    :aria-label="label || name"
  >
    <text class="app-icon-glyph" :class="iconClass" />
  </view>
</template>

<style scoped lang="scss">
.app-icon {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255, 255, 255, 0.68);
  border-radius: 18rpx;
  color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.54);
  box-sizing: border-box;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out,
    background-color var(--app-motion-fast) ease-out;
}

.size-sm {
  width: 48rpx;
  height: 48rpx;
  border-radius: 14rpx;
}

.size-md {
  width: 60rpx;
  height: 60rpx;
}

.size-lg {
  width: 76rpx;
  height: 76rpx;
  border-radius: 22rpx;
}

.app-icon-glyph {
  font-size: 31rpx;
}

.size-sm .app-icon-glyph {
  font-size: 25rpx;
}

.size-lg .app-icon-glyph {
  font-size: 40rpx;
}

.active {
  color: #fff;
  background: var(--accent);
  box-shadow: 0 6rpx 16rpx var(--accent-shadow, rgba(32, 196, 107, 0.12));
}

.muted {
  opacity: 0.5;
  filter: grayscale(0.35);
}

.accent-green {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  --accent-shadow: rgba(32, 196, 107, 0.12);
}

.accent-blue {
  --accent: var(--app-blue);
  --accent-soft: var(--app-blue-soft);
  --accent-shadow: rgba(22, 136, 255, 0.12);
}

.accent-orange {
  --accent: var(--app-orange);
  --accent-soft: var(--app-orange-soft);
  --accent-shadow: rgba(255, 159, 28, 0.12);
}

.accent-pink {
  --accent: var(--app-pink);
  --accent-soft: var(--app-pink-soft);
  --accent-shadow: rgba(255, 77, 134, 0.11);
}

.accent-gold {
  --accent: var(--app-gold);
  --accent-soft: var(--app-gold-soft);
  --accent-shadow: rgba(217, 165, 32, 0.12);
}

.accent-purple {
  --accent: var(--app-purple);
  --accent-soft: var(--app-purple-soft);
}

.accent-red {
  --accent: var(--app-red);
  --accent-soft: rgba(255, 77, 79, 0.14);
}
</style>

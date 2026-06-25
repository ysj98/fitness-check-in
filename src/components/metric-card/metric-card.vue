<script lang="ts" setup>
withDefaults(
  defineProps<{
    label: string
    value: string | number
    note?: string
    icon?: string
    accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'red'
    mutedValue?: boolean
    noteEmphasis?: boolean
  }>(),
  {
    note: '',
    icon: '',
    accent: 'green',
    mutedValue: false,
    noteEmphasis: false,
  },
)
</script>

<template>
  <view class="metric-card" :class="[`accent-${accent}`, { 'muted-value': mutedValue }]">
    <app-icon v-if="icon" :name="icon" :accent="accent" size="sm" />
    <text class="metric-label">{{ label }}</text>
    <text class="metric-value numeric">{{ value }}</text>
    <text v-if="note" class="metric-note" :class="{ emphasis: noteEmphasis }">{{ note }}</text>
    <slot />
  </view>
</template>

<style scoped lang="scss">
.metric-card {
  --accent: var(--app-green);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  min-height: 170rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.68);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: 0 6rpx 18rpx rgba(31, 88, 58, 0.045);
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.accent-green {
  --accent: var(--app-green);
}

.accent-blue {
  --accent: var(--app-blue);
}

.accent-orange {
  --accent: var(--app-orange);
}

.accent-pink {
  --accent: var(--app-pink);
}

.accent-gold {
  --accent: var(--app-gold);
}

.accent-red {
  --accent: var(--app-red);
}

.metric-label,
.metric-note {
  color: var(--app-label-secondary);
}

.metric-label {
  margin-top: 10rpx;
  font-size: 22rpx;
  font-weight: 680;
}

.metric-value {
  margin-top: 8rpx;
  color: var(--accent);
  font-size: 38rpx;
  font-weight: 820;
  line-height: 1.1;
}

.muted-value .metric-value {
  color: var(--app-label-secondary);
  font-size: 32rpx;
}

.metric-note {
  margin-top: 6rpx;
  font-size: 20rpx;
}

.metric-note.emphasis {
  color: var(--accent);
  font-weight: 680;
}
</style>

<script lang="ts" setup>
import type { Achievement } from '@/api/achievements'

defineProps<{
  achievement: Achievement
  variant?: 'list' | 'tile'
}>()
</script>

<template>
  <view
    class="achievement-badge"
    :class="[
      `accent-${achievement.accent}`,
      `tier-${achievement.tier}`,
      variant || 'list',
      { unlocked: achievement.unlocked },
    ]"
  >
    <app-icon
      :name="achievement.icon"
      :accent="achievement.accent"
      :active="achievement.unlocked"
      :size="variant === 'tile' ? 'sm' : 'md'"
    />
    <view class="badge-copy">
      <view class="badge-head">
        <text class="badge-name">{{ achievement.name }}</text>
        <text class="badge-tier">{{ achievement.tier }}</text>
      </view>
      <text class="badge-desc">{{ achievement.description }}</text>
      <view class="progress-track">
        <view class="progress-bar" :style="{ width: `${achievement.progress.percent}%` }" />
      </view>
      <text class="badge-progress numeric"> {{ achievement.progress.current }}/{{ achievement.progress.target }} </text>
    </view>
    <text v-if="achievement.unlocked" class="badge-state i-fit-badge" />
  </view>
</template>

<style scoped lang="scss">
.achievement-badge {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 136rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.68);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
  box-sizing: border-box;
  overflow: hidden;
  opacity: 0.72;
}

.achievement-badge.tile {
  display: block;
  min-height: 198rpx;
  padding: 20rpx;
  box-shadow: 0 6rpx 18rpx rgba(31, 88, 58, 0.045);
}

.achievement-badge.unlocked {
  opacity: 1;
}

.achievement-badge.unlocked::after {
  position: absolute;
  top: -40rpx;
  bottom: -40rpx;
  width: 56rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
  content: '';
  animation: shimmer 2.4s ease-in-out infinite;
}

.badge-copy {
  flex: 1;
  min-width: 0;
}

.tile .badge-copy {
  margin-top: 14rpx;
}

.badge-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.tile .badge-head {
  display: block;
}

.badge-name {
  min-width: 0;
  color: var(--app-label-primary);
  font-size: 27rpx;
  font-weight: 760;
}

.tile .badge-name {
  display: block;
  min-height: 34rpx;
  font-size: 25rpx;
}

.badge-tier {
  flex: 0 0 auto;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 18rpx;
  font-weight: 800;
  text-transform: uppercase;
}

.tile .badge-tier {
  display: inline-block;
  margin-top: 6rpx;
  opacity: 0.74;
}

.badge-desc,
.badge-progress {
  color: var(--app-label-secondary);
}

.badge-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  line-height: 1.35;
}

.tile .badge-desc {
  margin-top: 5rpx;
  font-size: 19rpx;
}

.progress-track {
  height: 9rpx;
  margin-top: 12rpx;
  border-radius: 999rpx;
  background: var(--app-fill);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width var(--app-motion-slow) var(--app-ease-out);
}

.badge-progress {
  display: block;
  margin-top: 6rpx;
  font-size: 19rpx;
  text-align: right;
}

.badge-state {
  position: absolute;
  right: 20rpx;
  bottom: 18rpx;
  color: var(--accent);
  font-size: 28rpx;
}

.tile .badge-state {
  top: 24rpx;
  right: 24rpx;
  bottom: auto;
}
</style>

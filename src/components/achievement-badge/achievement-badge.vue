<script lang="ts" setup>
import type { AchievementBadge, AchievementCategory, AchievementSeriesProgress } from '@/api/achievements'
import { computed } from 'vue'

const props = defineProps<{
  series: AchievementSeriesProgress
}>()

defineEmits<{
  select: [series: AchievementSeriesProgress]
}>()

type CardAccent = 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'purple'

const categoryAccentMap: Record<AchievementCategory, CardAccent> = {
  checkin: 'green',
  streak: 'orange',
  weight: 'blue',
  profile: 'pink',
}

const badgeAccentMap: Record<AchievementBadge, CardAccent> = {
  BRONZE: 'orange',
  SILVER: 'blue',
  GOLD: 'gold',
  PLATINUM: 'purple',
  DIAMOND: 'blue',
}

const categoryAccent = computed(() => categoryAccentMap[props.series.category])
const badgeAccent = computed(() => badgeAccentMap[props.series.currentLevel.badge])
const statusText = computed(() =>
  props.series.allCompleted
    ? '全部阶段已完成'
    : `冲刺第 ${props.series.completedLevelCount + 1}/${props.series.totalLevelCount} 阶段`,
)
</script>

<template>
  <view
    class="achievement-series-card"
    :class="[`accent-${categoryAccent}`, `badge-${badgeAccent}`, { completed: series.allCompleted }]"
    @click="$emit('select', series)"
  >
    <view class="series-head">
      <app-icon :name="series.icon" :accent="categoryAccent" :active="series.allCompleted" size="md" />
      <view class="series-title-wrap">
        <text class="series-name">{{ series.seriesName }}</text>
        <text class="series-status">{{ statusText }}</text>
      </view>
      <text class="series-chevron i-carbon-chevron-right" />
    </view>

    <view class="level-body">
      <view class="level-head">
        <text class="level-title">{{ series.currentLevel.title }}</text>
        <text class="level-badge">{{ series.currentLevel.badge }}</text>
      </view>
      <text class="level-desc">{{ series.currentLevel.description }}</text>
      <view class="progress-track">
        <view class="progress-bar" :style="{ width: `${series.currentLevel.progress.percent}%` }" />
      </view>
      <view class="progress-meta">
        <text class="progress-count numeric">
          {{ series.currentLevel.progress.displayCurrent }}/{{ series.currentLevel.progress.target }}
        </text>
        <text class="stage-count numeric">
          已完成 {{ series.completedLevelCount }}/{{ series.totalLevelCount }} 阶段
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.achievement-series-card {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  --badge-accent: var(--app-green);
  --badge-soft: var(--app-green-soft);
  position: relative;
  display: block;
  min-height: 220rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.68);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
  box-sizing: border-box;
  overflow: hidden;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out;
}

.achievement-series-card:active {
  opacity: 0.86;
  transform: scale(0.985);
}

.achievement-series-card.completed::after {
  position: absolute;
  top: -50rpx;
  bottom: -50rpx;
  width: 58rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.26), transparent);
  content: '';
  animation: shimmer 2.6s ease-in-out infinite;
}

.series-head,
.level-head,
.progress-meta {
  display: flex;
  align-items: center;
}

.series-head {
  gap: 18rpx;
}

.series-title-wrap {
  flex: 1;
  min-width: 0;
}

.series-name,
.series-status,
.level-title,
.level-desc {
  display: block;
}

.series-name {
  color: var(--app-label-primary);
  font-size: 29rpx;
  font-weight: 780;
}

.series-status {
  margin-top: 5rpx;
  color: var(--accent);
  font-size: 21rpx;
  font-weight: 680;
}

.series-chevron {
  flex: 0 0 auto;
  color: var(--app-label-tertiary);
  font-size: 28rpx;
}

.level-body {
  margin-top: 22rpx;
}

.level-head {
  justify-content: space-between;
  gap: 14rpx;
}

.level-title {
  min-width: 0;
  color: var(--app-label-primary);
  font-size: 27rpx;
  font-weight: 760;
}

.level-badge {
  flex: 0 0 auto;
  padding: 5rpx 13rpx;
  border-radius: 999rpx;
  color: var(--badge-accent);
  background: var(--badge-soft);
  font-size: 18rpx;
  font-weight: 820;
}

.level-desc {
  margin-top: 8rpx;
  color: var(--app-label-secondary);
  font-size: 22rpx;
  line-height: 1.36;
}

.progress-track {
  height: 10rpx;
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: var(--app-fill);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--badge-accent);
  transition: width var(--app-motion-slow) var(--app-ease-out);
}

.progress-meta {
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 10rpx;
  color: var(--app-label-secondary);
  font-size: 20rpx;
}

.progress-count {
  color: var(--badge-accent);
  font-weight: 760;
}

.stage-count {
  color: var(--app-label-tertiary);
}

.accent-green {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
}

.accent-blue {
  --accent: var(--app-blue);
  --accent-soft: var(--app-blue-soft);
}

.accent-orange {
  --accent: var(--app-orange);
  --accent-soft: var(--app-orange-soft);
}

.accent-pink {
  --accent: var(--app-pink);
  --accent-soft: var(--app-pink-soft);
}

.badge-orange {
  --badge-accent: var(--app-orange);
  --badge-soft: var(--app-orange-soft);
}

.badge-blue {
  --badge-accent: var(--app-blue);
  --badge-soft: var(--app-blue-soft);
}

.badge-gold {
  --badge-accent: var(--app-gold);
  --badge-soft: var(--app-gold-soft);
}

.badge-purple {
  --badge-accent: var(--app-purple);
  --badge-soft: var(--app-purple-soft);
}
</style>

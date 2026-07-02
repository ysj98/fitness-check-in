<script lang="ts" setup>
import type { AchievementBadge, AchievementCategory } from '@/api/achievements'
import type { UnlockedAchievement } from '@/utils/achievement-unlock'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    achievement: UnlockedAchievement
    remainingCount?: number
  }>(),
  {
    remainingCount: 0,
  },
)

defineEmits<{
  close: []
}>()

type AchievementAccent = 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'purple'

const categoryAccentMap: Record<AchievementCategory, AchievementAccent> = {
  checkin: 'green',
  streak: 'orange',
  weight: 'blue',
  profile: 'pink',
}

const badgeAccentMap: Record<AchievementBadge, AchievementAccent> = {
  BRONZE: 'orange',
  SILVER: 'blue',
  GOLD: 'gold',
  PLATINUM: 'purple',
  DIAMOND: 'blue',
}

const categoryAccent = computed(() => categoryAccentMap[props.achievement.category])
const badgeAccent = computed(() => badgeAccentMap[props.achievement.badge])
const stageText = computed(
  () => `已完成 ${props.achievement.completedLevelCount}/${props.achievement.totalLevelCount} 阶段`,
)
const nextButtonText = computed(() => (props.remainingCount > 0 ? `继续查看 · ${props.remainingCount}` : '继续打卡'))
</script>

<template>
  <view class="achievement-unlock-mask" @click.self="$emit('close')">
    <view class="achievement-unlock-card" :class="[`accent-${categoryAccent}`, `badge-${badgeAccent}`]">
      <view class="unlock-aura" />
      <view class="unlock-badge-shell">
        <view class="unlock-ring" />
        <app-icon :name="achievement.icon" :accent="badgeAccent" size="lg" active label="新成就解锁" />
      </view>

      <text class="unlock-kicker">成就解锁</text>
      <text class="unlock-title">{{ achievement.title }}</text>
      <text class="unlock-desc">{{ achievement.description }}</text>

      <view class="unlock-meta">
        <view class="unlock-meta-item">
          <text class="meta-label">系列</text>
          <text class="meta-value">{{ achievement.seriesName }}</text>
        </view>
        <view class="unlock-meta-divider" />
        <view class="unlock-meta-item">
          <text class="meta-label">进度</text>
          <text class="meta-value numeric">{{ stageText }}</text>
        </view>
      </view>

      <button class="unlock-action" hover-class="unlock-action-pressed" @click.stop="$emit('close')">
        {{ nextButtonText }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.achievement-unlock-mask {
  position: fixed;
  inset: 0;
  z-index: 50000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx var(--app-gutter) calc(48rpx + env(safe-area-inset-bottom));
  background: rgba(8, 22, 16, 0.38);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-sizing: border-box;
  animation: unlock-mask-enter var(--app-motion-normal) ease-out both;
}

.achievement-unlock-card {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  --badge-accent: var(--app-green);
  --badge-soft: var(--app-green-soft);
  position: relative;
  width: 100%;
  max-width: 620rpx;
  padding: 42rpx 34rpx 32rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  border-radius: 36rpx;
  color: var(--app-label-primary);
  background:
    radial-gradient(circle at 50% 0%, var(--badge-soft), transparent 42%),
    var(--app-surface-solid);
  box-shadow: 0 28rpx 86rpx rgba(10, 54, 32, 0.24);
  box-sizing: border-box;
  overflow: hidden;
  animation: unlock-card-enter 360ms var(--app-ease-spring) both;
}

.unlock-aura {
  position: absolute;
  top: -170rpx;
  left: 50%;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: var(--badge-soft);
  opacity: 0.86;
  transform: translateX(-50%);
}

.unlock-badge-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  margin: 0 auto 22rpx;
}

.unlock-ring {
  position: absolute;
  inset: 0;
  border: 2rpx solid var(--badge-accent);
  border-radius: 50%;
  opacity: 0.16;
  animation: unlock-ring-pulse 1.5s ease-out infinite;
}

.unlock-badge-shell :deep(.app-icon) {
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  box-shadow: 0 16rpx 34rpx rgba(31, 88, 58, 0.16);
}

.unlock-kicker,
.unlock-title,
.unlock-desc,
.meta-label,
.meta-value {
  position: relative;
  display: block;
  text-align: center;
}

.unlock-kicker {
  color: var(--badge-accent);
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.unlock-title {
  margin-top: 8rpx;
  color: var(--app-label-primary);
  font-size: 40rpx;
  font-weight: 860;
  line-height: 1.18;
}

.unlock-desc {
  margin: 14rpx auto 0;
  max-width: 460rpx;
  color: var(--app-label-secondary);
  font-size: 25rpx;
  font-weight: 620;
  line-height: 1.42;
}

.unlock-meta {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1rpx minmax(0, 1fr);
  align-items: center;
  gap: 18rpx;
  margin-top: 28rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: var(--app-fill);
}

.unlock-meta-divider {
  width: 1rpx;
  height: 54rpx;
  background: var(--app-separator);
}

.meta-label {
  color: var(--app-label-tertiary);
  font-size: 20rpx;
  font-weight: 700;
}

.meta-value {
  margin-top: 6rpx;
  color: var(--app-label-primary);
  font-size: 23rpx;
  font-weight: 800;
  line-height: 1.24;
}

.unlock-action {
  position: relative;
  width: 100%;
  height: 88rpx;
  margin-top: 28rpx;
  border-radius: 999rpx;
  color: #fff;
  background: linear-gradient(135deg, var(--badge-accent), var(--accent));
  box-shadow: 0 16rpx 32rpx rgba(31, 178, 104, 0.22);
  font-size: 28rpx;
  font-weight: 820;
  line-height: 88rpx;
}

.unlock-action-pressed {
  opacity: 0.9;
  transform: scale(0.975);
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

@keyframes unlock-mask-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes unlock-card-enter {
  from {
    opacity: 0;
    transform: translateY(34rpx) scale(0.92);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes unlock-ring-pulse {
  from {
    opacity: 0.32;
    transform: scale(0.82);
  }

  to {
    opacity: 0;
    transform: scale(1.18);
  }
}
</style>

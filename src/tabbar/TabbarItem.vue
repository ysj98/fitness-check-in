<script setup lang="ts">
import type { CustomTabBarItem } from './types'

defineProps<{
  item: CustomTabBarItem
  active?: boolean
}>()
</script>

<template>
  <view class="tab-item" :class="{ active }">
    <view class="icon-wrap">
      <view class="tab-icon" :class="item.icon" />
    </view>
    <view class="tab-label">
      {{ item.text }}
    </view>
  </view>
</template>

<style scoped lang="scss">
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
}

.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70rpx;
  height: 42rpx;
  border-radius: 999rpx;
  transition:
    background-color var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) var(--app-ease-out);
}

.active .icon-wrap {
  background: var(--app-green-soft);
}

.tab-icon {
  font-size: 42rpx;
}

.tab-label {
  margin-top: 3rpx;
  font-size: 20rpx;
  font-weight: 560;
  line-height: 1.15;
}

.active .tab-label {
  font-weight: 700;
}
</style>

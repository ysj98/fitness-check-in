<script setup lang="ts">
import type { CustomTabBarItem } from './types'

defineProps<{
  item: CustomTabBarItem
  active?: boolean
}>()
</script>

<template>
  <view class="tab-item" :class="{ active }">
    <app-icon class="tab-icon" :name="item.icon" accent="green" size="sm" :active="active" :label="item.text" />
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

.tab-icon {
  transition: transform var(--app-motion-fast) var(--app-ease-spring);
}

.tab-label {
  margin-top: 7rpx;
  font-size: 20rpx;
  font-weight: 560;
  line-height: 1.15;
}

.active .tab-label {
  font-weight: 760;
}

.active .tab-icon {
  transform: translateY(-3rpx);
}
</style>

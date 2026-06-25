<script setup lang="ts">
import { tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'
import { useThemeStore } from '@/store/theme'

defineOptions({
  virtualHost: true,
})

const themeStore = useThemeStore()

function handleClick(index: number) {
  if (index === tabbarStore.curIdx.value && tabbarStore.isCurrentRouteTabbarItem(index)) {
    return
  }

  const item = tabbarList.value[index]
  if (!item) {
    return
  }

  const previousIndex = tabbarStore.curIdx.value
  tabbarStore.setCurIdx(index)
  uni.switchTab({
    url: item.pagePath,
    success: () => tabbarStore.syncCurIdxByCurrentPageAsync(),
    fail: () => tabbarStore.setCurIdx(previousIndex),
  })
}

function getColor(index: number) {
  if (tabbarStore.curIdx.value === index) {
    return themeStore.isDark ? '#30d158' : '#34c759'
  }
  return themeStore.isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.62)'
}
</script>

<template>
  <view class="tabbar-shell" :class="`theme-${themeStore.mode}`">
    <view class="tabbar-fixed" @touchmove.stop.prevent>
      <view class="tabbar-content">
        <view
          v-for="(item, index) in tabbarList"
          :key="item.pagePath"
          class="tabbar-target"
          :class="{ active: tabbarStore.curIdx.value === index }"
          :style="{ color: getColor(index) }"
          @click="handleClick(index)"
        >
          <TabbarItem :item="item" :active="tabbarStore.curIdx.value === index" />
        </view>
      </view>
      <view class="safe-bottom" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-fixed {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  border-top: 1rpx solid rgba(60, 60, 67, 0.12);
  background: rgba(250, 250, 252, 0.88);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 -10rpx 34rpx rgba(0, 0, 0, 0.045);
  box-sizing: border-box;
}

.theme-dark .tabbar-fixed {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: rgba(24, 24, 26, 0.88);
  box-shadow: 0 -10rpx 34rpx rgba(0, 0, 0, 0.28);
}

.tabbar-content {
  display: flex;
  align-items: center;
  height: 112rpx;
  padding: 4rpx 28rpx 0;
  box-sizing: border-box;
}

.tabbar-target {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 96rpx;
  transition:
    color var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) ease-out;
}

.tabbar-target:active {
  transform: scale(0.95);
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>

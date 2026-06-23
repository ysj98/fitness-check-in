<script lang="ts" setup>
defineProps<{
  title: string
  subtitle?: string
}>()

const topInset = ref(0)
const capsuleBarHeight = ref(44)

onMounted(() => {
  try {
    const windowInfo = uni.getWindowInfo()
    topInset.value = windowInfo.statusBarHeight || 0

    // #ifdef MP-WEIXIN
    const capsule = uni.getMenuButtonBoundingClientRect()
    capsuleBarHeight.value = capsule.height + Math.max((capsule.top - topInset.value) * 2, 8)
    // #endif
  }
  catch {
    topInset.value = 0
    capsuleBarHeight.value = 44
  }
})
</script>

<template>
  <view class="ios-header" :style="{ paddingTop: `${topInset}px` }">
    <view class="capsule-space" :style="{ height: `${capsuleBarHeight}px` }" />
    <view class="title-block">
      <text v-if="subtitle" class="header-subtitle">
        {{ subtitle }}
      </text>
      <text class="header-title">
        {{ title }}
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.ios-header {
  box-sizing: border-box;
  color: var(--app-label-primary);
  background: var(--app-bg);
}

.title-block {
  padding: 8rpx var(--app-gutter) 20rpx;
}

.header-subtitle,
.header-title {
  display: block;
}

.header-subtitle {
  margin-bottom: 6rpx;
  color: var(--app-label-secondary);
  font-size: 24rpx;
  font-weight: 500;
}

.header-title {
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1.12;
}
</style>

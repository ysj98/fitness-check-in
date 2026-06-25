<script lang="ts" setup>
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold'
  }>(),
  {
    subtitle: '',
    accent: 'green',
  },
)

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
  } catch {
    topInset.value = 0
    capsuleBarHeight.value = 44
  }
})
</script>

<template>
  <view class="ios-header" :class="`accent-${accent}`" :style="{ paddingTop: `${topInset}px` }">
    <view class="capsule-space" :style="{ height: `${capsuleBarHeight}px` }" />
    <view class="title-block">
      <view class="title-mark" />
      <view class="title-copy">
        <text class="header-title">
          {{ title }}
        </text>
        <text v-if="subtitle" class="header-subtitle">
          {{ subtitle }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.ios-header {
  --accent: var(--app-green);
  box-sizing: border-box;
  color: var(--app-label-primary);
  background: transparent;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 10rpx var(--app-gutter) 28rpx;
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.title-mark {
  width: 12rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, var(--accent), transparent);
  box-shadow: 0 10rpx 30rpx var(--app-fill-strong);
}

.title-copy {
  min-width: 0;
}

.header-subtitle,
.header-title {
  display: block;
}

.header-subtitle {
  margin-top: 8rpx;
  color: var(--app-label-secondary);
  font-size: 25rpx;
  font-weight: 560;
  line-height: 1.4;
}

.header-title {
  font-size: 64rpx;
  font-weight: 840;
  line-height: 1.08;
}
</style>

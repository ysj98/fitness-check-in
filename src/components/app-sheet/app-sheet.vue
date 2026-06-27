<script lang="ts" setup>
withDefaults(
  defineProps<{
    title: string
    saving?: boolean
    saveText?: string
    closeText?: string
    showSave?: boolean
  }>(),
  {
    saving: false,
    saveText: '保存',
    closeText: '取消',
    showSave: true,
  },
)

defineEmits<{
  close: []
  save: []
}>()
</script>

<template>
  <view class="modal-mask" @click.self="$emit('close')">
    <view class="app-sheet" @click.stop>
      <view class="sheet-grabber" />
      <view class="sheet-head">
        <button class="toolbar-button" @click.stop="$emit('close')">{{ closeText }}</button>
        <text class="sheet-title">{{ title }}</text>
        <button v-if="showSave" class="toolbar-button primary" :disabled="saving" @click.stop="$emit('save')">
          {{ saving ? '保存中' : saveText }}
        </button>
        <view v-else class="toolbar-spacer" />
      </view>
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 30000;
  display: flex;
  align-items: flex-end;
  background: var(--app-mask);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: mask-enter var(--app-motion-normal) ease-out both;
}

.app-sheet {
  width: 100%;
  max-height: 88vh;
  padding: 14rpx 28rpx calc(160rpx + env(safe-area-inset-bottom));
  border-radius: 32rpx 32rpx 0 0;
  color: var(--app-label-primary);
  background: var(--app-surface-secondary);
  box-shadow: 0 -24rpx 60rpx rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  animation: sheet-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.sheet-grabber {
  width: 78rpx;
  height: 10rpx;
  margin: 0 auto 12rpx;
  border-radius: 999rpx;
  background: var(--app-fill-strong);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
}

.sheet-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 760;
  text-align: center;
}

.toolbar-button {
  min-width: 112rpx;
  height: 64rpx;
  padding: 0 8rpx;
  color: var(--app-blue);
  background: transparent;
  font-size: 27rpx;
  line-height: 64rpx;
}

.toolbar-spacer {
  min-width: 112rpx;
  height: 64rpx;
}

.toolbar-button:first-child {
  text-align: left;
}

.toolbar-button.primary {
  font-weight: 700;
  text-align: right;
}

.toolbar-button[disabled] {
  color: var(--app-label-tertiary);
}

@keyframes mask-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes sheet-enter {
  from {
    opacity: 0;
    transform: translateY(60rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

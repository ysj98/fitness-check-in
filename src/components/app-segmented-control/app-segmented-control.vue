<script lang="ts" setup generic="T extends string | number">
defineProps<{
  modelValue: T
  options: { label: string, value: T, disabled?: boolean }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
  'change': [value: T]
}>()

function select(value: T, disabled?: boolean) {
  if (disabled) {
    return
  }
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <view class="segmented-control">
    <button
      v-for="option in options"
      :key="String(option.value)"
      class="segment-button"
      :class="{ active: option.value === modelValue, disabled: option.disabled }"
      :disabled="option.disabled"
      @click="select(option.value, option.disabled)"
    >
      {{ option.label }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.segmented-control {
  display: flex;
  gap: 4rpx;
  padding: 5rpx;
  border: 1rpx solid var(--app-separator);
  border-radius: 18rpx;
  background: var(--app-fill);
  box-sizing: border-box;
}

.segment-button {
  flex: 1;
  min-width: 0;
  height: 58rpx;
  padding: 0 18rpx;
  border-radius: 14rpx;
  color: var(--app-label-secondary);
  background: transparent;
  font-size: 23rpx;
  font-weight: 650;
  line-height: 58rpx;
  transition:
    color var(--app-motion-fast) ease-out,
    background-color var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) var(--app-ease-out);
}

.segment-button.active {
  color: var(--app-label-primary);
  background: var(--app-surface-solid);
  box-shadow: 0 6rpx 16rpx rgba(31, 88, 58, 0.1);
}

.segment-button:active {
  transform: scale(0.96);
}

.segment-button.disabled {
  opacity: 0.42;
}
</style>

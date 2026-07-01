<script lang="ts" setup generic="T extends string | number">
defineProps<{
  modelValue: T
  options: { label: string; value: T; disabled?: boolean }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
  change: [value: T]
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
  <view class="segmented-control segment-control">
    <button
      v-for="option in options"
      :key="String(option.value)"
      class="segment-button segment-item"
      :class="{ active: option.value === modelValue, disabled: option.disabled }"
      :disabled="option.disabled"
      hover-class="segment-item-pressed"
      @click="select(option.value, option.disabled)"
    >
      {{ option.label }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.segmented-control {
  width: 100%;
}

.segment-button {
  box-shadow: none;
}
</style>

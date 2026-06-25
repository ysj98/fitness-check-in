<script lang="ts" setup>
withDefaults(defineProps<{
  icon?: string
  accent?: 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'red'
  variant?: 'solid' | 'soft' | 'ghost'
  loading?: boolean
  disabled?: boolean
}>(), {
  icon: '',
  accent: 'green',
  variant: 'solid',
  loading: false,
  disabled: false,
})

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="app-button"
    :class="[`accent-${accent}`, `variant-${variant}`, { loading }]"
    :disabled="disabled || loading"
    hover-class="app-button-pressed"
    @click="$emit('click')"
  >
    <app-icon v-if="icon" :name="icon" :accent="accent === 'red' ? 'pink' : accent" size="sm" :active="variant === 'solid'" />
    <text class="button-label">
      <slot />
    </text>
  </button>
</template>

<style scoped lang="scss">
.app-button {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  --accent-deep: var(--app-green-deep);
  --accent-shadow: rgba(32, 196, 107, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 12rpx;
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: var(--app-control-radius);
  font-size: 28rpx;
  font-weight: 760;
  line-height: 88rpx;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out,
    box-shadow var(--app-motion-fast) ease-out;
}

.variant-solid {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-deep));
  box-shadow:
    0 10rpx 0 var(--accent-deep),
    0 18rpx 34rpx var(--accent-shadow);
}

.variant-soft {
  color: var(--accent);
  background: var(--accent-soft);
}

.variant-ghost {
  color: var(--accent);
  background: transparent;
}

.app-button-pressed,
.loading {
  opacity: 0.84;
  transform: translateY(6rpx) scale(0.99);
  box-shadow: 0 4rpx 0 var(--accent-deep);
}

.app-button[disabled] {
  opacity: 0.48;
}

.button-label {
  min-width: 0;
}

.accent-green {
  --accent: var(--app-green);
  --accent-soft: var(--app-green-soft);
  --accent-deep: var(--app-green-deep);
  --accent-shadow: rgba(32, 196, 107, 0.22);
}

.accent-blue {
  --accent: var(--app-blue);
  --accent-soft: var(--app-blue-soft);
  --accent-deep: var(--app-blue-deep);
  --accent-shadow: rgba(22, 136, 255, 0.22);
}

.accent-orange {
  --accent: var(--app-orange);
  --accent-soft: var(--app-orange-soft);
  --accent-deep: #c66d00;
  --accent-shadow: rgba(255, 159, 28, 0.24);
}

.accent-pink {
  --accent: var(--app-pink);
  --accent-soft: var(--app-pink-soft);
  --accent-deep: #cb2d61;
  --accent-shadow: rgba(255, 77, 134, 0.22);
}

.accent-gold {
  --accent: var(--app-gold);
  --accent-soft: var(--app-gold-soft);
  --accent-deep: #a97800;
  --accent-shadow: rgba(217, 165, 32, 0.25);
}

.accent-red {
  --accent: var(--app-red);
  --accent-soft: rgba(255, 77, 79, 0.14);
  --accent-deep: #c93a3c;
  --accent-shadow: rgba(255, 77, 79, 0.22);
}
</style>

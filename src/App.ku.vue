<script setup lang="ts">
import FgTabbar from '@/tabbar/index.vue'
import { isPageTabbar } from '@/tabbar/store'
import { currRoute } from '@/utils'

const showTabbar = ref(true)

onShow(() => {
  showTabbar.value = isPageTabbar(currRoute().path)
})
</script>

<template>
  <view>
    <KuRootView />
    <FgTabbar v-if="showTabbar" />
  </view>
</template>

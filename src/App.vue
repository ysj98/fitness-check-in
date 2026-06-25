<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { navigateToInterceptor } from '@/router/interceptor'

onShow((options) => {
  navigateToInterceptor.invoke({
    url: options?.path ? `/${options.path}` : '/',
  })
})
</script>

import { tabbarStore } from '@/tabbar/store'
import { getLastPage, parseUrlToObj } from '@/utils'

export const navigateToInterceptor = {
  invoke({ url }: { url: string }) {
    if (!url) {
      return
    }

    let { path } = parseUrlToObj(url)
    if (!path.startsWith('/')) {
      const currentPath = getLastPage()?.route || ''
      const normalizedPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
      path = `${normalizedPath.slice(0, normalizedPath.lastIndexOf('/'))}/${path}`
    }

    tabbarStore.setAutoCurIdx(path)
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}

import { ref } from 'vue'
import { tabbarItems } from './config'

export const tabbarList = ref(tabbarItems.map(item => ({
  ...item,
  pagePath: normalizeRoutePath(item.pagePath),
})))

export function normalizeRoutePath(path = '') {
  const route = path.split('?')[0]
  return route && !route.startsWith('/') ? `/${route}` : route
}

export function isPageTabbar(path: string) {
  const route = normalizeRoutePath(path)
  return route === '/' || tabbarList.value.some(item => item.pagePath === route)
}

function getCurrentPagePath() {
  const pages = getCurrentPages()
  return normalizeRoutePath(pages[pages.length - 1]?.route)
}

function findTabbarIndex(path: string) {
  const route = normalizeRoutePath(path)
  return route === '/' ? 0 : tabbarList.value.findIndex(item => item.pagePath === route)
}

const storedIndex = Number(uni.getStorageSync('app-tabbar-index')) || 0

export const tabbarStore = {
  curIdx: ref(storedIndex),
  setCurIdx(index: number) {
    this.curIdx.value = index
    uni.setStorageSync('app-tabbar-index', index)
  },
  setAutoCurIdx(path: string) {
    const index = findTabbarIndex(path)
    if (index >= 0) {
      this.setCurIdx(index)
    }
  },
  syncCurIdxByCurrentPage() {
    this.setAutoCurIdx(getCurrentPagePath())
  },
  syncCurIdxByCurrentPageAsync() {
    setTimeout(() => this.syncCurIdxByCurrentPage(), 0)
  },
  isCurrentRouteTabbarItem(index: number) {
    return findTabbarIndex(getCurrentPagePath()) === index
  },
}

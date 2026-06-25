import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { CustomTabBarItem } from './types'

export const tabbarItems: CustomTabBarItem[] = [
  { text: '打卡', pagePath: 'pages/index/index', icon: 'checkin' },
  { text: '体重', pagePath: 'pages/weight/index', icon: 'weight' },
  { text: '我的', pagePath: 'pages/me/me', icon: 'profile' },
]

export const tabBar: TabBar = {
  custom: true,
  color: '#7a8a82',
  selectedColor: '#20c46b',
  backgroundColor: '#ffffff',
  borderStyle: 'black',
  height: '58px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: tabbarItems.map(({ text, pagePath }) => ({ text, pagePath })) as TabBar['list'],
}

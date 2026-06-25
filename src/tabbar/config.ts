import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { CustomTabBarItem } from './types'

export const tabbarItems: CustomTabBarItem[] = [
  { text: '打卡', pagePath: 'pages/index/index', icon: 'i-carbon-calendar' },
  { text: '体重', pagePath: 'pages/weight/index', icon: 'i-carbon-scale' },
  { text: '我的', pagePath: 'pages/me/me', icon: 'i-carbon-user' },
]

export const tabBar: TabBar = {
  custom: true,
  color: '#8e8e93',
  selectedColor: '#34c759',
  backgroundColor: '#f9f9f9',
  borderStyle: 'black',
  height: '58px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: tabbarItems.map(({ text, pagePath }) => ({ text, pagePath })) as TabBar['list'],
}

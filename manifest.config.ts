import path from 'node:path'
import process from 'node:process'
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest'
import { loadEnv } from 'vite'

function getMode() {
  const args = process.argv.slice(2)
  const modeIndex = args.findIndex((arg) => arg === '--mode')
  return modeIndex === -1 ? (args[0] === 'build' ? 'production' : 'development') : args[modeIndex + 1]
}

const env = loadEnv(getMode(), path.resolve(process.cwd(), 'env'))

export default defineManifestConfig({
  name: env.VITE_APP_TITLE,
  appid: env.VITE_UNI_APPID,
  description: '运动打卡、体重与 BMI 管理微信小程序',
  versionName: '1.0.0',
  versionCode: '100',
  transformPx: false,
  'mp-weixin': {
    appid: env.VITE_WX_APPID,
    setting: {
      es6: true,
      minified: true,
      urlCheck: false,
    },
    optimization: {
      subPackages: true,
    },
    mergeVirtualHostAttributes: true,
    usingComponents: true,
  },
  uniStatistics: {
    enable: false,
  },
  vueVersion: '3',
})

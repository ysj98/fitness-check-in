import path from 'node:path'
import process from 'node:process'
import Uni from '@uni-helper/plugin-uni'
import { isMpWeixin } from '@uni-helper/uni-env'
import UniComponents from '@uni-helper/vite-plugin-uni-components'
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
import UniPages from '@uni-helper/vite-plugin-uni-pages'
import UniPlatform from '@uni-helper/vite-plugin-uni-platform'
import UniOptimization from '@uni-ku/bundle-optimizer'
import UniKuRoot from '@uni-ku/root'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, loadEnv } from 'vite'
import openDevTools from './scripts/open-dev-tools'
import { removeMpWeixinBrokenPreloadAssetsPlugin } from './vite-plugins/remove-mp-weixin-broken-preload-assets'

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(process.cwd(), 'env')
  const env = loadEnv(mode, envDir)
  const localEnv = loadEnv(mode, envDir, '')
  const { SKIP_OPEN_DEVTOOLS } = process.env

  return {
    envDir,
    plugins: [
      UniLayouts(),
      UniPlatform(),
      UniManifest(),
      UniComponents({
        extensions: ['vue'],
        deep: true,
        directoryAsNamespace: false,
        dts: 'src/types/components.d.ts',
      }),
      UniPages({
        exclude: ['**/components/**/**.*', '**/sections/**/**.*'],
        dts: 'src/types/uni-pages.d.ts',
      }),
      UniOptimization({
        enable: isMpWeixin,
        dts: { base: 'src/types' },
        logger: false,
      }),
      UniKuRoot({
        excludePages: ['**/components/**/**.*', '**/sections/**/**.*'],
      }),
      Uni(),
      {
        name: 'fix-vite-plugin-vue',
        configResolved(config) {
          const plugin = config.plugins.find(item => item.name === 'vite:vue')
          if (plugin?.api?.options) {
            plugin.api.options.devToolsEnabled = false
          }
        },
      },
      UnoCSS(),
      AutoImport({
        imports: ['vue', 'uni-app'],
        dts: 'src/types/auto-import.d.ts',
        vueTemplate: true,
      }),
      removeMpWeixinBrokenPreloadAssetsPlugin(isMpWeixin),
      SKIP_OPEN_DEVTOOLS !== 'true' && openDevTools({
        mode,
        wechatDevtoolsCliPath: localEnv.WECHAT_DEVTOOLS_CLI_PATH,
      }),
    ],
    resolve: {
      alias: {
        '@': path.join(process.cwd(), 'src'),
      },
    },
    esbuild: {
      drop: env.VITE_DELETE_CONSOLE === 'true' ? ['console', 'debugger'] : [],
    },
    build: {
      minify: mode === 'development' ? false : 'esbuild',
      sourcemap: env.VITE_SHOW_SOURCEMAP === 'true',
      target: 'es6',
    },
  }
})

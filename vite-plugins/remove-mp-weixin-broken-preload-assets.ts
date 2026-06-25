import type { Plugin } from 'vite'

const BROKEN_PRELOAD_ASSETS_RE =
  /if\s*\(\s*[$\w]+\s*\(\s*wx\.preloadAssets\s*\)\s*\)\s*\{\s*const\s+([$\w]+)\s*=\s*["']https["']\s*;\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{\s*wx\.preloadAssets\s*\(\s*\{\s*data\s*:\s*\[\s*\{\s*type\s*:\s*["']image["']\s*,\s*src\s*:\s*\1\s*\+\s*["']\/[0-9a-f]+\/img\/shadow-grey\.png["']\s*\}\s*\]\s*\}\s*\)\s*\}\s*,\s*3e3\s*\)\s*\}/gi

export function removeMpWeixinBrokenPreloadAssetsPlugin(enable: boolean): Plugin {
  return {
    name: 'remove-mp-weixin-broken-preload-assets',
    generateBundle(_options, bundle) {
      if (!enable) {
        return
      }

      Object.values(bundle).forEach((asset) => {
        if (asset.type !== 'chunk') {
          return
        }

        asset.code = asset.code.replace(BROKEN_PRELOAD_ASSETS_RE, '')
      })
    },
  }
}

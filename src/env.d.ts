/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_UNI_APPID: string
  readonly VITE_WX_APPID: string
  readonly VITE_SERVER_BASEURL: string
  readonly VITE_SERVER_BASEURL__WEIXIN_DEVELOP?: string
  readonly VITE_SERVER_BASEURL__WEIXIN_TRIAL?: string
  readonly VITE_SERVER_BASEURL__WEIXIN_RELEASE?: string
  readonly VITE_DELETE_CONSOLE: 'true' | 'false'
  readonly VITE_SHOW_SOURCEMAP: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface IUniUploadFileOptions {
    filePath?: string
    name?: string
    formData?: Record<string, unknown>
  }
}

declare module '@uni-helper/vite-plugin-uni-pages' {
  interface UserPageMeta {
    type?: 'home'
    layout?: 'default' | false
  }
}

export {}

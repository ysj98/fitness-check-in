export type CustomRequestOptions = Omit<UniApp.RequestOptions, 'method'> & {
  method?: UniApp.RequestOptions['method'] | 'PATCH'
  query?: Record<string, unknown>
  hideErrorToast?: boolean
} & IUniUploadFileOptions

export interface IResponse<T> {
  code: number
  data: T
  message?: string
  msg?: string
}

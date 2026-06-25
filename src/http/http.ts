import type { CustomRequestOptions, IResponse } from '@/http/types'
import { useTokenStore } from '@/store/token'

function showError(options: CustomRequestOptions, title: string) {
  if (!options.hideErrorToast) {
    uni.showToast({ icon: 'none', title })
  }
}

export function http<T>(options: CustomRequestOptions) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      dataType: 'json',
      success: (res) => {
        const response = res.data as IResponse<T>
        const message = response?.message || response?.msg || '请求错误'

        if (res.statusCode === 401 || response?.code === 401) {
          useTokenStore().clearAuth()
          showError(options, '登录已失效，请重试')
          reject(new Error(message))
          return
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          showError(options, message)
          reject(new Error(message))
          return
        }

        if (![0, 200].includes(response.code)) {
          showError(options, message)
          reject(new Error(message))
          return
        }

        resolve(response.data)
      },
      fail: (error) => {
        showError(options, '网络错误，请检查网络连接')
        reject(error)
      },
    } as UniApp.RequestOptions)
  })
}

export function httpGet<T>(url: string, query?: Record<string, unknown>, options: Partial<CustomRequestOptions> = {}) {
  return http<T>({ url, query, method: 'GET', ...options })
}

export function httpPost<T>(
  url: string,
  data?: UniApp.RequestOptions['data'],
  options: Partial<CustomRequestOptions> = {},
) {
  return http<T>({ url, data, method: 'POST', ...options })
}

export function httpDelete<T>(
  url: string,
  query?: Record<string, unknown>,
  options: Partial<CustomRequestOptions> = {},
) {
  return http<T>({ url, query, method: 'DELETE', ...options })
}

http.get = httpGet
http.post = httpPost
http.delete = httpDelete

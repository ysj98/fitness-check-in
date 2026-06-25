import type { IAuthLoginRes, IUserInfoRes } from './types/login'
import { http } from '@/http/http'

export interface IUserProfileUpdate {
  nickname: string
  avatarUrl?: string
  gender?: string
  birthday?: string
  dailyGoal?: number
  heightCm?: number | null
}

interface AvatarUploadResponse {
  code: number
  data: { avatarUrl: string }
  message?: string
  msg?: string
}

export function getUserInfo() {
  return http.get<IUserInfoRes>('/api/user/info')
}

export function updateUserProfile(data: IUserProfileUpdate) {
  return http<IUserInfoRes>({
    url: '/api/user/profile',
    method: 'PATCH',
    data,
  })
}

export function uploadUserAvatar(filePath: string) {
  return new Promise<{ avatarUrl: string }>((resolve, reject) => {
    uni.uploadFile({
      url: '/api/user/avatar',
      filePath,
      name: 'avatar',
      success: (res) => {
        try {
          const response = JSON.parse(res.data) as AvatarUploadResponse
          if (res.statusCode >= 200 && res.statusCode < 300 && [0, 200].includes(response.code)) {
            resolve(response.data)
            return
          }
          reject(new Error(response.message || response.msg || '头像上传失败'))
        } catch (error) {
          reject(error)
        }
      },
      fail: reject,
    })
  })
}

export function getWxCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => (res.code ? resolve(res.code) : reject(new Error('未获取到微信登录凭证'))),
      fail: (err) => reject(new Error(err.errMsg || '微信登录失败')),
    })
  })
}

export function wxLogin(code: string) {
  return http.post<IAuthLoginRes>('/api/auth/wx-login', { code })
}

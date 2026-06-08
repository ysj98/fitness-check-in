import type { IAuthLoginRes, ICaptcha, IDoubleTokenRes, IUpdateInfo, IUpdatePassword, IUserInfoRes } from './types/login'
import { http } from '@/http/http'

/**
 * 登录表单
 */
export interface ILoginForm {
  username: string
  password: string
}

export interface IUserProfileUpdate {
  nickname: string
  avatarUrl?: string
  gender?: string
  birthday?: string
}

export interface IAvatarUploadRes {
  avatarUrl: string
}

/**
 * 获取验证码
 * @returns ICaptcha 验证码
 */
export function getCode() {
  return http.get<ICaptcha>('/user/getCode')
}

/**
 * 用户登录
 * @param loginForm 登录表单
 */
export function login(loginForm: ILoginForm) {
  return http.post<IAuthLoginRes>('/auth/login', loginForm)
}

/**
 * 刷新token
 * @param refreshToken 刷新token
 */
export function refreshToken(refreshToken: string) {
  return http.post<IDoubleTokenRes>('/auth/refreshToken', { refreshToken })
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return http.get<IUserInfoRes>('/api/user/info')
}

/**
 * 退出登录
 */
export function logout() {
  return http.get<void>('/auth/logout')
}

/**
 * 修改用户信息
 */
export function updateInfo(data: IUpdateInfo) {
  return http.post('/user/updateInfo', data)
}

export function updateUserProfile(data: IUserProfileUpdate) {
  return http<IUserInfoRes>({
    url: '/api/user/profile',
    method: 'PATCH',
    data,
  })
}

export function uploadUserAvatar(filePath: string) {
  return new Promise<IAvatarUploadRes>((resolve, reject) => {
    uni.uploadFile({
      url: '/api/user/avatar',
      filePath,
      name: 'avatar',
      success: (res) => {
        try {
          const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (res.statusCode >= 200 && res.statusCode < 300 && (responseData.code === 0 || responseData.code === 200)) {
            resolve(responseData.data)
            return
          }
          reject(new Error(responseData.message || responseData.msg || '头像上传失败'))
        }
        catch (error) {
          reject(error)
        }
      },
      fail: reject,
    })
  })
}

/**
 * 修改用户密码
 */
export function updateUserPassword(data: IUpdatePassword) {
  return http.post('/user/updatePassword', data)
}

/**
 * 获取微信登录凭证
 * @returns Promise 包含微信登录凭证(code)
 */
export function getWxCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res.code) {
          resolve(res.code)
        }
        else {
          reject(new Error('未获取到微信登录凭证'))
        }
      },
      fail: err => reject(new Error(err)),
    })
  })
}

/**
 * 微信登录
 * @param params 微信登录参数，包含code
 * @returns Promise 包含登录结果
 */
export function wxLogin(code: string) {
  return http.post<IAuthLoginRes>('/api/auth/wx-login', { code })
}

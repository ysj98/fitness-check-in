import type { IAuthLoginRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getWxCode, wxLogin as requestWxLogin } from '@/api/login'
import { useUserStore } from './user'

let loginTask: Promise<IAuthLoginRes> | null = null

export const useTokenStore = defineStore(
  'token',
  () => {
    const token = ref('')
    const expiresAt = ref(0)

    function hasLogin() {
      return Boolean(token.value) && expiresAt.value > Date.now()
    }

    function getValidToken() {
      return hasLogin() ? token.value : ''
    }

    function setAuth(result: IAuthLoginRes) {
      token.value = result.token
      expiresAt.value = Date.now() + result.expiresIn * 1000
      useUserStore().setUserInfo(result.user)
    }

    function clearAuth() {
      token.value = ''
      expiresAt.value = 0
      useUserStore().clearUserInfo()
    }

    async function wxLogin() {
      if (loginTask) {
        return loginTask
      }

      loginTask = (async () => {
        try {
          const code = await getWxCode()
          const result = await requestWxLogin(code)
          setAuth(result)
          return result
        } catch (error) {
          uni.showToast({ title: '微信登录失败，请重试', icon: 'none' })
          throw error
        } finally {
          loginTask = null
        }
      })()

      return loginTask
    }

    return {
      clearAuth,
      expiresAt,
      getValidToken,
      hasLogin,
      setAuth,
      token,
      wxLogin,
    }
  },
  {
    persist: true,
  },
)

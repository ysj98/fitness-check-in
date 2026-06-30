import type { IUserInfoRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo } from '@/api/login'

const defaultAvatar = '/static/images/default-avatar.png'
const initialUserInfo: IUserInfoRes = {
  userId: -1,
  username: '',
  nickname: '',
  avatar: defaultAvatar,
  avatarUrl: '',
  gender: '',
  birthday: '',
  goalPeriod: 'week',
  goalMode: 'count',
  goalCount: 1,
  goalDuration: 30,
  heightCm: null,
  targetWeightKg: null,
  weightUnit: 'kg',
}

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<IUserInfoRes>({ ...initialUserInfo })

    function setUserInfo(value: IUserInfoRes) {
      userInfo.value = {
        ...initialUserInfo,
        ...value,
        avatar: value.avatar || value.avatarUrl || defaultAvatar,
        goalPeriod: value.goalPeriod || 'week',
        goalMode: value.goalMode || 'count',
        goalCount: value.goalCount || 1,
        goalDuration: value.goalDuration || 30,
        weightUnit: value.weightUnit || 'kg',
      }
    }

    function clearUserInfo() {
      userInfo.value = { ...initialUserInfo }
    }

    async function fetchUserInfo() {
      const result = await getUserInfo()
      setUserInfo(result)
      return result
    }

    return {
      clearUserInfo,
      fetchUserInfo,
      setUserInfo,
      userInfo,
    }
  },
  {
    persist: true,
  },
)

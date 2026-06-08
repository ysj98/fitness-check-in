<script lang="ts" setup>
import { updateUserProfile, uploadUserAvatar } from '@/api/login'
import { useTokenStore, useUserStore } from '@/store'

definePage({
  style: {
    navigationBarTitleText: '我的',
    navigationBarBackgroundColor: '#f8fafc',
    navigationBarTextStyle: 'black',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const saving = ref(false)
const uploadingAvatar = ref(false)
const avatarTempUrl = ref('')
const genderOptions = [
  { label: '未设置', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
]
const form = reactive({
  nickname: '',
  avatarUrl: '',
  gender: '',
  birthday: '',
})

const avatarPreview = computed(() => avatarTempUrl.value || form.avatarUrl || '/static/images/default-avatar.png')
const genderIndex = computed(() => {
  const index = genderOptions.findIndex(item => item.value === form.gender)
  return index >= 0 ? index : 0
})
const genderLabel = computed(() => genderOptions[genderIndex.value].label)

onShow(() => {
  initProfile()
})

async function initProfile() {
  if (!tokenStore.updateNowTime().hasLogin) {
    await tokenStore.wxLogin()
  }
  const userInfo = await userStore.fetchUserInfo()
  form.nickname = userInfo.nickname || ''
  form.avatarUrl = userInfo.avatarUrl || userInfo.avatar || ''
  form.gender = userInfo.gender || ''
  form.birthday = userInfo.birthday || ''
}

function handleGenderChange(event: { detail: { value: number } }) {
  form.gender = genderOptions[event.detail.value]?.value || ''
}

function handleBirthdayChange(event: { detail: { value: string } }) {
  form.birthday = event.detail.value
}

async function handleChooseAvatar(event: { detail: { avatarUrl?: string } }) {
  const avatarUrl = event.detail.avatarUrl
  if (!avatarUrl || uploadingAvatar.value) {
    return
  }

  avatarTempUrl.value = avatarUrl
  uploadingAvatar.value = true
  try {
    const res = await uploadUserAvatar(avatarUrl)
    form.avatarUrl = res.avatarUrl
    avatarTempUrl.value = ''
    uni.showToast({
      title: '头像已更新',
      icon: 'success',
    })
  }
  finally {
    uploadingAvatar.value = false
  }
}

async function handleSave() {
  if (!form.nickname.trim()) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none',
    })
    return
  }

  saving.value = true
  try {
    const userInfo = await updateUserProfile({
      nickname: form.nickname.trim(),
      avatarUrl: form.avatarUrl.trim(),
      gender: form.gender,
      birthday: form.birthday,
    })
    userStore.setUserInfo(userInfo)
    uni.showToast({
      title: '已保存',
      icon: 'success',
    })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="profile-page">
    <view class="profile-card">
      <button
        class="avatar-button"
        open-type="chooseAvatar"
        hover-class="avatar-button-pressed"
        @chooseavatar="handleChooseAvatar"
      >
        <image class="avatar" :src="avatarPreview" mode="aspectFill" />
        <view v-if="uploadingAvatar" class="avatar-mask">
          上传中
        </view>
      </button>
      <view class="profile-title">
        {{ form.nickname || '我的资料' }}
      </view>
      <view class="profile-subtitle">
        个人信息
      </view>
    </view>

    <view class="form-section">
      <view class="field">
        <text class="field-label">
          昵称
        </text>
        <input
          v-model="form.nickname"
          class="field-input"
          type="nickname"
          maxlength="30"
          placeholder="请输入昵称"
          placeholder-class="placeholder"
        >
      </view>

      <view class="field">
        <text class="field-label">
          头像地址
        </text>
        <input
          v-model="form.avatarUrl"
          class="field-input"
          placeholder="https://..."
          placeholder-class="placeholder"
        >
      </view>

      <picker :value="genderIndex" :range="genderOptions" range-key="label" @change="handleGenderChange">
        <view class="field picker-field">
          <text class="field-label">
            性别
          </text>
          <view class="field-value">
            {{ genderLabel }}
          </view>
        </view>
      </picker>

      <picker mode="date" :value="form.birthday || '2000-01-01'" @change="handleBirthdayChange">
        <view class="field picker-field">
          <text class="field-label">
            生日
          </text>
          <view class="field-value" :class="{ muted: !form.birthday }">
            {{ form.birthday || '未设置' }}
          </view>
        </view>
      </picker>
    </view>

    <button
      class="save-button"
      :disabled="saving"
      hover-class="save-button-pressed"
      @click="handleSave"
    >
      {{ saving ? '保存中' : '保存资料' }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  padding: 32rpx 28rpx 150rpx;
  background: #f8fafc;
  color: #0f172a;
  box-sizing: border-box;
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 28rpx;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  background: #ffffff;
}

.avatar-button {
  position: relative;
  width: 150rpx;
  height: 150rpx;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  overflow: hidden;
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}

.avatar-button::after {
  border: 0;
}

.avatar-button-pressed {
  opacity: 0.86;
  transform: scale(0.96);
}

.avatar {
  width: 150rpx;
  height: 150rpx;
  border-radius: 50%;
  background: #e2e8f0;
}

.avatar-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.48);
  font-size: 24rpx;
}

.profile-title {
  margin-top: 22rpx;
  font-size: 36rpx;
  font-weight: 800;
}

.profile-subtitle {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
}

.form-section {
  margin-top: 28rpx;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  background: #ffffff;
  overflow: hidden;
}

.field {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  padding: 0 28rpx;
  border-bottom: 1px solid #f1f5f9;
  box-sizing: border-box;
}

.field:last-child {
  border-bottom: 0;
}

.field-label {
  flex: 0 0 156rpx;
  color: #334155;
  font-size: 28rpx;
  font-weight: 600;
}

.field-input {
  flex: 1;
  min-height: 80rpx;
  color: #0f172a;
  font-size: 28rpx;
  text-align: right;
}

.field-value {
  flex: 1;
  color: #0f172a;
  font-size: 28rpx;
  text-align: right;
}

.field-value.muted,
.placeholder {
  color: #94a3b8;
}

.picker-field {
  min-height: 104rpx;
}

.save-button {
  height: 92rpx;
  margin-top: 36rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #10b981, #0f766e);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 92rpx;
  box-shadow: 0 18rpx 36rpx rgba(15, 118, 110, 0.18);
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}

.save-button::after {
  border: 0;
}

.save-button-pressed {
  opacity: 0.9;
  transform: scale(0.98);
}
</style>

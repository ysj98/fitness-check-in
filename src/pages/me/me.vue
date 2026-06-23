<script lang="ts" setup>
import type { CheckInBadge } from '@/api/checkins'
import type { ThemeMode } from '@/store'
import { getCheckInStats } from '@/api/checkins'
import { updateUserProfile, uploadUserAvatar } from '@/api/login'
import { useThemeStore, useTokenStore, useUserStore } from '@/store'
import { triggerSuccessHaptic } from '@/utils/haptics'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const themeStore = useThemeStore()
const saving = ref(false)
const uploadingAvatar = ref(false)
const avatarTempUrl = ref('')
const badges = ref<CheckInBadge[]>([])
const genderOptions = [
  { label: '未设置', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
]
const dailyGoalOptions = Array.from({ length: 9 }, (_, index) => `${index + 1}`)
const form = reactive({
  nickname: '',
  avatarUrl: '',
  gender: '',
  birthday: '',
  dailyGoal: 1,
  heightCm: '',
})

const avatarPreview = computed(() => avatarTempUrl.value || form.avatarUrl || '/static/images/default-avatar.png')
const genderIndex = computed(() => {
  const index = genderOptions.findIndex(item => item.value === form.gender)
  return index >= 0 ? index : 0
})
const genderLabel = computed(() => genderOptions[genderIndex.value].label)
const dailyGoalIndex = computed(() => Math.max(0, Math.min(8, form.dailyGoal - 1)))
const unlockedBadgeCount = computed(() => badges.value.filter(item => item.unlocked).length)

onShow(() => {
  initProfile()
})

async function initProfile() {
  if (!tokenStore.updateNowTime().hasLogin) {
    await tokenStore.wxLogin()
  }
  const [userInfo, stats] = await Promise.all([
    userStore.fetchUserInfo(),
    getCheckInStats(),
  ])
  form.nickname = userInfo.nickname || ''
  form.avatarUrl = userInfo.avatarUrl || userInfo.avatar || ''
  form.gender = userInfo.gender || ''
  form.birthday = userInfo.birthday || ''
  form.dailyGoal = userInfo.dailyGoal || 1
  form.heightCm = userInfo.heightCm ? String(userInfo.heightCm) : ''
  badges.value = stats.badges
}

function handleGenderChange(event: { detail: { value: number } }) {
  form.gender = genderOptions[event.detail.value]?.value || ''
}

function handleBirthdayChange(event: { detail: { value: string } }) {
  form.birthday = event.detail.value
}

function handleDailyGoalChange(event: { detail: { value: number } }) {
  form.dailyGoal = Number(dailyGoalOptions[event.detail.value] || 1)
}

function selectTheme(mode: ThemeMode) {
  if (themeStore.mode === mode) {
    return
  }
  themeStore.setMode(mode)
  triggerSuccessHaptic()
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

  const heightCm = form.heightCm === '' ? null : Number(form.heightCm)
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
    uni.showToast({
      title: '请输入 100-250 cm 的身高',
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
      dailyGoal: form.dailyGoal,
      heightCm,
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
  <view class="app-page profile-page">
    <ios-page-header title="我的" subtitle="个人健康资料" />

    <view class="profile-summary ios-card">
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
      <view class="profile-copy">
        <text class="profile-title">{{ form.nickname || '微信用户' }}</text>
        <text class="profile-subtitle">{{ unlockedBadgeCount }} 项成就已达成</text>
      </view>
      <text class="profile-chevron i-carbon-chevron-right" />
    </view>

    <text class="ios-section-title">个人资料</text>
    <view class="form-section ios-card">
      <view class="field">
        <text class="field-icon blue-icon i-carbon-user" />
        <text class="field-label">昵称</text>
        <input
          v-model="form.nickname"
          class="field-input"
          type="nickname"
          :maxlength="30"
          placeholder="请输入昵称"
          placeholder-class="placeholder"
        >
      </view>

      <picker :value="genderIndex" :range="genderOptions" range-key="label" @change="handleGenderChange">
        <view class="field picker-field">
          <text class="field-icon pink-icon i-carbon-gender-male" />
          <text class="field-label">性别</text>
          <view class="field-value">
            {{ genderLabel }}
          </view>
          <text class="field-chevron i-carbon-chevron-right" />
        </view>
      </picker>

      <picker mode="date" :value="form.birthday || '2000-01-01'" @change="handleBirthdayChange">
        <view class="field picker-field">
          <text class="field-icon orange-icon i-carbon-calendar" />
          <text class="field-label">生日</text>
          <view class="field-value" :class="{ muted: !form.birthday }">
            {{ form.birthday || '未设置' }}
          </view>
          <text class="field-chevron i-carbon-chevron-right" />
        </view>
      </picker>

      <picker :value="dailyGoalIndex" :range="dailyGoalOptions" @change="handleDailyGoalChange">
        <view class="field picker-field">
          <text class="field-icon green-icon i-carbon-chart-bar-target" />
          <text class="field-label">每日目标</text>
          <view class="field-value">
            {{ form.dailyGoal }} 次
          </view>
          <text class="field-chevron i-carbon-chevron-right" />
        </view>
      </picker>

      <view class="field">
        <text class="field-icon purple-icon i-carbon-ruler" />
        <text class="field-label">身高</text>
        <view class="field-unit-input">
          <input
            v-model="form.heightCm"
            class="field-input"
            type="digit"
            :maxlength="5"
            placeholder="未设置"
            placeholder-class="placeholder"
          >
          <text>cm</text>
        </view>
      </view>
    </view>

    <text class="ios-section-title">外观</text>
    <view class="appearance-card ios-card">
      <view class="appearance-label">
        <text class="field-icon blue-icon" :class="themeStore.isDark ? 'i-carbon-moon' : 'i-carbon-sun'" />
        <text>主题</text>
      </view>
      <view class="theme-switch">
        <button :class="{ active: themeStore.mode === 'light' }" @click="selectTheme('light')">
          浅色
        </button>
        <button :class="{ active: themeStore.mode === 'dark' }" @click="selectTheme('dark')">
          深色
        </button>
      </view>
    </view>

    <view class="achievement-heading">
      <text class="ios-section-title achievement-section-title">我的成就</text>
      <text class="achievement-count numeric">{{ unlockedBadgeCount }}/{{ badges.length }}</text>
    </view>
    <view class="badge-grid">
      <view
        v-for="(badge, index) in badges"
        :key="badge.key"
        class="badge-item ios-card"
        :class="{ unlocked: badge.unlocked }"
      >
        <view class="badge-icon">
          <text :class="badge.unlocked ? 'i-carbon-trophy-filled' : 'i-carbon-trophy'" />
        </view>
        <view class="badge-copy">
          <text class="badge-name">{{ badge.name }}</text>
          <text class="badge-desc">{{ badge.description }}</text>
        </view>
        <text v-if="badge.unlocked" class="badge-state i-carbon-checkmark-filled" />
        <text v-else class="badge-index numeric">{{ String(index + 1).padStart(2, '0') }}</text>
      </view>
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
  padding-right: 0;
  padding-left: 0;
}

button::after {
  border: 0;
}

.profile-summary,
.form-section,
.appearance-card,
.badge-grid,
.save-button {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
}

.profile-summary {
  display: flex;
  align-items: center;
  min-height: 154rpx;
  padding: 24rpx 28rpx;
  box-sizing: border-box;
  animation: enter var(--app-motion-normal) ease-out both;
}

.avatar-button {
  position: relative;
  flex: 0 0 auto;
  width: 106rpx;
  height: 106rpx;
  padding: 0;
  border-radius: 50%;
  background: var(--app-fill);
  overflow: hidden;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.avatar-button-pressed {
  opacity: 0.76;
  transform: scale(0.96);
}

.avatar {
  width: 106rpx;
  height: 106rpx;
  border-radius: 50%;
  background: var(--app-fill);
}

.avatar-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--app-mask);
  font-size: 20rpx;
}

.profile-copy {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}

.profile-title,
.profile-subtitle {
  display: block;
}

.profile-title {
  font-size: 34rpx;
  font-weight: 700;
}

.profile-subtitle {
  margin-top: 7rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
}

.profile-chevron,
.field-chevron {
  flex: 0 0 auto;
  color: var(--app-label-tertiary);
  font-size: 28rpx;
}

.form-section {
  overflow: hidden;
  animation: enter var(--app-motion-normal) 50ms ease-out both;
}

.field {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  margin-left: 28rpx;
  padding: 0 26rpx 0 0;
  border-bottom: 1rpx solid var(--app-separator);
  box-sizing: border-box;
}

.field:last-child {
  border-bottom: 0;
}

.field-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin-right: 20rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
}

.blue-icon {
  color: var(--app-blue);
  background: var(--app-blue-soft);
}

.pink-icon {
  color: var(--app-pink);
  background: var(--app-pink-soft);
}

.orange-icon {
  color: var(--app-orange);
  background: var(--app-orange-soft);
}

.green-icon {
  color: var(--app-green);
  background: var(--app-green-soft);
}

.purple-icon {
  color: #af52de;
  background: rgba(175, 82, 222, 0.14);
}

.field-label {
  flex: 0 0 152rpx;
  color: var(--app-label-primary);
  font-size: 28rpx;
  font-weight: 500;
}

.field-input,
.field-value {
  flex: 1;
  min-width: 0;
  color: var(--app-label-primary);
  font-size: 28rpx;
  text-align: right;
}

.field-input {
  min-height: 80rpx;
}

.field-value.muted,
.placeholder {
  color: var(--app-label-tertiary);
}

.field-unit-input {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10rpx;
  color: var(--app-label-secondary);
  font-size: 24rpx;
}

.field-unit-input .field-input {
  flex: 0 1 180rpx;
}

.appearance-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104rpx;
  padding: 16rpx 24rpx 16rpx 28rpx;
  box-sizing: border-box;
}

.appearance-label {
  display: flex;
  align-items: center;
  font-size: 28rpx;
}

.theme-switch {
  display: flex;
  padding: 4rpx;
  border-radius: 16rpx;
  background: var(--app-fill);
}

.theme-switch button {
  min-width: 92rpx;
  height: 58rpx;
  padding: 0 16rpx;
  border-radius: 13rpx;
  color: var(--app-label-secondary);
  background: transparent;
  font-size: 24rpx;
  line-height: 58rpx;
}

.theme-switch button.active {
  color: var(--app-label-primary);
  background: var(--app-surface);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  font-weight: 650;
}

.achievement-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-right: calc(var(--app-gutter) + 12rpx);
}

.achievement-section-title {
  margin-right: 0;
}

.achievement-count {
  margin-bottom: 14rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
}

.badge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.badge-item {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 180rpx;
  padding: 22rpx;
  box-sizing: border-box;
  opacity: 0.62;
}

.badge-item.unlocked {
  opacity: 1;
}

.badge-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  color: var(--app-orange);
  background: var(--app-orange-soft);
  font-size: 29rpx;
}

.badge-item:nth-child(3n + 2) .badge-icon {
  color: var(--app-pink);
  background: var(--app-pink-soft);
}

.badge-item:nth-child(3n) .badge-icon {
  color: var(--app-blue);
  background: var(--app-blue-soft);
}

.badge-copy {
  flex: 1;
  min-width: 0;
  margin-left: 14rpx;
}

.badge-name,
.badge-desc {
  display: block;
}

.badge-name {
  font-size: 26rpx;
  font-weight: 650;
}

.badge-desc {
  margin-top: 7rpx;
  color: var(--app-label-secondary);
  font-size: 20rpx;
  line-height: 1.4;
}

.badge-state,
.badge-index {
  position: absolute;
  right: 18rpx;
  bottom: 16rpx;
  color: var(--app-green);
  font-size: 24rpx;
}

.badge-index {
  color: var(--app-label-tertiary);
  font-size: 20rpx;
}

.save-button {
  height: 92rpx;
  margin-top: 36rpx;
  border-radius: var(--app-control-radius);
  color: #fff;
  background: var(--app-green);
  box-shadow: 0 10rpx 24rpx rgba(52, 199, 89, 0.18);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 92rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.save-button-pressed {
  opacity: 0.82;
  transform: scale(0.985);
}

.save-button[disabled] {
  opacity: 0.46;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(14rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

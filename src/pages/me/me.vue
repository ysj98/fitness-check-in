<script lang="ts" setup>
import type { AchievementBadge, AchievementCategory, AchievementSeriesProgress } from '@/api/achievements'
import type { GoalMode, GoalPeriod } from '@/api/types/login'
import type { ThemeMode } from '@/store'
import { getAchievements } from '@/api/achievements'
import { updateUserProfile, uploadUserAvatar } from '@/api/login'
import { useThemeStore, useTokenStore, useUserStore } from '@/store'
import {
  filterAchievementSeries,
  getAchievementCategoryOptions,
  getAchievementTotals,
} from '@/utils/achievement-progress'
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
const profileReady = ref(false)
const uploadingAvatar = ref(false)
const avatarTempUrl = ref('')
const achievements = ref<AchievementSeriesProgress[]>([])
const selectedAchievementCategory = ref<AchievementCategory>('checkin')
const selectedAchievementSeries = ref<AchievementSeriesProgress | null>(null)
const genderOptions = [
  { label: '未设置', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
]
const goalModeOptions = [
  { label: '按次数', value: 'count' as const },
  { label: '按时长', value: 'duration' as const },
  { label: '次数+时长', value: 'both' as const },
]
const goalPeriodOptions = [
  { label: '周目标', value: 'week' as const },
  { label: '月目标', value: 'month' as const },
]
const goalRules = {
  week: {
    countMin: 1,
    countMax: 14,
    durationMin: 30,
    durationMax: 1500,
    defaultCount: 4,
    defaultDuration: 180,
    durationOptions: [30, 60, 120, 180, 300, 600, 900, 1500],
  },
  month: {
    countMin: 1,
    countMax: 60,
    durationMin: 100,
    durationMax: 6000,
    defaultCount: 20,
    defaultDuration: 800,
    durationOptions: [100, 300, 600, 800, 1200, 2400, 3600, 6000],
  },
}
const themeOptions = [
  { label: '浅色', value: 'light' as const },
  { label: '深色', value: 'dark' as const },
]
const form = reactive({
  nickname: '',
  avatarUrl: '',
  gender: '',
  birthday: '',
  goalPeriod: 'week' as GoalPeriod,
  goalMode: 'count' as GoalMode,
  goalCount: goalRules.week.defaultCount,
  goalDuration: goalRules.week.defaultDuration,
  heightCm: '',
})
const goalDraft = reactive({
  period: 'week' as GoalPeriod,
  mode: 'count' as GoalMode,
  countGoal: goalRules.week.defaultCount,
  durationOption: goalRules.week.defaultDuration as number | 'custom',
  customDuration: '',
})

const avatarPreview = computed(() => avatarTempUrl.value || form.avatarUrl || '/static/images/default-avatar.png')
const genderIndex = computed(() => {
  const index = genderOptions.findIndex((item) => item.value === form.gender)
  return index >= 0 ? index : 0
})
const genderLabel = computed(() => genderOptions[genderIndex.value].label)
const achievementTotals = computed(() => getAchievementTotals(achievements.value))
const achievementProgressText = computed(() => achievementTotals.value.text)
const completionPercent = computed(() => achievementTotals.value.percent)
const profileAccent = computed(() => (form.gender === 'male' ? 'blue' : 'pink'))
const achievementCategoryOptions = computed(() => getAchievementCategoryOptions(achievements.value))
const filteredAchievementSeries = computed(() =>
  filterAchievementSeries(achievements.value, selectedAchievementCategory.value),
)
const goalSummary = computed(() =>
  formatGoalSummary(form.goalPeriod, form.goalMode, form.goalCount, form.goalDuration),
)
const draftGoalSummary = computed(() => {
  const duration =
    typeof goalDraft.durationOption === 'number'
      ? goalDraft.durationOption
      : Number(goalDraft.customDuration.trim()) || form.goalDuration
  return formatGoalSummary(goalDraft.period, goalDraft.mode, goalDraft.countGoal, duration)
})
const badgeAccentMap: Record<AchievementBadge, 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'> = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  DIAMOND: 'diamond',
}
const categoryAccentMap: Record<AchievementCategory, 'green' | 'orange' | 'blue' | 'pink'> = {
  checkin: 'green',
  streak: 'orange',
  weight: 'blue',
  profile: 'pink',
}
const activeGoalRule = computed(() => goalRules[goalDraft.period])
const countGoalOptions = computed(() =>
  Array.from(
    { length: activeGoalRule.value.countMax - activeGoalRule.value.countMin + 1 },
    (_, index) => activeGoalRule.value.countMin + index,
  ),
)
const durationGoalOptions = computed(() => activeGoalRule.value.durationOptions)
let saveTimer: ReturnType<typeof setTimeout> | undefined
const goalSheetOpen = ref(false)

onShow(() => {
  initProfile()
})

async function initProfile() {
  profileReady.value = false
  if (!tokenStore.hasLogin()) {
    await tokenStore.wxLogin()
  } else {
    await userStore.fetchUserInfo()
  }
  const [userInfo, nextAchievements] = [userStore.userInfo, await getAchievements()]
  form.nickname = userInfo.nickname || ''
  form.avatarUrl = userInfo.avatarUrl || userInfo.avatar || ''
  form.gender = userInfo.gender || ''
  form.birthday = userInfo.birthday || ''
  form.goalPeriod = userInfo.goalPeriod || 'week'
  form.goalMode = userInfo.goalMode || 'count'
  const rule = goalRules[form.goalPeriod]
  form.goalCount = userInfo.goalCount || rule.defaultCount
  form.goalDuration = userInfo.goalDuration || rule.defaultDuration
  form.heightCm = userInfo.heightCm ? String(userInfo.heightCm) : ''
  achievements.value = nextAchievements
  profileReady.value = true
}

function handleGenderChange(event: { detail: { value: number } }) {
  form.gender = genderOptions[event.detail.value]?.value || ''
  scheduleProfileSave()
}

function handleBirthdayChange(event: { detail: { value: string } }) {
  form.birthday = event.detail.value
  scheduleProfileSave()
}

function selectTheme(mode: ThemeMode) {
  if (themeStore.mode === mode) {
    return
  }
  themeStore.setMode(mode)
  triggerSuccessHaptic()
}

function formatGoalSummary(period: GoalPeriod, mode: GoalMode, countGoal: number, durationGoal: number) {
  const periodText = period === 'month' ? '月目标' : '周目标'
  if (mode === 'count') {
    return `${periodText} · ${countGoal} 次`
  }
  if (mode === 'duration') {
    return `${periodText} · ${durationGoal} 分钟`
  }
  return `${periodText} · ${countGoal} 次 · ${durationGoal} 分钟`
}

function openGoalSettingsSheet() {
  goalDraft.period = form.goalPeriod
  const rule = goalRules[goalDraft.period]
  goalDraft.mode = form.goalMode
  goalDraft.countGoal = Math.min(rule.countMax, Math.max(rule.countMin, form.goalCount))
  goalDraft.durationOption = rule.durationOptions.includes(form.goalDuration) ? form.goalDuration : 'custom'
  goalDraft.customDuration = goalDraft.durationOption === 'custom' ? String(form.goalDuration) : ''
  goalSheetOpen.value = true
}

function closeGoalSettingsSheet() {
  if (!saving.value) {
    goalSheetOpen.value = false
  }
}

function selectGoalPeriod(period: GoalPeriod) {
  goalDraft.period = period
  const rule = goalRules[period]
  goalDraft.countGoal = rule.defaultCount
  goalDraft.durationOption = rule.defaultDuration
  goalDraft.customDuration = ''
}

function selectGoalMode(mode: GoalMode) {
  goalDraft.mode = mode
}

function selectGoalDurationOption(value: number | 'custom') {
  goalDraft.durationOption = value
  if (value !== 'custom') {
    goalDraft.customDuration = ''
  }
}

function resolveGoalDuration() {
  if (typeof goalDraft.durationOption === 'number') {
    return goalDraft.durationOption
  }
  const value = goalDraft.customDuration.trim()
  if (!value || !/^\d+$/.test(value)) {
    uni.showToast({ title: '请输入有效运动时长', icon: 'none' })
    return null
  }
  const duration = Number(value)
  const rule = activeGoalRule.value
  if (duration < rule.durationMin || duration > rule.durationMax) {
    uni.showToast({ title: `运动时长需为 ${rule.durationMin}-${rule.durationMax} 分钟`, icon: 'none' })
    return null
  }
  return duration
}

async function saveGoalSettings() {
  const rule = activeGoalRule.value
  const durationGoal =
    goalDraft.mode === 'duration' || goalDraft.mode === 'both'
      ? resolveGoalDuration()
      : typeof goalDraft.durationOption === 'number'
        ? goalDraft.durationOption
        : rule.defaultDuration
  if (!durationGoal) {
    return
  }
  form.goalPeriod = goalDraft.period
  form.goalMode = goalDraft.mode
  form.goalCount = goalDraft.countGoal
  form.goalDuration = durationGoal
  goalSheetOpen.value = false
  await saveProfile()
  uni.showToast({ title: '目标设置已更新', icon: 'success' })
}

function selectAchievementCategory(category: AchievementCategory) {
  selectedAchievementCategory.value = category
}

function openAchievementDetail(series: AchievementSeriesProgress) {
  selectedAchievementSeries.value = series
}

function closeAchievementDetail() {
  selectedAchievementSeries.value = null
}

function getLevelStateText(level: AchievementSeriesProgress['levels'][number]) {
  if (level.completed) {
    return '已完成'
  }
  return level.isCurrent ? '冲刺中' : '未开始'
}

function getLevelBadgeClass(badge: AchievementBadge) {
  return `badge-${badgeAccentMap[badge]}`
}

function getSeriesAccent(category: AchievementCategory) {
  return categoryAccentMap[category]
}

async function refreshAchievements() {
  achievements.value = await getAchievements()
}

function scheduleProfileSave() {
  if (!profileReady.value) {
    return
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    void saveProfile()
  }, 250)
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
    await saveProfile()
    uni.showToast({
      title: '头像已更新',
      icon: 'success',
    })
  } finally {
    uploadingAvatar.value = false
  }
}

async function saveProfile() {
  if (!profileReady.value || saving.value) {
    return
  }
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
      avatarUrl: form.avatarUrl.trim() || null,
      gender: form.gender || null,
      birthday: form.birthday || null,
      goalPeriod: form.goalPeriod,
      goalMode: form.goalMode,
      goalCount: form.goalCount,
      goalDuration: form.goalDuration,
      heightCm,
    })
    userStore.setUserInfo(userInfo)
    await refreshAchievements()
    triggerSuccessHaptic()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="app-page profile-page">
    <ios-page-header title="我的" subtitle="个人健康档案" accent="pink" />

    <view class="profile-summary-shell" :class="`accent-${profileAccent}`">
      <app-card :accent="profileAccent" elevated>
        <view class="profile-summary-content">
          <button
            class="avatar-button"
            open-type="chooseAvatar"
            hover-class="avatar-button-pressed"
            @chooseavatar="handleChooseAvatar"
          >
            <image class="avatar" :src="avatarPreview" mode="aspectFill" />
            <view v-if="uploadingAvatar" class="avatar-mask"> 上传中 </view>
          </button>

          <view class="profile-copy">
            <text class="profile-title">{{ form.nickname || '微信用户' }}</text>
            <text class="profile-subtitle">{{ achievementProgressText }} 阶段已完成</text>
            <view class="profile-stats">
              <view class="profile-stat">
                <text class="stat-label">已解锁</text>
                <text class="stat-value numeric">{{ achievementProgressText }}</text>
              </view>
              <view class="profile-stat">
                <text class="stat-label">目标设置</text>
                <text class="stat-value numeric">{{ goalSummary }}</text>
              </view>
            </view>
          </view>

          <view class="profile-progress">
            <progress-ring :percent="completionPercent" label="成就" :accent="profileAccent" />
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">个人资料</text>
    <view class="form-section-shell">
      <app-card accent="blue">
        <view class="form-section-content">
          <view class="field">
            <app-icon name="profile" accent="blue" size="sm" />
            <text class="field-label">昵称</text>
            <input
              v-model="form.nickname"
              class="field-input"
              type="nickname"
              :maxlength="30"
              placeholder="请输入昵称"
              placeholder-class="placeholder"
              @blur="scheduleProfileSave"
              @confirm="scheduleProfileSave"
            />
          </view>

          <picker :value="genderIndex" :range="genderOptions" range-key="label" @change="handleGenderChange">
            <view class="field picker-field">
              <app-icon name="i-carbon-gender-male" accent="pink" size="sm" />
              <text class="field-label">性别</text>
              <view class="field-value">
                {{ genderLabel }}
              </view>
              <text class="field-chevron i-carbon-chevron-right" />
            </view>
          </picker>

          <picker mode="date" :value="form.birthday || '2000-01-01'" @change="handleBirthdayChange">
            <view class="field picker-field">
              <app-icon name="i-carbon-calendar" accent="orange" size="sm" />
              <text class="field-label">生日</text>
              <view class="field-value" :class="{ muted: !form.birthday }">
                {{ form.birthday || '未设置' }}
              </view>
              <text class="field-chevron i-carbon-chevron-right" />
            </view>
          </picker>

          <button class="field picker-field goal-field-button" hover-class="goal-field-pressed" @click="openGoalSettingsSheet">
            <app-icon name="target" accent="green" size="sm" />
            <text class="field-label">目标设置</text>
            <view class="field-value"> {{ goalSummary }} </view>
            <text class="field-chevron i-carbon-chevron-right" />
          </button>

          <view class="field">
            <app-icon name="i-carbon-ruler" accent="gold" size="sm" />
            <text class="field-label">身高</text>
            <view class="field-unit-input">
              <input
                v-model="form.heightCm"
                class="field-input"
                type="digit"
                :maxlength="5"
                placeholder="未设置"
                placeholder-class="placeholder"
                @blur="scheduleProfileSave"
                @confirm="scheduleProfileSave"
              />
              <text>cm</text>
            </view>
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">外观</text>
    <view class="appearance-card-shell">
      <app-card accent="gold">
        <view class="appearance-card-content">
          <view class="appearance-label">
            <app-icon :name="themeStore.isDark ? 'i-carbon-moon' : 'i-carbon-sun'" accent="gold" size="sm" />
            <text>主题</text>
          </view>
          <view class="theme-control">
            <app-segmented-control :model-value="themeStore.mode" :options="themeOptions" @change="selectTheme" />
          </view>
        </view>
      </app-card>
    </view>

    <view class="achievement-heading">
      <text class="ios-section-title achievement-section-title">我的成就</text>
      <text class="achievement-count numeric">{{ achievementProgressText }}</text>
    </view>
    <view class="achievement-filter-shell">
      <app-segmented-control
        :model-value="selectedAchievementCategory"
        :options="achievementCategoryOptions"
        @change="selectAchievementCategory"
      />
    </view>
    <view class="series-grid">
      <achievement-badge
        v-for="(series, index) in filteredAchievementSeries"
        :key="series.key"
        :series="series"
        :style="{ animationDelay: `${Math.min(index, 10) * 35}ms` }"
        @select="openAchievementDetail"
      />
    </view>

    <app-sheet
      v-if="goalSheetOpen"
      title="目标设置"
      close-text="取消"
      :show-save="false"
      compact
      @close="closeGoalSettingsSheet"
    >
      <view class="goal-settings-sheet">
        <view class="goal-settings-summary">
          <text>当前设置</text>
          <text class="numeric">{{ draftGoalSummary }}</text>
        </view>

        <view class="goal-setting-card">
          <text class="goal-setting-title">目标周期</text>
          <app-segmented-control :model-value="goalDraft.period" :options="goalPeriodOptions" @change="selectGoalPeriod" />
        </view>

        <view class="goal-setting-card">
          <text class="goal-setting-title">目标模式</text>
          <app-segmented-control :model-value="goalDraft.mode" :options="goalModeOptions" @change="selectGoalMode" />
        </view>

        <view v-if="goalDraft.mode === 'count' || goalDraft.mode === 'both'" class="goal-setting-card">
          <text class="goal-setting-title">打卡次数</text>
          <view class="goal-option-grid count-grid">
            <button
              v-for="count in countGoalOptions"
              :key="count"
              class="goal-option"
              :class="{ active: goalDraft.countGoal === count }"
              hover-class="goal-option-pressed"
              @click.stop="goalDraft.countGoal = count"
            >
              {{ count }} 次
            </button>
          </view>
        </view>

        <view v-if="goalDraft.mode === 'duration' || goalDraft.mode === 'both'" class="goal-setting-card">
          <text class="goal-setting-title">运动时长</text>
          <view class="goal-option-grid duration-grid">
            <button
              v-for="minutes in durationGoalOptions"
              :key="minutes"
              class="goal-option"
              :class="{ active: goalDraft.durationOption === minutes }"
              hover-class="goal-option-pressed"
              @click.stop="selectGoalDurationOption(minutes)"
            >
              {{ minutes }} 分钟
            </button>
            <button
              class="goal-option"
              :class="{ active: goalDraft.durationOption === 'custom' }"
              hover-class="goal-option-pressed"
              @click.stop="selectGoalDurationOption('custom')"
            >
              自定义
            </button>
          </view>
          <view v-if="goalDraft.durationOption === 'custom'" class="goal-custom-row">
            <input
              v-model="goalDraft.customDuration"
              class="goal-custom-input numeric"
              type="number"
              :maxlength="4"
              :placeholder="`${activeGoalRule.durationMin}-${activeGoalRule.durationMax}`"
              placeholder-class="placeholder"
            />
            <text>分钟</text>
          </view>
        </view>

        <view class="goal-action-bar">
          <button class="goal-action secondary" hover-class="goal-action-pressed" @click.stop="closeGoalSettingsSheet">
            取消
          </button>
          <button class="goal-action primary" :disabled="saving" hover-class="goal-action-pressed" @click.stop="saveGoalSettings">
            {{ saving ? '保存中' : '保存目标' }}
          </button>
        </view>
      </view>
    </app-sheet>

    <app-sheet
      v-if="selectedAchievementSeries"
      :title="selectedAchievementSeries.seriesName"
      close-text="关闭"
      :show-save="false"
      @close="closeAchievementDetail"
    >
      <view class="achievement-detail">
        <view class="achievement-detail-summary">
          <app-icon
            :name="selectedAchievementSeries.icon"
            :accent="getSeriesAccent(selectedAchievementSeries.category)"
            :active="selectedAchievementSeries.allCompleted"
            size="lg"
          />
          <view class="achievement-detail-copy">
            <text class="detail-title">
              已完成 {{ selectedAchievementSeries.completedLevelCount }}/{{ selectedAchievementSeries.totalLevelCount }}
              阶段
            </text>
            <text class="detail-subtitle">
              {{ selectedAchievementSeries.allCompleted ? '全部阶段已完成' : '继续冲刺下一阶段目标' }}
            </text>
          </view>
        </view>

        <view class="level-list">
          <view
            v-for="level in selectedAchievementSeries.levels"
            :key="level.key"
            class="level-row"
            :class="[
              getLevelBadgeClass(level.badge),
              {
                completed: level.completed,
                current: level.isCurrent,
                upcoming: !level.completed && !level.isCurrent,
              },
            ]"
          >
            <view class="level-marker">
              <text v-if="level.completed" class="i-carbon-checkmark-filled" />
              <text v-else class="numeric">{{ level.threshold }}</text>
            </view>
            <view class="level-copy">
              <view class="level-row-head">
                <text class="level-row-title">{{ level.title }}</text>
                <text class="level-row-state">{{ getLevelStateText(level) }}</text>
              </view>
              <text class="level-row-desc">{{ level.description }}</text>
              <view class="detail-progress-track">
                <view class="detail-progress-bar" :style="{ width: `${level.progress.percent}%` }" />
              </view>
              <text class="level-row-progress numeric">
                {{ level.progress.displayCurrent }}/{{ level.progress.target }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </app-sheet>
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  padding-right: 0;
  padding-left: 0;
}

.profile-summary-shell,
.form-section-shell,
.appearance-card-shell,
.achievement-filter-shell,
.series-grid {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
}

.profile-summary-shell {
  --profile-accent: var(--app-pink);
  --profile-accent-soft: var(--app-pink-soft);
  --profile-accent-shadow: rgba(255, 77, 134, 0.1);
}

.profile-summary-shell.accent-blue {
  --profile-accent: var(--app-blue);
  --profile-accent-soft: var(--app-blue-soft);
  --profile-accent-shadow: rgba(22, 136, 255, 0.1);
}

.profile-summary-content {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-height: 194rpx;
  padding: 30rpx;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.avatar-button {
  position: relative;
  flex: 0 0 auto;
  width: 112rpx;
  height: 112rpx;
  padding: 0;
  border: 6rpx solid var(--profile-accent-soft);
  border-radius: 50%;
  background: var(--profile-accent-soft);
  box-shadow: 0 14rpx 30rpx var(--profile-accent-shadow);
  overflow: hidden;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
  box-sizing: border-box;
}

.avatar-button-pressed {
  opacity: 0.76;
  transform: scale(0.96);
}

.avatar {
  width: 100%;
  height: 100%;
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
}

.profile-title,
.profile-subtitle {
  display: block;
}

.profile-title {
  font-size: 38rpx;
  font-weight: 840;
  line-height: 1.12;
}

.profile-subtitle {
  margin-top: 8rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
}

.profile-stats {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.profile-stat {
  min-width: 118rpx;
  padding: 12rpx 14rpx;
  border-radius: 18rpx;
  background: var(--app-fill);
  box-sizing: border-box;
}

.stat-value,
.stat-label {
  display: block;
}

.stat-value {
  color: var(--app-pink);
  font-size: 24rpx;
  font-weight: 820;
}

.profile-summary-shell.accent-blue .stat-value {
  color: var(--app-blue);
}

.stat-label {
  color: var(--app-label-secondary);
  font-size: 18rpx;
}

.stat-value {
  margin-top: 4rpx;
}

.profile-progress {
  flex: 0 0 auto;
  transform: scale(0.78);
  transform-origin: center right;
}

.form-section-content {
  overflow: hidden;
  animation: app-enter var(--app-motion-normal) 50ms var(--app-ease-out) both;
}

.field {
  display: flex;
  align-items: center;
  min-height: 106rpx;
  margin-left: 24rpx;
  padding: 0 26rpx 0 0;
  border-bottom: 1rpx solid var(--app-separator);
  box-sizing: border-box;
}

.field:last-child {
  border-bottom: 0;
}

.goal-field-button {
  width: auto;
  text-align: left;
  background: transparent;
  line-height: normal;
}

.goal-field-button::after {
  border: 0;
}

.goal-field-pressed {
  opacity: 0.76;
}

.field-chevron {
  flex: 0 0 auto;
  color: var(--app-label-tertiary);
  font-size: 28rpx;
}

.field-label {
  flex: 0 0 150rpx;
  margin-left: 18rpx;
  color: var(--app-label-primary);
  font-size: 28rpx;
  font-weight: 680;
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

.goal-settings-sheet {
  padding-top: 10rpx;
}

.goal-settings-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
  margin: 6rpx 0 18rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(34, 199, 111, 0.18);
  border-radius: 24rpx;
  color: var(--app-green);
  background: rgba(34, 199, 111, 0.08);
  font-size: 25rpx;
  font-weight: 760;
  box-sizing: border-box;
}

.goal-setting-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 12rpx 32rpx rgba(42, 111, 76, 0.06);
  box-sizing: border-box;
}

.goal-setting-title {
  display: block;
  margin-bottom: 18rpx;
  color: var(--app-label-primary);
  font-size: 26rpx;
  font-weight: 780;
}

.goal-option-grid {
  display: grid;
  gap: 14rpx;
}

.count-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.duration-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.goal-option {
  min-width: 0;
  height: 72rpx;
  padding: 0 10rpx;
  border: 2rpx solid transparent;
  border-radius: 999rpx;
  color: var(--app-label-secondary);
  background: #eef6f1;
  font-size: 22rpx;
  font-weight: 720;
  line-height: 68rpx;
  box-sizing: border-box;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out,
    border-color var(--app-motion-fast) ease-out,
    background var(--app-motion-fast) ease-out;
}

.goal-option.active {
  border-color: rgba(34, 199, 111, 0.72);
  color: var(--app-green);
  background: #ddf6e8;
}

.goal-option-pressed,
.goal-action-pressed {
  opacity: 0.82;
  transform: scale(0.97);
}

.goal-custom-row {
  display: flex;
  align-items: center;
  min-height: 82rpx;
  margin-top: 16rpx;
  padding: 0 22rpx;
  border: 2rpx solid rgba(34, 199, 111, 0.18);
  border-radius: 22rpx;
  color: var(--app-label-secondary);
  background: #f4faf6;
  font-size: 24rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.goal-custom-input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  color: var(--app-label-primary);
  font-size: 28rpx;
  font-weight: 780;
}

.goal-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 16rpx;
  padding: 14rpx 0 2rpx;
  background: linear-gradient(180deg, rgba(247, 251, 248, 0), #f7fbf8 24rpx);
}

.goal-action {
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 88rpx;
  transition:
    opacity var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) ease-out;
}

.goal-action.secondary {
  color: var(--app-label-secondary);
  background: #eaf2ed;
}

.goal-action.primary {
  color: #fff;
  background: linear-gradient(135deg, var(--app-green), var(--app-green-deep));
  box-shadow: 0 16rpx 32rpx rgba(32, 196, 107, 0.22);
}

.goal-action[disabled] {
  opacity: 0.58;
}

.appearance-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 108rpx;
  padding: 18rpx 24rpx 18rpx 28rpx;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) 70ms var(--app-ease-out) both;
}

.appearance-label {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 28rpx;
  font-weight: 680;
}

.theme-control {
  flex: 0 0 232rpx;
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

.achievement-filter-shell {
  margin-bottom: 18rpx;
}

.achievement-filter-shell :deep(.segmented-control) {
  padding: 4rpx;
  border-color: transparent;
  background: var(--app-green-soft);
}

.achievement-filter-shell :deep(.segment-button) {
  height: 52rpx;
  padding: 0 6rpx;
  color: var(--app-label-secondary);
  font-size: 19rpx;
  line-height: 52rpx;
}

.achievement-filter-shell :deep(.segment-button.active) {
  color: var(--app-label-primary);
  box-shadow: 0 5rpx 14rpx rgba(31, 88, 58, 0.075);
}

.series-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.series-grid :deep(.achievement-series-card) {
  animation: app-enter 260ms var(--app-ease-out) both;
}

.achievement-detail {
  padding: 18rpx 0 0;
}

.achievement-detail-summary {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 20rpx;
  border-radius: 24rpx;
  background: var(--app-surface);
  box-sizing: border-box;
}

.achievement-detail-copy {
  flex: 1;
  min-width: 0;
}

.detail-title,
.detail-subtitle,
.level-row-title,
.level-row-desc,
.level-row-progress {
  display: block;
}

.detail-title {
  color: var(--app-label-primary);
  font-size: 29rpx;
  font-weight: 780;
}

.detail-subtitle {
  margin-top: 6rpx;
  color: var(--app-label-secondary);
  font-size: 22rpx;
}

.level-list {
  margin-top: 18rpx;
  border-radius: 24rpx;
  background: var(--app-surface);
  overflow: hidden;
}

.level-row {
  --level-accent: var(--app-blue);
  --level-soft: var(--app-blue-soft);
  display: flex;
  gap: 18rpx;
  min-height: 132rpx;
  margin-left: 20rpx;
  padding: 22rpx 22rpx 22rpx 0;
  border-bottom: 1rpx solid var(--app-separator);
  box-sizing: border-box;
}

.level-row:last-child {
  border-bottom: 0;
}

.level-row.upcoming {
  opacity: 0.62;
}

.level-row.current {
  opacity: 1;
}

.level-marker {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  margin-top: 2rpx;
  border-radius: 18rpx;
  color: var(--level-accent);
  background: var(--level-soft);
  font-size: 21rpx;
  font-weight: 820;
}

.level-row.completed .level-marker {
  color: #fff;
  background: var(--level-accent);
}

.level-copy {
  flex: 1;
  min-width: 0;
}

.level-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.level-row-title {
  min-width: 0;
  color: var(--app-label-primary);
  font-size: 26rpx;
  font-weight: 740;
}

.level-row-state {
  flex: 0 0 auto;
  color: var(--level-accent);
  font-size: 20rpx;
  font-weight: 700;
}

.level-row-desc {
  margin-top: 6rpx;
  color: var(--app-label-secondary);
  font-size: 21rpx;
  line-height: 1.36;
}

.detail-progress-track {
  height: 8rpx;
  margin-top: 14rpx;
  border-radius: 999rpx;
  background: var(--app-fill);
  overflow: hidden;
}

.detail-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--level-accent);
}

.level-row-progress {
  margin-top: 6rpx;
  color: var(--app-label-tertiary);
  font-size: 19rpx;
  text-align: right;
}

.badge-bronze {
  --level-accent: var(--app-orange);
  --level-soft: var(--app-orange-soft);
}

.badge-silver {
  --level-accent: var(--app-blue);
  --level-soft: var(--app-blue-soft);
}

.badge-gold {
  --level-accent: var(--app-gold);
  --level-soft: var(--app-gold-soft);
}

.badge-platinum {
  --level-accent: var(--app-purple);
  --level-soft: var(--app-purple-soft);
}

.badge-diamond {
  --level-accent: var(--app-blue);
  --level-soft: var(--app-blue-soft);
}

@media screen and (max-width: 360px) {
  .profile-summary-content {
    gap: 16rpx;
    padding: 26rpx 22rpx;
  }

  .profile-progress {
    display: none;
  }

  .series-grid {
    gap: 14rpx;
  }
}
</style>

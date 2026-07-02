<script lang="ts" setup>
import type { AchievementBadge, AchievementCategory, AchievementSeriesProgress } from '@/api/achievements'
import type { GoalMode, GoalPeriod } from '@/api/types/login'
import type { ThemeMode } from '@/store'
import { getAchievements } from '@/api/achievements'
import { updateUserProfile, uploadUserAvatar } from '@/api/login'
import type { MonthlyReport } from '@/api/monthly-reports'
import { getMonthlyReport } from '@/api/monthly-reports'
import AchievementUnlockSheet from '@/components/achievement-unlock-sheet/achievement-unlock-sheet.vue'
import { useAchievementUnlockFeedback } from '@/composables/useAchievementUnlockFeedback'
import { useThemeStore, useTokenStore, useUserStore } from '@/store'
import {
  filterAchievementSeries,
  getAchievementCategoryOptions,
  getAchievementTotals,
} from '@/utils/achievement-progress'
import { triggerSuccessHaptic } from '@/utils/haptics'
import { fromWeightKg } from '@/utils/weight'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const themeStore = useThemeStore()
const {
  activeUnlockedAchievement,
  closeAchievementUnlock,
  syncAchievementUnlocks,
  unlockedAchievementQueue,
} = useAchievementUnlockFeedback()
const saving = ref(false)
const profileReady = ref(false)
const uploadingAvatar = ref(false)
const avatarTempUrl = ref('')
const achievements = ref<AchievementSeriesProgress[]>([])
const monthlyReport = ref<MonthlyReport | null>(null)
const profileDetailsExpanded = ref(false)
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
  { label: '不设置', value: 'none' as const },
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
    countOptions: [1, 2, 3, 4, 5, 7, 10, 14],
    durationOptions: [30, 60, 120, 180, 300, 600, 900, 1500],
  },
  month: {
    countMin: 1,
    countMax: 60,
    durationMin: 100,
    durationMax: 6000,
    defaultCount: 20,
    defaultDuration: 800,
    countOptions: [4, 8, 12, 16, 20, 30, 45, 60],
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
  goalPeriod: 'none' as GoalPeriod,
  goalMode: 'count' as GoalMode,
  goalCount: goalRules.week.defaultCount,
  goalDuration: goalRules.week.defaultDuration,
  heightCm: '',
})
const goalDraft = reactive({
  period: 'none' as GoalPeriod,
  mode: 'count' as GoalMode,
  countOption: goalRules.week.defaultCount as number | 'custom',
  countGoal: goalRules.week.defaultCount,
  customCount: '',
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
const profileAccent = computed(() => (form.gender === 'female' ? 'pink' : 'blue'))
const genderFieldIcon = computed(() => (form.gender === 'female' ? 'i-carbon-gender-female' : 'i-carbon-gender-male'))
const genderFieldAccent = computed(() => (form.gender === 'female' ? 'pink' : 'blue'))
const profileBriefText = computed(() => {
  const birthday = form.birthday || '生日未设置'
  const height = form.heightCm ? `${form.heightCm} cm` : '身高未设置'
  return `${genderLabel.value} · ${birthday} · ${height}`
})
const currentReportMonth = computed(() => getMonthKey(new Date()))
const monthlyReportTitle = computed(() => {
  const [year, month] = currentReportMonth.value.split('-')
  return `${year}年${Number(month)}月报`
})
const monthlyCheckinDays = computed(() => monthlyReport.value?.checkin.days || 0)
const monthlyCheckinCount = computed(() => monthlyReport.value?.checkin.count || 0)
const monthlyWeightRecordCount = computed(() => monthlyReport.value?.weight.recordCount || 0)
const monthlyDurationText = computed(() => formatDuration(monthlyReport.value?.checkin.durationMinutes || 0))
const monthlyWeightChangeText = computed(() => {
  const report = monthlyReport.value
  if (!report || report.weight.changeKg === null) {
    return '待记录'
  }
  const value = fromWeightKg(Math.abs(report.weight.changeKg), report.weight.weightUnit).toFixed(1)
  const sign = report.weight.changeKg > 0 ? '+' : report.weight.changeKg < 0 ? '-' : ''
  return `${sign}${value} ${report.weight.weightUnit === 'jin' ? '斤' : 'kg'}`
})
const monthlyReportSummary = computed(() => {
  const report = monthlyReport.value
  if (!report || (report.checkin.days === 0 && report.weight.recordCount === 0)) {
    return '本月还没有足够数据，完成打卡或记录体重后自动生成总结'
  }
  const checkinText =
    report.checkin.days > 0
      ? `已运动 ${report.checkin.days} 天，累计 ${formatDuration(report.checkin.durationMinutes)}`
      : '本月还未打卡'
  const weightText =
    report.weight.changeKg === null ? '体重变化待记录' : `体重变化 ${monthlyWeightChangeText.value}`
  return `${checkinText} · ${weightText}`
})
const monthlyWeightChangeTone = computed(() => {
  const change = monthlyReport.value?.weight.changeKg
  if (change === null || change === undefined || change === 0) {
    return 'neutral'
  }
  return change < 0 ? 'down' : 'up'
})
const achievementCategoryOptions = computed(() => getAchievementCategoryOptions(achievements.value))
const filteredAchievementSeries = computed(() =>
  filterAchievementSeries(achievements.value, selectedAchievementCategory.value),
)
const goalSummary = computed(() =>
  formatGoalSummary(form.goalPeriod, form.goalMode, form.goalCount, form.goalDuration),
)
const draftGoalSummary = computed(() => {
  if (goalDraft.period === 'none') {
    return '未设置'
  }
  const count = getDraftCountGoal()
  const duration =
    typeof goalDraft.durationOption === 'number'
      ? goalDraft.durationOption
      : Number(goalDraft.customDuration.trim()) || form.goalDuration
  return formatGoalSummary(goalDraft.period, goalDraft.mode, count, duration)
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
function getActiveGoalPeriod(period: GoalPeriod) {
  return period === 'month' ? 'month' : 'week'
}

const goalEnabled = computed(() => goalDraft.period !== 'none')
const activeGoalRule = computed(() => goalRules[getActiveGoalPeriod(goalDraft.period)])
const countGoalOptions = computed(() => activeGoalRule.value.countOptions)
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
  const [nextAchievements, nextMonthlyReport] = await Promise.all([
    getAchievements(),
    getMonthlyReport(currentReportMonth.value),
  ])
  const userInfo = userStore.userInfo
  form.nickname = userInfo.nickname || ''
  form.avatarUrl = userInfo.avatarUrl || userInfo.avatar || ''
  form.gender = userInfo.gender || ''
  form.birthday = userInfo.birthday || ''
  form.goalPeriod = userInfo.goalPeriod || 'none'
  form.goalMode = userInfo.goalMode || 'count'
  const rule = goalRules[getActiveGoalPeriod(form.goalPeriod)]
  form.goalCount = userInfo.goalCount || rule.defaultCount
  form.goalDuration = userInfo.goalDuration || rule.defaultDuration
  form.heightCm = userInfo.heightCm ? String(userInfo.heightCm) : ''
  achievements.value = nextAchievements
  monthlyReport.value = nextMonthlyReport
  await syncAchievementUnlocks(false, nextAchievements)
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

function getMonthKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分钟`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

function formatGoalSummary(period: GoalPeriod, mode: GoalMode, countGoal: number, durationGoal: number) {
  if (period === 'none') {
    return '未设置'
  }
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
  const rule = goalRules[getActiveGoalPeriod(goalDraft.period)]
  goalDraft.mode = form.goalMode
  goalDraft.countGoal = Math.min(rule.countMax, Math.max(rule.countMin, form.goalCount))
  goalDraft.countOption = rule.countOptions.includes(goalDraft.countGoal) ? goalDraft.countGoal : 'custom'
  goalDraft.customCount = goalDraft.countOption === 'custom' ? String(goalDraft.countGoal) : ''
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
  if (period === 'none') {
    return
  }
  const rule = goalRules[period]
  goalDraft.countOption = rule.defaultCount
  goalDraft.countGoal = rule.defaultCount
  goalDraft.customCount = ''
  goalDraft.durationOption = rule.defaultDuration
  goalDraft.customDuration = ''
}

function selectGoalMode(mode: GoalMode) {
  goalDraft.mode = mode
}

function selectGoalCountOption(value: number | 'custom') {
  goalDraft.countOption = value
  if (value === 'custom') {
    goalDraft.customCount = ''
    return
  }
  goalDraft.countGoal = value
  goalDraft.customCount = ''
}

function selectGoalDurationOption(value: number | 'custom') {
  goalDraft.durationOption = value
  if (value !== 'custom') {
    goalDraft.customDuration = ''
  }
}

function getDraftCountGoal() {
  if (typeof goalDraft.countOption === 'number') {
    return goalDraft.countOption
  }
  return Number(goalDraft.customCount.trim()) || form.goalCount
}

function resolveGoalCount() {
  if (typeof goalDraft.countOption === 'number') {
    return goalDraft.countOption
  }
  const value = goalDraft.customCount.trim()
  if (!value || !/^\d+$/.test(value)) {
    uni.showToast({ title: '请输入有效打卡次数', icon: 'none' })
    return null
  }
  const count = Number(value)
  const rule = activeGoalRule.value
  if (count < rule.countMin || count > rule.countMax) {
    uni.showToast({ title: `打卡次数需为 ${rule.countMin}-${rule.countMax} 次`, icon: 'none' })
    return null
  }
  return count
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
  if (goalDraft.period === 'none') {
    form.goalPeriod = 'none'
    goalSheetOpen.value = false
    const unlockedCount = await saveProfile()
    if (unlockedCount === 0) {
      uni.showToast({ title: '目标设置已关闭', icon: 'success' })
    }
    return
  }
  const rule = activeGoalRule.value
  const countGoal =
    goalDraft.mode === 'count' || goalDraft.mode === 'both'
      ? resolveGoalCount()
      : typeof goalDraft.countOption === 'number'
        ? goalDraft.countOption
        : rule.defaultCount
  const durationGoal =
    goalDraft.mode === 'duration' || goalDraft.mode === 'both'
      ? resolveGoalDuration()
      : typeof goalDraft.durationOption === 'number'
        ? goalDraft.durationOption
        : rule.defaultDuration
  if (!countGoal || !durationGoal) {
    return
  }
  form.goalPeriod = goalDraft.period
  form.goalMode = goalDraft.mode
  form.goalCount = countGoal
  form.goalDuration = durationGoal
  goalSheetOpen.value = false
  const unlockedCount = await saveProfile()
  if (unlockedCount === 0) {
    uni.showToast({ title: '目标设置已更新', icon: 'success' })
  }
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

async function refreshAchievements(shouldNotify = false) {
  const nextAchievements = await getAchievements()
  achievements.value = nextAchievements
  return syncAchievementUnlocks(shouldNotify, nextAchievements)
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
    const unlockedCount = await saveProfile()
    if (unlockedCount === 0) {
      uni.showToast({
        title: '头像已更新',
        icon: 'success',
      })
    }
  } finally {
    uploadingAvatar.value = false
  }
}

async function saveProfile() {
  if (!profileReady.value || saving.value) {
    return 0
  }
  if (!form.nickname.trim()) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none',
    })
    return 0
  }

  const heightCm = form.heightCm === '' ? null : Number(form.heightCm)
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
    uni.showToast({
      title: '请输入 100-250 cm 的身高',
      icon: 'none',
    })
    return 0
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
    const unlockedCount = await refreshAchievements(true)
    triggerSuccessHaptic()
    return unlockedCount
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
                <text class="stat-label">本月运动</text>
                <text class="stat-value numeric">{{ monthlyCheckinDays }} 天</text>
              </view>
            </view>
          </view>

          <view class="profile-progress">
            <progress-ring :percent="completionPercent" label="成就" :accent="profileAccent" />
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">目标</text>
    <view class="goal-card-shell">
      <app-card accent="green">
        <button class="goal-card-button" hover-class="goal-card-pressed" @click="openGoalSettingsSheet">
          <app-icon name="target" accent="green" size="md" active />
          <view class="goal-card-copy">
            <text class="goal-card-title">目标设置</text>
            <text class="goal-card-desc">{{ goalSummary }}</text>
          </view>
          <text class="goal-card-action">调整</text>
          <text class="field-chevron i-carbon-chevron-right" />
        </button>
      </app-card>
    </view>

    <text class="ios-section-title">个人资料</text>
    <view class="form-section-shell">
      <app-card accent="blue">
        <button
          class="profile-folder-button"
          hover-class="profile-folder-pressed"
          @click="profileDetailsExpanded = !profileDetailsExpanded"
        >
          <app-icon name="profile" accent="blue" size="md" active />
          <view class="profile-folder-copy">
            <text class="profile-folder-title">资料信息</text>
            <text class="profile-folder-desc">{{ profileBriefText }}</text>
          </view>
          <text class="profile-folder-action">{{ profileDetailsExpanded ? '收起' : '编辑' }}</text>
          <text class="profile-folder-chevron i-carbon-chevron-down" :class="{ expanded: profileDetailsExpanded }" />
        </button>

        <view v-if="profileDetailsExpanded" class="form-section-content">
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
              <app-icon :name="genderFieldIcon" :accent="genderFieldAccent" size="sm" />
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

    <text class="ios-section-title">月报</text>
    <view class="monthly-report-shell">
      <app-card accent="green" elevated>
        <view class="monthly-report-card">
          <view class="monthly-report-head">
            <view>
              <text class="monthly-report-title">{{ monthlyReportTitle }}</text>
              <text class="monthly-report-summary">{{ monthlyReportSummary }}</text>
            </view>
            <app-icon name="badge" accent="green" size="lg" active />
          </view>

          <view class="monthly-report-grid">
            <view class="monthly-report-metric">
              <app-icon name="checkin" accent="green" size="sm" />
              <text class="report-metric-label">打卡天数</text>
              <text class="report-metric-value numeric">{{ monthlyCheckinDays }} 天</text>
              <text class="report-metric-note numeric">共 {{ monthlyCheckinCount }} 次</text>
            </view>
            <view class="monthly-report-metric">
              <app-icon name="i-carbon-time" accent="orange" size="sm" />
              <text class="report-metric-label">运动时长</text>
              <text class="report-metric-value numeric">{{ monthlyDurationText }}</text>
              <text class="report-metric-note">本月累计</text>
            </view>
            <view class="monthly-report-metric">
              <app-icon name="weight" accent="blue" size="sm" />
              <text class="report-metric-label">体重变化</text>
              <text class="report-metric-value numeric" :class="`tone-${monthlyWeightChangeTone}`">
                {{ monthlyWeightChangeText }}
              </text>
              <text class="report-metric-note numeric">记录 {{ monthlyWeightRecordCount }} 次</text>
            </view>
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
        <scroll-view class="goal-settings-scroll" scroll-y enhanced show-scrollbar>
          <view class="goal-settings-content">
            <view class="goal-settings-summary">
              <text>当前设置</text>
              <text class="numeric">{{ draftGoalSummary }}</text>
            </view>

            <view class="goal-setting-card">
              <text class="goal-setting-title">目标周期</text>
              <app-segmented-control :model-value="goalDraft.period" :options="goalPeriodOptions" @change="selectGoalPeriod" />
            </view>

            <view v-if="goalEnabled" class="goal-setting-card">
              <text class="goal-setting-title">目标模式</text>
              <app-segmented-control :model-value="goalDraft.mode" :options="goalModeOptions" @change="selectGoalMode" />
            </view>

            <view v-if="goalEnabled && (goalDraft.mode === 'count' || goalDraft.mode === 'both')" class="goal-setting-card">
              <text class="goal-setting-title">打卡次数</text>
              <view class="goal-option-grid option-grid cols-5 count-grid">
                <button
                  v-for="count in countGoalOptions"
                  :key="count"
                  class="goal-option option-pill"
                  :class="{ active: goalDraft.countOption === count }"
                  hover-class="option-pill-pressed"
                  @click.stop="selectGoalCountOption(count)"
                >
                  {{ count }} 次
                </button>
                <button
                  class="goal-option option-pill"
                  :class="{ active: goalDraft.countOption === 'custom' }"
                  hover-class="option-pill-pressed"
                  @click.stop="selectGoalCountOption('custom')"
                >
                  自定义
                </button>
              </view>
              <view v-if="goalDraft.countOption === 'custom'" class="goal-custom-row">
                <input
                  v-model="goalDraft.customCount"
                  class="goal-custom-input numeric"
                  type="number"
                  :maxlength="2"
                  :placeholder="`${activeGoalRule.countMin}-${activeGoalRule.countMax}`"
                  placeholder-class="placeholder"
                />
                <text>次</text>
              </view>
            </view>

            <view v-if="goalEnabled && (goalDraft.mode === 'duration' || goalDraft.mode === 'both')" class="goal-setting-card">
              <text class="goal-setting-title">运动时长</text>
              <view class="goal-option-grid option-grid cols-3 duration-grid">
                <button
                  v-for="minutes in durationGoalOptions"
                  :key="minutes"
                  class="goal-option option-pill"
                  :class="{ active: goalDraft.durationOption === minutes }"
                  hover-class="option-pill-pressed"
                  @click.stop="selectGoalDurationOption(minutes)"
                >
                  {{ minutes }} 分钟
                </button>
                <button
                  class="goal-option option-pill"
                  :class="{ active: goalDraft.durationOption === 'custom' }"
                  hover-class="option-pill-pressed"
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
          </view>
        </scroll-view>

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

    <achievement-unlock-sheet
      v-if="activeUnlockedAchievement"
      :achievement="activeUnlockedAchievement"
      :remaining-count="Math.max(unlockedAchievementQueue.length - 1, 0)"
      @close="closeAchievementUnlock"
    />
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  padding-right: 0;
  padding-left: 0;
}

.profile-summary-shell,
.goal-card-shell,
.form-section-shell,
.appearance-card-shell,
.monthly-report-shell,
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

.goal-card-button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 116rpx;
  padding: 24rpx 28rpx;
  border-radius: var(--app-card-radius);
  color: var(--app-label-primary);
  background: transparent;
  text-align: left;
  line-height: normal;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) 35ms var(--app-ease-out) both;
}

.goal-card-button::after {
  border: 0;
}

.goal-card-pressed {
  opacity: 0.82;
  transform: scale(0.985);
}

.goal-card-copy {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.goal-card-title,
.goal-card-desc {
  display: block;
}

.goal-card-title {
  color: var(--app-label-primary);
  font-size: 29rpx;
  font-weight: 780;
}

.goal-card-desc {
  margin-top: 6rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  font-weight: 650;
  line-height: 1.3;
}

.goal-card-action {
  flex: 0 0 auto;
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: var(--app-green);
  background: var(--app-green-soft);
  font-size: 22rpx;
  font-weight: 780;
}

.monthly-report-card {
  position: relative;
  padding: 30rpx;
  overflow: hidden;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) 80ms var(--app-ease-out) both;
}

.monthly-report-card::before {
  position: absolute;
  top: -110rpx;
  right: -72rpx;
  width: 250rpx;
  height: 250rpx;
  border-radius: 50%;
  background: var(--app-green-soft);
  content: '';
}

.monthly-report-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
}

.monthly-report-title,
.monthly-report-summary,
.report-metric-label,
.report-metric-value,
.report-metric-note {
  display: block;
}

.monthly-report-title {
  color: var(--app-label-primary);
  font-size: 34rpx;
  font-weight: 840;
  line-height: 1.18;
}

.monthly-report-summary {
  margin-top: 10rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  font-weight: 620;
  line-height: 1.42;
}

.monthly-report-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 26rpx;
}

.monthly-report-metric {
  min-width: 0;
  padding: 18rpx 14rpx;
  border: 1rpx solid var(--app-separator);
  border-radius: 22rpx;
  background: var(--app-fill);
  box-sizing: border-box;
}

.report-metric-label {
  margin-top: 12rpx;
  color: var(--app-label-secondary);
  font-size: 20rpx;
  font-weight: 700;
}

.report-metric-value {
  margin-top: 8rpx;
  color: var(--app-label-primary);
  font-size: 25rpx;
  font-weight: 840;
  line-height: 1.22;
}

.report-metric-value.tone-down {
  color: var(--app-green);
}

.report-metric-value.tone-up {
  color: var(--app-orange);
}

.report-metric-note {
  margin-top: 6rpx;
  color: var(--app-label-tertiary);
  font-size: 18rpx;
  font-weight: 650;
  line-height: 1.25;
}

.profile-folder-button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 116rpx;
  padding: 24rpx 28rpx;
  border-radius: var(--app-card-radius);
  color: var(--app-label-primary);
  background: transparent;
  text-align: left;
  line-height: normal;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) 50ms var(--app-ease-out) both;
}

.profile-folder-button::after {
  border: 0;
}

.profile-folder-pressed {
  opacity: 0.82;
  transform: scale(0.985);
}

.profile-folder-copy {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.profile-folder-title,
.profile-folder-desc {
  display: block;
}

.profile-folder-title {
  color: var(--app-label-primary);
  font-size: 29rpx;
  font-weight: 780;
}

.profile-folder-desc {
  margin-top: 6rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  font-weight: 650;
  line-height: 1.3;
}

.profile-folder-action {
  flex: 0 0 auto;
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 22rpx;
  font-weight: 780;
}

.profile-folder-chevron {
  flex: 0 0 auto;
  margin-left: 8rpx;
  color: var(--app-label-tertiary);
  font-size: 28rpx;
  transition: transform var(--app-motion-fast) var(--app-ease-out);
}

.profile-folder-chevron.expanded {
  transform: rotate(180deg);
}

.form-section-content {
  border-top: 1rpx solid var(--app-separator);
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 10rpx;
}

.goal-settings-scroll {
  height: calc(72vh - 230rpx - env(safe-area-inset-bottom));
  max-height: 860rpx;
  min-height: 420rpx;
}

.goal-settings-content {
  padding-bottom: 14rpx;
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
  width: 100%;
}

.goal-option {
  font-size: 22rpx;
}

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
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 16rpx;
  flex: 0 0 auto;
  padding: 16rpx 0 2rpx;
  background: #f7fbf8;
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
  font-size: 19rpx;
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

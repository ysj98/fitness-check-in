<script lang="ts" setup>
import type { BackfillReason, CheckInRecord, CheckInStatsRes, MonthCheckInRes, SportType } from '@/api/checkins'
import {
  createBackfillCheckIn,
  createCheckIn,
  deleteCheckIn,
  getCheckInStats,
  getMonthCheckIns,
  getRecentCheckIns,
  getTodayCheckIns,
} from '@/api/checkins'
import AchievementUnlockSheet from '@/components/achievement-unlock-sheet/achievement-unlock-sheet.vue'
import { useAchievementUnlockFeedback } from '@/composables/useAchievementUnlockFeedback'
import { useTokenStore } from '@/store'
import { triggerSuccessHaptic } from '@/utils/haptics'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '运动打卡',
  },
})

interface CalendarDay {
  key: string
  day: number
  count: number
  isToday: boolean
  isFuture: boolean
  isBackfilled: boolean
  canBackfill: boolean
  disabledReason: string
}

interface RecentDaySummary {
  key: string
  label: string
  count: number
  durationMinutes: number
  contentText: string
  sideText: string
  isToday: boolean
  isBackfilled: boolean
  canBackfill: boolean
}

interface RecordTouchStart {
  id: number
  x: number
  y: number
}

interface CheckInPreference {
  sportType: SportType
  durationMinutes: number
}

const emptyStats: CheckInStatsRes = {
  currentStreak: 0,
  totalCount: 0,
  todayCount: 0,
  todayDurationMinutes: 0,
  goalCount: 0,
  goalDurationMinutes: 0,
  goalProgress: null,
  goalCompleted: false,
  badges: [],
}

const tokenStore = useTokenStore()
const {
  activeUnlockedAchievement,
  closeAchievementUnlock,
  syncAchievementUnlocks,
  unlockedAchievementQueue,
} = useAchievementUnlockFeedback()
const loading = ref(false)
const checking = ref(false)
const loginReady = ref(false)
const successPulse = ref(false)
const pageReady = ref(false)
const selectedMonth = ref(new Date())
const selectedDateKey = ref(formatDateKey(new Date()))
const recentExpanded = ref(false)
const activeRecordActionId = ref<number | null>(null)
const recordTouchStart = ref<RecordTouchStart | null>(null)
const checkInSheetOpen = ref(false)
const selectedSportType = ref<SportType>('散步')
const selectedDurationOption = ref<number | 'custom'>(30)
const customDuration = ref('')
const backfillSheetOpen = ref(false)
const backfilling = ref(false)
const selectedBackfillDateKey = ref('')
const selectedBackfillReason = ref<BackfillReason>('忘记打卡')
const selectedBackfillSportType = ref<SportType>('散步')
const selectedBackfillDurationOption = ref<number | 'custom'>(30)
const customBackfillDuration = ref('')
const selectedBackfillQuota = ref({ used: 0, limit: 3 })
const todayCount = ref(0)
const todayRecords = ref<CheckInRecord[]>([])
const recentRecords = ref<CheckInRecord[]>([])
const monthStats = ref<MonthCheckInRes>({
  month: getMonthKey(),
  days: {},
  backfillDays: {},
  backfillUsed: 0,
  backfillLimit: 3,
})
const checkInStats = ref<CheckInStatsRes>({ ...emptyStats })
const weekLabels = ['一', '二', '三', '四', '五', '六', '日']
const sportTypes: SportType[] = ['散步', '跑步', '健身', '骑行', '游泳', '瑜伽', '其他']
const durationOptions = [15, 30, 45, 60, 90]
const backfillReasons: BackfillReason[] = ['忘记打卡', '已运动未记录', '其他']
const checkInPreferenceStorageKey = 'checkin-preference'

const todayLabel = computed(() => {
  const date = new Date()
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekMap[date.getDay()]}`
})

const monthKey = computed(() => getMonthKey(selectedMonth.value))
const monthTitle = computed(() => {
  const [year, month] = monthStats.value.month.split('-')
  return `${year}年${Number(month)}月`
})

const calendarDays = computed<CalendarDay[]>(() => {
  const [year, month] = monthStats.value.month.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayKey = formatDateKey(new Date())
  const todayStart = parseDateKey(todayKey)

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const key = `${year}-${pad(month)}-${pad(day)}`
    const date = parseDateKey(key)
    const count = monthStats.value.days[key] || 0
    const disabledReason = getBackfillDisabledReason(key, count)
    return {
      key,
      day,
      count,
      isToday: key === todayKey,
      isFuture: date > todayStart,
      isBackfilled: (monthStats.value.backfillDays[key] || 0) > 0,
      canBackfill: disabledReason === '',
      disabledReason,
    }
  })
})

const calendarStartOffset = computed(() => {
  const [year, month] = monthStats.value.month.split('-').map(Number)
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
})

const checkInButtonText = computed(() => {
  if (checking.value) {
    return '打卡中...'
  }
  if (successPulse.value) {
    return '打卡成功'
  }
  return checkInStats.value.goalProgress?.completed ? '继续打卡' : '立即打卡'
})

const checkInSummaryText = computed(() => {
  return `今天 ${todayTotalDuration.value} 分钟，已打卡 ${todayCount.value} 次，连续坚持 ${checkInStats.value.currentStreak} 天`
})

const targetGoalProgress = computed(() => checkInStats.value.goalProgress)

const targetGoalTitle = computed(() => (targetGoalProgress.value?.period === 'month' ? '本月目标' : '本周目标'))

const targetGoalStatusText = computed(() => {
  const progress = targetGoalProgress.value
  if (!progress) {
    return ''
  }
  if (progress.completed) {
    return `${targetGoalTitle.value}已达成`
  }
  if (progress.mode === 'count') {
    return `还差 ${Math.max(progress.count.target - progress.count.current, 0)} 次`
  }
  if (progress.mode === 'duration') {
    return `还差 ${Math.max(progress.duration.target - progress.duration.current, 0)} 分钟`
  }
  const countLeft = Math.max(progress.count.target - progress.count.current, 0)
  const durationLeft = Math.max(progress.duration.target - progress.duration.current, 0)
  return countLeft > 0 && durationLeft > 0
    ? `还差 ${countLeft} 次 · ${durationLeft} 分钟`
    : countLeft > 0
      ? `还差 ${countLeft} 次`
      : `还差 ${durationLeft} 分钟`
})

const targetGoalCompletedText = computed(() => {
  const progress = targetGoalProgress.value
  if (!progress) {
    return ''
  }
  if (progress.mode === 'count') {
    return `已完成 ${progress.count.current}/${progress.count.target} 次`
  }
  if (progress.mode === 'duration') {
    return `已完成 ${progress.duration.current}/${progress.duration.target} 分钟`
  }
  return `已完成 ${progress.count.current}/${progress.count.target} 次 · ${progress.duration.current}/${progress.duration.target} 分钟`
})

const todayTotalDuration = computed(() =>
  todayRecords.value.reduce((total, record) => total + record.durationMinutes, 0),
)

const recentDaySummaries = computed<RecentDaySummary[]>(() => {
  const recordMap = recentRecords.value.reduce<Record<string, CheckInRecord[]>>((result, record) => {
    const key = formatDateKey(new Date(record.checkedAt))
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(record)
    return result
  }, {})
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    const key = formatDateKey(date)
    const records = (recordMap[key] || []).sort(
      (left, right) => new Date(right.checkedAt).getTime() - new Date(left.checkedAt).getTime(),
    )
    const count = records.length
    const durationMinutes = records.reduce((total, record) => total + record.durationMinutes, 0)
    return {
      key,
      label: index === 0 ? '今天' : `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
      count,
      durationMinutes,
      contentText: formatRecentDayContent(records, durationMinutes),
      sideText: formatRecentDaySide(records.length, durationMinutes),
      isToday: index === 0,
      isBackfilled: records.some((record) => record.isBackfill),
      canBackfill: getBackfillDisabledReason(key, count, monthStats.value, false) === '',
    }
  })
})

const visibleRecentDaySummaries = computed(() => {
  return recentExpanded.value ? recentDaySummaries.value : recentDaySummaries.value.slice(0, 3)
})

const selectedCalendarDay = computed(() => calendarDays.value.find((day) => day.key === selectedDateKey.value))
const selectedCalendarHint = computed(() => {
  const day = selectedCalendarDay.value
  if (!day) {
    return ''
  }
  if (day.count > 0) {
    return `${formatDateText(day.key)} 已打卡 ${day.count} 次${day.isBackfilled ? '，含补签记录' : ''}`
  }
  if (day.isToday) {
    return `${formatDateText(day.key)} 今天请使用正常打卡`
  }
  if (day.canBackfill) {
    return `${formatDateText(day.key)} 可补签`
  }
  return `${formatDateText(day.key)} ${day.disabledReason}`
})
const backfillQuotaText = computed(() => `${monthStats.value.backfillUsed}/${monthStats.value.backfillLimit}`)
const selectedBackfillDateText = computed(() =>
  selectedBackfillDateKey.value ? formatDateText(selectedBackfillDateKey.value) : '',
)
const selectedBackfillQuotaText = computed(
  () => `${selectedBackfillQuota.value.used}/${selectedBackfillQuota.value.limit}`,
)
const selectedCheckInDurationText = computed(() =>
  formatSelectedDuration(selectedDurationOption.value, customDuration.value),
)
const selectedBackfillDurationText = computed(() =>
  formatSelectedDuration(selectedBackfillDurationOption.value, customBackfillDuration.value),
)
const checkInSheetSummary = computed(() =>
  `已选：${selectedSportType.value} · ${selectedCheckInDurationText.value}`,
)
const backfillSheetSummary = computed(() =>
  `已选：${selectedBackfillSportType.value} · ${selectedBackfillDurationText.value}`,
)

onLoad(() => {
  initPage()
  setTimeout(() => {
    pageReady.value = true
  }, 40)
})

onShow(() => {
  if (loginReady.value) {
    loadDashboard()
    syncAchievementUnlocks(false)
  }
})

async function initPage() {
  loading.value = true
  try {
    await ensureLogin()
    await Promise.all([loadDashboard(), syncAchievementUnlocks(false)])
  } catch {
    uni.showToast({ title: '数据加载失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function ensureLogin() {
  if (tokenStore.hasLogin()) {
    loginReady.value = true
    return
  }

  await tokenStore.wxLogin()
  loginReady.value = true
}

async function loadDashboard() {
  const [today, recent, month, stats] = await Promise.all([
    getTodayCheckIns(),
    getRecentCheckIns(100),
    getMonthCheckIns(monthKey.value),
    getCheckInStats(),
  ])

  todayCount.value = today.count
  todayRecords.value = today.records
  recentRecords.value = recent
  monthStats.value = month
  checkInStats.value = stats
}

async function loadMonth() {
  monthStats.value = await getMonthCheckIns(monthKey.value)
}

async function changeMonth(offset: number) {
  const current = selectedMonth.value
  selectedMonth.value = new Date(current.getFullYear(), current.getMonth() + offset, 1)
  await loadMonth()
}

async function backToCurrentMonth() {
  selectedMonth.value = new Date()
  await loadMonth()
}

function openCheckInSheet() {
  if (checking.value) {
    return
  }

  const preference = getStoredCheckInPreference()
  selectedSportType.value = preference.sportType
  selectedDurationOption.value = durationOptions.includes(preference.durationMinutes)
    ? preference.durationMinutes
    : 'custom'
  customDuration.value = selectedDurationOption.value === 'custom' ? String(preference.durationMinutes) : ''
  checkInSheetOpen.value = true
}

function getStoredCheckInPreference(): CheckInPreference {
  const fallback: CheckInPreference = {
    sportType: '散步',
    durationMinutes: 30,
  }

  try {
    const preference = uni.getStorageSync(checkInPreferenceStorageKey) as Partial<CheckInPreference> | null
    if (
      preference &&
      sportTypes.includes(preference.sportType as SportType) &&
      Number.isInteger(preference.durationMinutes) &&
      Number(preference.durationMinutes) >= 1 &&
      Number(preference.durationMinutes) <= 300
    ) {
      return {
        sportType: preference.sportType as SportType,
        durationMinutes: Number(preference.durationMinutes),
      }
    }
  } catch {
    return fallback
  }

  return fallback
}

function saveCheckInPreference(sportType: SportType, durationMinutes: number) {
  try {
    uni.setStorageSync(checkInPreferenceStorageKey, {
      sportType,
      durationMinutes,
    })
  } catch {
    // Local preference is a convenience only; check-in should still succeed.
  }
}

function closeCheckInSheet() {
  if (checking.value) {
    return
  }
  checkInSheetOpen.value = false
}

function selectDurationOption(value: number | 'custom') {
  selectedDurationOption.value = value
  if (value !== 'custom') {
    customDuration.value = ''
  }
}

function selectBackfillDurationOption(value: number | 'custom') {
  selectedBackfillDurationOption.value = value
  if (value !== 'custom') {
    customBackfillDuration.value = ''
  }
}

function resolveDurationMinutes(option: number | 'custom', customValue: string) {
  if (typeof option === 'number') {
    return option
  }

  const value = customValue.trim()
  if (!value) {
    uni.showToast({ title: '请输入运动时长', icon: 'none' })
    return null
  }
  if (!/^\d+$/.test(value)) {
    uni.showToast({ title: '请输入有效运动时长', icon: 'none' })
    return null
  }

  const minutes = Number(value)
  if (minutes < 1 || minutes > 300) {
    uni.showToast({ title: '运动时长需为 1-300 分钟', icon: 'none' })
    return null
  }
  return minutes
}

function formatSelectedDuration(option: number | 'custom', customValue: string) {
  if (typeof option === 'number') {
    return `${option} 分钟`
  }

  const value = customValue.trim()
  return value ? `${value} 分钟` : '自定义时长'
}

async function handleConfirmCheckIn() {
  if (checking.value) {
    return
  }

  const durationMinutes = resolveDurationMinutes(selectedDurationOption.value, customDuration.value)
  if (!durationMinutes) {
    return
  }

  checking.value = true
  try {
    await ensureLogin()
    await createCheckIn({
      sportType: selectedSportType.value,
      durationMinutes,
    })
    saveCheckInPreference(selectedSportType.value, durationMinutes)
    successPulse.value = false
    await nextTick()
    successPulse.value = true
    checkInSheetOpen.value = false
    await loadDashboard()
    const unlockedCount = await syncAchievementUnlocks(true)
    triggerSuccessHaptic()
    if (unlockedCount === 0) {
      uni.showToast({
        title: checkInStats.value.goalCompleted ? '目标达成' : '打卡成功',
        icon: 'success',
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '打卡失败，请重试'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    checking.value = false
    setTimeout(() => {
      successPulse.value = false
    }, 420)
  }
}

async function handleDelete(record: CheckInRecord) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认删除这条打卡记录吗？',
      content: '删除后无法恢复',
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#ff5a6e',
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) {
    return
  }

  await deleteCheckIn(record.id)
  activeRecordActionId.value = null
  todayRecords.value = todayRecords.value.filter((item) => item.id !== record.id)
  recentRecords.value = recentRecords.value.filter((item) => item.id !== record.id)
  todayCount.value = Math.max(0, todayCount.value - 1)
  const [month, stats] = await Promise.all([getMonthCheckIns(monthKey.value), getCheckInStats()])
  monthStats.value = month
  checkInStats.value = stats
  uni.showToast({
    title: '已删除',
    icon: 'none',
  })
}

async function selectCalendarDay(day: CalendarDay) {
  selectedDateKey.value = day.key

  if (day.isToday || day.count > 0) {
    return
  }

  if (!day.canBackfill) {
    uni.showToast({ title: day.disabledReason, icon: 'none' })
    return
  }

  await openBackfillSheet(day.key)
}

async function openBackfillSheet(dateKey: string) {
  const targetMonth = dateKey.slice(0, 7)
  let targetMonthStats = monthStats.value

  if (targetMonth !== monthStats.value.month) {
    targetMonthStats = await getMonthCheckIns(targetMonth)
  }

  const disabledReason = getBackfillDisabledReason(dateKey, targetMonthStats.days[dateKey] || 0, targetMonthStats)
  if (disabledReason) {
    uni.showToast({ title: disabledReason, icon: 'none' })
    return
  }

  selectedBackfillDateKey.value = dateKey
  selectedBackfillReason.value = '忘记打卡'
  const preference = getStoredCheckInPreference()
  selectedBackfillSportType.value = preference.sportType
  selectedBackfillDurationOption.value = durationOptions.includes(preference.durationMinutes)
    ? preference.durationMinutes
    : 'custom'
  customBackfillDuration.value =
    selectedBackfillDurationOption.value === 'custom' ? String(preference.durationMinutes) : ''
  selectedBackfillQuota.value = {
    used: targetMonthStats.backfillUsed,
    limit: targetMonthStats.backfillLimit,
  }
  backfillSheetOpen.value = true
}

function closeBackfillSheet() {
  if (backfilling.value) {
    return
  }
  backfillSheetOpen.value = false
}

async function handleConfirmBackfill() {
  if (!selectedBackfillDateKey.value || backfilling.value) {
    return
  }

  const durationMinutes = resolveDurationMinutes(selectedBackfillDurationOption.value, customBackfillDuration.value)
  if (!durationMinutes) {
    return
  }

  backfilling.value = true
  try {
    const dateKey = selectedBackfillDateKey.value
    await createBackfillCheckIn({
      date: dateKey,
      reason: selectedBackfillReason.value,
      sportType: selectedBackfillSportType.value,
      durationMinutes,
    })
    saveCheckInPreference(selectedBackfillSportType.value, durationMinutes)
    const targetDate = parseDateKey(dateKey)
    selectedMonth.value = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    backfillSheetOpen.value = false
    await loadDashboard()
    const unlockedCount = await syncAchievementUnlocks(true)
    triggerSuccessHaptic()
    if (unlockedCount === 0) {
      uni.showToast({ title: '补签成功', icon: 'success' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '补签失败，请重试'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    backfilling.value = false
  }
}

function selectBackfillReason(reason: BackfillReason) {
  selectedBackfillReason.value = reason
}

function handleRecordTouchStart(recordId: number, event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) {
    return
  }

  recordTouchStart.value = {
    id: recordId,
    x: touch.clientX,
    y: touch.clientY,
  }
}

function handleRecordTouchEnd(recordId: number, event: TouchEvent) {
  const start = recordTouchStart.value
  const touch = event.changedTouches[0]
  recordTouchStart.value = null

  if (!start || start.id !== recordId || !touch) {
    return
  }

  const deltaX = touch.clientX - start.x
  const deltaY = touch.clientY - start.y

  if (Math.abs(deltaX) < 34 || Math.abs(deltaX) < Math.abs(deltaY)) {
    return
  }

  activeRecordActionId.value = deltaX < 0 ? recordId : null
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getBackfillDisabledReason(dateKey: string, count: number, stats = monthStats.value, includeQuota = true) {
  const todayKey = formatDateKey(new Date())
  const targetDate = parseDateKey(dateKey)
  const todayDate = parseDateKey(todayKey)
  const earliestDate = new Date(todayDate)
  earliestDate.setDate(todayDate.getDate() - 30)

  if (dateKey === todayKey) {
    return '今天请使用正常打卡'
  }
  if (targetDate > todayDate) {
    return '不能补签未来日期'
  }
  if (count > 0) {
    return '该日期已有打卡记录'
  }
  if (targetDate < earliestDate) {
    return '只能补签最近 30 天内的未打卡日期'
  }
  if (includeQuota && stats.backfillUsed >= stats.backfillLimit) {
    return '本月补签次数已用完'
  }
  return ''
}

function formatDateText(dateKey: string) {
  const [year, month, day] = dateKey.split('-')
  return `${year}年${month}月${day}日`
}

function formatRecentDayContent(records: CheckInRecord[], durationMinutes: number) {
  if (records.length === 0) {
    return '未打卡'
  }
  if (records.length === 1) {
    const [record] = records
    return `${record.isBackfill ? '补签打卡' : record.sportType} · ${record.durationMinutes} 分钟`
  }
  return `运动 ${records.length} 次 · ${durationMinutes} 分钟`
}

function formatRecentDaySide(count: number, durationMinutes: number) {
  if (count === 0) {
    return ''
  }
  return count === 1 ? '1 次' : `${durationMinutes} 分钟`
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function formatTime(value: string) {
  const date = new Date(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<template>
  <view class="app-page checkin-page" :class="{ ready: pageReady }">
    <ios-page-header title="运动" :subtitle="todayLabel" accent="green" />

    <view class="energy-card-shell">
      <app-card accent="green" elevated>
        <view class="energy-card-content" :class="{ pulse: successPulse }">
          <view v-if="targetGoalProgress" class="goal-panel">
            <view class="goal-copy">
              <text class="goal-caption">{{ targetGoalTitle }}</text>
              <text class="goal-status">{{ targetGoalStatusText }}</text>
              <text class="goal-completed numeric">{{ targetGoalCompletedText }}</text>
            </view>
            <text class="goal-percent numeric">{{ targetGoalProgress.percent }}%</text>
          </view>

          <view class="checkin-action">
            <button
              class="checkin-button"
              :class="{ checking, success: successPulse }"
              :disabled="checking || loading"
              hover-class="checkin-button-pressed"
              @click="openCheckInSheet"
            >
              <view class="button-copy">
                <text class="button-main">{{ checkInButtonText }}</text>
              </view>
            </button>
            <view v-if="successPulse" class="success-ring" />
          </view>

          <text class="checkin-summary">{{ checkInSummaryText }}</text>
        </view>
      </app-card>
    </view>

    <view class="calendar-section-head">
      <text class="ios-section-title calendar-section-title">月度热力</text>
      <text class="backfill-quota numeric">本月补签 {{ backfillQuotaText }}</text>
    </view>
    <view class="calendar-card-shell">
      <app-card accent="blue">
        <view class="calendar-card-content">
          <view class="calendar-head">
            <button class="icon-button" aria-label="上个月" hover-class="icon-button-pressed" @click="changeMonth(-1)">
              <text class="i-carbon-chevron-left" />
            </button>
            <view class="month-title-wrap" @click="backToCurrentMonth">
              <text class="month-title">{{ monthTitle }}</text>
              <text class="month-subtitle">点按回到本月</text>
            </view>
            <button class="icon-button" aria-label="下个月" hover-class="icon-button-pressed" @click="changeMonth(1)">
              <text class="i-carbon-chevron-right" />
            </button>
          </view>
          <view class="calendar-grid week-row">
            <text v-for="label in weekLabels" :key="label" class="week-label">
              {{ label }}
            </text>
          </view>
          <view class="calendar-grid days-grid">
            <view v-for="index in calendarStartOffset" :key="`blank-${index}`" class="calendar-day placeholder" />
            <view
              v-for="day in calendarDays"
              :key="day.key"
              class="calendar-day"
              :class="{
                'level-1': day.count === 1,
                'level-2': day.count === 2,
                'level-3': day.count >= 3,
                today: day.isToday,
                future: day.isFuture,
                backfilled: day.isBackfilled,
                'can-backfill': day.canBackfill,
                selected: day.key === selectedDateKey,
              }"
              @click="selectCalendarDay(day)"
            >
              <text>{{ day.day }}</text>
              <view v-if="day.count > 0" class="day-count numeric">
                {{ day.count }}
              </view>
              <view v-if="day.isBackfilled" class="backfill-corner">补</view>
            </view>
          </view>
          <view class="heat-legend">
            <text>少</text>
            <view class="legend-dot level-1" />
            <view class="legend-dot level-2" />
            <view class="legend-dot level-3" />
            <text>多</text>
          </view>
          <view v-if="selectedCalendarHint" class="selected-day-hint">
            <text>{{ selectedCalendarHint }}</text>
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">今日记录</text>
    <view class="record-card-shell">
      <app-card class="record-card" accent="green" :show-accent="false">
        <view v-if="todayRecords.length === 0" class="empty-state">
          <app-icon name="target" accent="green" size="md" />
          <text>还没有记录，点亮今天的第一格。</text>
        </view>
        <view
          v-for="(record, index) in todayRecords"
          v-else
          :key="record.id"
          class="record-row"
          :class="{ 'actions-open': activeRecordActionId === record.id }"
          :style="{ animationDelay: `${index * 35}ms` }"
          @touchstart="handleRecordTouchStart(record.id, $event)"
          @touchend="handleRecordTouchEnd(record.id, $event)"
        >
          <view class="record-delete-track">
            <button class="record-delete-button" hover-class="record-delete-pressed" @click.stop="handleDelete(record)">
              删除
            </button>
          </view>
          <view class="record-content">
            <app-icon name="checkin" accent="green" size="sm" active />
            <view class="record-main">
              <text class="record-title">
                {{ record.isBackfill ? '补签打卡' : record.sportType }} · {{ record.durationMinutes }} 分钟
              </text>
              <text class="record-detail">
                {{ formatTime(record.checkedAt) }}
              </text>
            </view>
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">最近 7 天</text>
    <view class="record-card-shell">
      <app-card class="record-card" accent="orange" :show-accent="false">
        <view
          v-for="day in visibleRecentDaySummaries"
          :key="day.key"
          class="recent-row"
          :class="{ muted: day.count === 0 }"
        >
          <view class="timeline-marker">
            <view class="timeline-dot" :class="{ empty: day.count === 0 }" />
          </view>
          <view class="recent-copy">
            <text class="recent-date">{{ day.label }}</text>
            <text class="recent-event">{{ day.contentText }}</text>
          </view>
          <button
            v-if="day.canBackfill"
            class="recent-backfill-button"
            hover-class="recent-backfill-pressed"
            @click.stop="openBackfillSheet(day.key)"
          >
            补签
          </button>
          <text v-else-if="day.sideText" class="recent-time numeric">
            {{ day.sideText }}
          </text>
        </view>
        <button
          v-if="recentDaySummaries.length > 3"
          class="recent-toggle"
          hover-class="recent-toggle-pressed"
          @click="recentExpanded = !recentExpanded"
        >
          {{ recentExpanded ? '收起最近 7 天 ↑' : '展开最近 7 天 ↓' }}
        </button>
      </app-card>
    </view>

    <app-sheet
      v-if="checkInSheetOpen"
      title="运动打卡"
      :saving="checking"
      close-text="取消"
      :show-save="false"
      compact
      @close="closeCheckInSheet"
    >
      <view class="checkin-sheet refined-action-sheet">
        <view class="sheet-selection-summary">
          <text>{{ checkInSheetSummary }}</text>
        </view>

        <view class="checkin-field sheet-choice-card">
          <text class="checkin-field-title">运动类型</text>
          <view class="sheet-option-grid option-grid cols-4 sport-options">
            <button
              v-for="type in sportTypes"
              :key="type"
              class="sheet-option option-pill sport-option"
              :class="{ active: selectedSportType === type }"
              hover-class="option-pill-pressed"
              @click.stop="selectedSportType = type"
            >
              {{ type }}
            </button>
          </view>
        </view>

        <view class="checkin-field sheet-choice-card">
          <text class="checkin-field-title">运动时长</text>
          <view class="sheet-option-grid option-grid cols-3 duration-options">
            <button
              v-for="minutes in durationOptions"
              :key="minutes"
              class="sheet-option option-pill duration-option"
              :class="{ active: selectedDurationOption === minutes }"
              hover-class="option-pill-pressed"
              @click.stop="selectDurationOption(minutes)"
            >
              {{ minutes }} 分钟
            </button>
            <button
              class="sheet-option option-pill duration-option"
              :class="{ active: selectedDurationOption === 'custom' }"
              hover-class="option-pill-pressed"
              @click.stop="selectDurationOption('custom')"
            >
              自定义
            </button>
          </view>
          <view v-if="selectedDurationOption === 'custom'" class="custom-duration-row">
            <input
              v-model="customDuration"
              class="custom-duration-input numeric"
              type="number"
              :maxlength="3"
              placeholder="请输入分钟数"
            />
            <text class="custom-duration-unit">分钟</text>
          </view>
        </view>

        <view class="sheet-action-bar">
          <button class="sheet-action secondary" :disabled="checking" hover-class="sheet-action-pressed" @click.stop="closeCheckInSheet">
            取消
          </button>
          <button class="sheet-action primary" :disabled="checking" hover-class="sheet-action-pressed" @click.stop="handleConfirmCheckIn">
            {{ checking ? '打卡中' : '确认打卡' }}
          </button>
        </view>
      </view>
    </app-sheet>

    <app-sheet
      v-if="backfillSheetOpen"
      title="补签打卡"
      :saving="backfilling"
      close-text="取消"
      :show-save="false"
      compact
      @close="closeBackfillSheet"
    >
      <view class="backfill-sheet refined-action-sheet">
        <view class="sheet-selection-summary">
          <text>{{ backfillSheetSummary }}</text>
        </view>

        <view class="backfill-meta-card">
          <view class="backfill-info-row">
            <text class="backfill-info-label">补签日期</text>
            <text class="backfill-info-value">{{ selectedBackfillDateText }}</text>
          </view>
          <text class="backfill-note">补签后，该日期将计入月度热力、连续打卡和成就统计。</text>
        </view>
        <view class="backfill-field sheet-choice-card">
          <text class="backfill-field-title">运动类型</text>
          <view class="sheet-option-grid option-grid cols-4 sport-options">
            <button
              v-for="type in sportTypes"
              :key="type"
              class="sheet-option option-pill sport-option"
              :class="{ active: selectedBackfillSportType === type }"
              hover-class="option-pill-pressed"
              @click.stop="selectedBackfillSportType = type"
            >
              {{ type }}
            </button>
          </view>
        </view>
        <view class="backfill-field sheet-choice-card">
          <text class="backfill-field-title">运动时长</text>
          <view class="sheet-option-grid option-grid cols-3 duration-options">
            <button
              v-for="minutes in durationOptions"
              :key="minutes"
              class="sheet-option option-pill duration-option"
              :class="{ active: selectedBackfillDurationOption === minutes }"
              hover-class="option-pill-pressed"
              @click.stop="selectBackfillDurationOption(minutes)"
            >
              {{ minutes }} 分钟
            </button>
            <button
              class="sheet-option option-pill duration-option"
              :class="{ active: selectedBackfillDurationOption === 'custom' }"
              hover-class="option-pill-pressed"
              @click.stop="selectBackfillDurationOption('custom')"
            >
              自定义
            </button>
          </view>
          <view v-if="selectedBackfillDurationOption === 'custom'" class="custom-duration-row">
            <input
              v-model="customBackfillDuration"
              class="custom-duration-input numeric"
              type="number"
              :maxlength="3"
              placeholder="请输入分钟数"
            />
            <text class="custom-duration-unit">分钟</text>
          </view>
        </view>
        <view class="backfill-field sheet-choice-card">
          <text class="backfill-field-title">补签原因</text>
          <view class="reason-options option-grid cols-3">
            <button
              v-for="reason in backfillReasons"
              :key="reason"
              class="reason-option option-pill"
              :class="{ active: selectedBackfillReason === reason }"
              hover-class="option-pill-pressed"
              @click.stop="selectBackfillReason(reason)"
            >
              {{ reason }}
            </button>
          </view>
        </view>
        <view class="backfill-info-row backfill-quota-row">
          <text class="backfill-info-label">本月补签次数</text>
          <text class="backfill-info-value numeric">{{ selectedBackfillQuotaText }}</text>
        </view>

        <view class="sheet-action-bar">
          <button class="sheet-action secondary" :disabled="backfilling" hover-class="sheet-action-pressed" @click.stop="closeBackfillSheet">
            取消
          </button>
          <button class="sheet-action primary" :disabled="backfilling" hover-class="sheet-action-pressed" @click.stop="handleConfirmBackfill">
            {{ backfilling ? '补签中' : '确认补签' }}
          </button>
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
.checkin-page {
  padding-right: 0;
  padding-left: 0;
}

.energy-card-shell,
.calendar-card-shell,
.record-card-shell {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
  opacity: 0;
  transform: translateY(18rpx);
}

.ready .energy-card-shell {
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.ready .calendar-card-shell {
  animation: app-enter var(--app-motion-normal) 70ms var(--app-ease-out) both;
}

.ready .record-card-shell {
  animation: app-enter var(--app-motion-normal) 120ms var(--app-ease-out) both;
}

.energy-card-content {
  padding: 42rpx 28rpx 30rpx;
  box-sizing: border-box;
}

.energy-card-content.pulse {
  animation: success-pop 320ms var(--app-ease-spring) both;
}

.calendar-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-right: calc(var(--app-gutter) + 12rpx);
}

.calendar-section-title {
  margin-right: 0;
}

.backfill-quota {
  margin-bottom: 14rpx;
  color: var(--app-orange);
  font-size: 22rpx;
  font-weight: 720;
}

.calendar-head,
.record-row,
.recent-row,
.checkin-button {
  display: flex;
  align-items: center;
}

.record-detail,
.recent-time,
.recent-event,
.month-subtitle {
  color: var(--app-label-secondary);
}

.goal-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 24rpx 26rpx;
  border-radius: 24rpx;
  background: var(--app-fill);
}

.goal-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.goal-caption,
.goal-status,
.goal-completed,
.goal-percent {
  display: block;
}

.goal-caption {
  color: var(--app-label-secondary);
  font-size: 24rpx;
  font-weight: 700;
}

.goal-status {
  margin-top: 4rpx;
  color: var(--app-label-primary);
  font-size: 25rpx;
  font-weight: 760;
}

.goal-completed {
  margin-top: 8rpx;
  color: var(--app-label-secondary);
  font-size: 22rpx;
  font-weight: 760;
  line-height: 1.25;
}

.goal-percent {
  flex: 0 0 auto;
  color: var(--app-green);
  font-size: 42rpx;
  font-weight: 860;
}

.checkin-action {
  position: relative;
  margin-top: 28rpx;
}

.checkin-summary {
  display: block;
  margin-top: 22rpx;
  color: var(--app-label-secondary);
  font-size: 24rpx;
  text-align: center;
}

.checkin-button {
  position: relative;
  z-index: 2;
  justify-content: center;
  width: 100%;
  height: 168rpx;
  gap: 16rpx;
  padding: 0;
  border-radius: 34rpx;
  color: #fff;
  background: linear-gradient(135deg, var(--app-green), var(--app-green-deep));
  box-shadow:
    0 6rpx 0 var(--app-green-deep),
    0 10rpx 20rpx rgba(34, 199, 111, 0.12),
    inset 0 3rpx 0 rgba(255, 255, 255, 0.25);
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    box-shadow var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.checkin-button-pressed,
.checkin-button.checking {
  opacity: 0.9;
  transform: translateY(6rpx) scale(0.99);
  box-shadow:
    0 4rpx 0 var(--app-green-deep),
    0 6rpx 14rpx rgba(32, 196, 107, 0.1);
}

.button-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.button-main {
  font-size: 42rpx;
  font-weight: 860;
}

.success-ring {
  position: absolute;
  inset: 0;
  border-radius: 34rpx;
  background: var(--app-green-soft);
  animation: ring-spread 420ms ease-out forwards;
}

.calendar-card-content {
  padding: 46rpx 24rpx 28rpx;
  box-sizing: border-box;
}

.calendar-head {
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border-radius: 50%;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 32rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.icon-button-pressed {
  opacity: 0.7;
  transform: scale(0.94);
}

.month-title-wrap {
  flex: 1;
  text-align: center;
}

.month-title,
.month-subtitle {
  display: block;
}

.month-title {
  font-size: 31rpx;
  font-weight: 780;
}

.month-subtitle {
  margin-top: 4rpx;
  font-size: 19rpx;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8rpx;
}

.week-label {
  color: var(--app-label-tertiary);
  font-size: 20rpx;
  font-weight: 700;
  text-align: center;
}

.days-grid {
  margin-top: 10rpx;
}

.calendar-day {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 66rpx;
  border-radius: 20rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  background: transparent;
}

.calendar-day.future {
  color: var(--app-label-tertiary);
  opacity: 0.52;
}

.calendar-day.can-backfill {
  color: var(--app-orange);
  background: rgba(255, 159, 28, 0.08);
  box-shadow: inset 0 0 0 2rpx rgba(255, 159, 28, 0.2);
}

.calendar-day.level-1 {
  color: var(--app-green);
  background: var(--app-green-soft);
  font-weight: 750;
}

.calendar-day.level-2 {
  color: #fff;
  background: var(--app-green);
  font-weight: 780;
}

.calendar-day.level-3 {
  color: #fff;
  background: var(--app-green-deep);
  font-weight: 800;
}

.calendar-day.today {
  box-shadow: inset 0 0 0 3rpx var(--app-green);
}

.calendar-day.selected {
  background: var(--app-green-soft);
  box-shadow: inset 0 0 0 3rpx var(--app-green);
}

.calendar-day.today.selected {
  box-shadow: inset 0 0 0 4rpx var(--app-green);
}

.calendar-day.backfilled {
  color: var(--app-green);
  background: var(--app-green-soft);
  font-weight: 750;
}

.calendar-day.placeholder {
  visibility: hidden;
}

.day-count {
  position: absolute;
  right: -2rpx;
  bottom: -1rpx;
  min-width: 26rpx;
  height: 26rpx;
  padding: 0 4rpx;
  border-radius: 999rpx;
  color: #fff;
  background: var(--app-orange);
  font-size: 17rpx;
  line-height: 26rpx;
  text-align: center;
  box-sizing: border-box;
}

.calendar-day.backfilled .day-count {
  top: -1rpx;
  right: -2rpx;
  bottom: auto;
}

.backfill-corner {
  position: absolute;
  right: -3rpx;
  bottom: -3rpx;
  min-width: 30rpx;
  height: 26rpx;
  padding: 0 5rpx;
  border-radius: 10rpx 4rpx 10rpx 4rpx;
  color: #fff;
  background: var(--app-orange);
  font-size: 17rpx;
  font-weight: 800;
  line-height: 26rpx;
  text-align: center;
  box-sizing: border-box;
}

.heat-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  margin-top: 22rpx;
  color: var(--app-label-tertiary);
  font-size: 19rpx;
}

.selected-day-hint {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  color: var(--app-label-secondary);
  background: var(--app-fill);
  font-size: 22rpx;
  line-height: 1.35;
  box-sizing: border-box;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 6rpx;
}

.legend-dot.level-0 {
  background: var(--app-surface-tertiary);
}

.legend-dot.level-1 {
  background: var(--app-green-soft);
}

.legend-dot.level-2 {
  background: var(--app-green);
}

.legend-dot.level-3 {
  background: var(--app-green-deep);
}

.record-card {
  overflow: hidden;
}

.record-row,
.recent-row {
  position: relative;
  min-height: 106rpx;
  margin-left: 24rpx;
  padding: 18rpx 24rpx 18rpx 0;
  border-bottom: 1rpx solid rgba(20, 40, 30, 0.06);
  box-sizing: border-box;
}

.record-row:last-child,
.recent-row:last-child {
  border-bottom: 0;
}

.record-row {
  display: block;
  overflow: hidden;
  padding-right: 0;
  padding-top: 0;
  padding-bottom: 0;
  animation: app-enter 230ms ease-out both;
}

.record-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 106rpx;
  gap: 18rpx;
  padding: 18rpx 24rpx 18rpx 0;
  background: var(--app-surface);
  box-sizing: border-box;
  transition: transform 220ms var(--app-ease-out);
}

.record-row.actions-open .record-content {
  transform: translateX(-128rpx);
}

.record-delete-track {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 1rpx;
  z-index: 1;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  width: 128rpx;
}

.record-delete-button {
  width: 108rpx;
  height: 100%;
  padding: 0;
  border-radius: 0;
  color: #fff;
  background: var(--app-red);
  font-size: 24rpx;
  font-weight: 760;
  line-height: 106rpx;
  transition:
    opacity var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) ease-out;
}

.record-delete-pressed {
  opacity: 0.82;
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-title,
.record-detail {
  display: block;
}

.record-title,
.recent-date {
  font-size: 28rpx;
  font-weight: 680;
}

.record-detail,
.recent-time {
  margin-top: 4rpx;
  font-size: 22rpx;
}

.recent-row {
  justify-content: flex-start;
  min-height: 94rpx;
}

.timeline-marker {
  position: relative;
  align-self: stretch;
  width: 44rpx;
  margin-right: 12rpx;
}

.timeline-marker::after {
  position: absolute;
  top: 0rpx;
  bottom: -37rpx;
  left: 23rpx;
  width: 2rpx;
  background: #e6f0ea;
  content: '';
}

.recent-row:last-child .timeline-marker::after {
  display: none;
}

.timeline-dot {
  position: absolute;
  top: 35rpx;
  left: 13rpx;
  width: 22rpx;
  height: 22rpx;
  border: 0;
  border-radius: 50%;
  background: var(--app-orange);
  box-sizing: border-box;
}

.timeline-dot.empty {
  top: 37rpx;
  left: 15rpx;
  width: 18rpx;
  height: 18rpx;
  background: #d7e0db;
  opacity: 1;
}

.recent-copy {
  flex: 1;
  min-width: 0;
}

.recent-event {
  display: block;
  margin-top: 5rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  line-height: 1.35;
}

.recent-time {
  flex: 0 0 auto;
  margin: 0;
  max-width: 168rpx;
  color: var(--app-label-secondary);
  font-size: 24rpx;
  font-weight: 680;
  text-align: right;
  white-space: normal;
  line-height: 1.25;
}

.recent-backfill-button {
  flex: 0 0 auto;
  height: 48rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  color: #ff9800;
  background: #fff3e0;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 48rpx;
  transition:
    opacity var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) ease-out;
}

.recent-backfill-pressed {
  opacity: 0.78;
  transform: scale(0.96);
}

.recent-row.muted .recent-time {
  color: var(--app-label-tertiary);
  font-size: 21rpx;
}

.recent-row.muted .recent-date,
.recent-row.muted .recent-event {
  color: var(--app-label-tertiary);
}

.recent-toggle {
  height: 56rpx;
  margin: 8rpx 24rpx 18rpx;
  border-radius: 14rpx;
  color: var(--app-green);
  background: rgba(34, 199, 111, 0.06);
  font-size: 26rpx;
  font-weight: 680;
  line-height: 56rpx;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out;
}

.recent-toggle-pressed {
  opacity: 0.78;
  transform: scale(0.98);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 52rpx 24rpx;
  color: var(--app-label-secondary);
  font-size: 25rpx;
  text-align: center;
}

.checkin-sheet,
.backfill-sheet {
  padding-top: 10rpx;
}

.refined-action-sheet {
  max-height: calc(72vh - 112rpx - env(safe-area-inset-bottom));
  overflow-y: auto;
  box-sizing: border-box;
}

.sheet-selection-summary {
  display: flex;
  align-items: center;
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

.checkin-field,
.backfill-field,
.sheet-choice-card,
.backfill-meta-card,
.backfill-quota-row {
  border-radius: 26rpx;
  background: #fff;
  box-sizing: border-box;
}

.checkin-field,
.backfill-field,
.sheet-choice-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  box-shadow: 0 12rpx 32rpx rgba(42, 111, 76, 0.06);
}

.checkin-field-title,
.backfill-field-title {
  display: block;
  margin-bottom: 18rpx;
  color: var(--app-label-primary);
  font-size: 26rpx;
  font-weight: 780;
}

.sheet-option-grid {
  width: 100%;
}

.sheet-option,
.reason-option {
  font-size: 22rpx;
}

.custom-duration-row {
  display: flex;
  align-items: center;
  min-height: 82rpx;
  margin-top: 16rpx;
  padding: 0 22rpx;
  border: 2rpx solid rgba(34, 199, 111, 0.18);
  border-radius: 22rpx;
  background: #F4FAF6;
  box-sizing: border-box;
}

.custom-duration-input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  color: var(--app-label-primary);
  font-size: 28rpx;
  font-weight: 780;
}

.custom-duration-unit {
  flex: 0 0 auto;
  color: var(--app-label-secondary);
  font-size: 24rpx;
  font-weight: 700;
}

.backfill-meta-card {
  margin-bottom: 16rpx;
  padding: 18rpx 22rpx;
  box-shadow: 0 12rpx 32rpx rgba(42, 111, 76, 0.06);
}

.backfill-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54rpx;
  gap: 20rpx;
}

.backfill-info-label {
  color: var(--app-label-secondary);
  font-size: 24rpx;
  font-weight: 700;
}

.backfill-info-value {
  color: var(--app-label-primary);
  font-size: 27rpx;
  font-weight: 780;
}

.backfill-note {
  display: block;
  margin-top: 8rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  line-height: 1.45;
}

.reason-options {
  width: 100%;
}

.reason-option {
  font-size: 22rpx;
}

.backfill-quota-row {
  min-height: 72rpx;
  margin-bottom: 16rpx;
  padding: 0 22rpx;
  box-shadow: 0 12rpx 32rpx rgba(42, 111, 76, 0.06);
}

.sheet-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 16rpx;
  padding: 14rpx 0 2rpx;
  background: linear-gradient(180deg, rgba(247, 251, 248, 0), #F7FBF8 24rpx);
}

.sheet-action {
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 88rpx;
  transition:
    opacity var(--app-motion-fast) ease-out,
    transform var(--app-motion-fast) ease-out;
}

.sheet-action-pressed {
  opacity: 0.82;
  transform: scale(0.97);
}

.sheet-action.secondary {
  color: var(--app-label-secondary);
  background: #EAF2ED;
}

.sheet-action.primary {
  color: #fff;
  background: linear-gradient(135deg, var(--app-green), var(--app-green-deep));
  box-shadow: 0 16rpx 32rpx rgba(32, 196, 107, 0.22);
}

.sheet-action[disabled] {
  opacity: 0.58;
}

@keyframes success-pop {
  0% {
    transform: scale(0.985);
  }

  65% {
    transform: scale(1.015);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes ring-spread {
  from {
    opacity: 0.7;
    transform: scale(0.94);
  }

  to {
    opacity: 0;
    transform: scale(1.14);
  }
}
</style>

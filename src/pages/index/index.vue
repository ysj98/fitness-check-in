<script lang="ts" setup>
import type { CheckInRecord, CheckInStatsRes, MonthCheckInRes } from '@/api/checkins'
import { createCheckIn, deleteCheckIn, getCheckInStats, getMonthCheckIns, getRecentCheckIns, getTodayCheckIns } from '@/api/checkins'
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
}

const emptyStats: CheckInStatsRes = {
  currentStreak: 0,
  totalCount: 0,
  todayGoal: 1,
  todayCompleted: false,
  badges: [],
}

const tokenStore = useTokenStore()
const loading = ref(false)
const checking = ref(false)
const loginReady = ref(false)
const successPulse = ref(false)
const pageReady = ref(false)
const selectedMonth = ref(new Date())
const todayCount = ref(0)
const todayRecords = ref<CheckInRecord[]>([])
const recentRecords = ref<CheckInRecord[]>([])
const monthStats = ref<MonthCheckInRes>({ month: getMonthKey(), days: {} })
const checkInStats = ref<CheckInStatsRes>({ ...emptyStats })
const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

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

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const key = `${year}-${pad(month)}-${pad(day)}`
    return {
      key,
      day,
      count: monthStats.value.days[key] || 0,
      isToday: key === todayKey,
    }
  })
})

const calendarStartOffset = computed(() => {
  const [year, month] = monthStats.value.month.split('-').map(Number)
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
})

const goalPercent = computed(() => {
  const goal = Math.max(checkInStats.value.todayGoal || 1, 1)
  return Math.min(100, Math.round((todayCount.value / goal) * 100))
})

const goalText = computed(() => {
  if (checkInStats.value.todayCompleted) {
    return '今日目标已完成'
  }
  return `还差 ${Math.max((checkInStats.value.todayGoal || 1) - todayCount.value, 0)} 次达成`
})

const goalRingStyle = computed(() => ({
  background: `conic-gradient(var(--app-green) ${goalPercent.value}%, var(--app-fill) ${goalPercent.value}% 100%)`,
}))

onLoad(() => {
  initPage()
  setTimeout(() => {
    pageReady.value = true
  }, 40)
})

onShow(() => {
  if (loginReady.value) {
    loadDashboard()
  }
})

async function initPage() {
  loading.value = true
  try {
    await ensureLogin()
    await loadDashboard()
  }
  catch {
    uni.showToast({ title: '数据加载失败，请重试', icon: 'none' })
  }
  finally {
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
    getRecentCheckIns(12),
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

async function handleCheckIn() {
  if (checking.value) {
    return
  }

  checking.value = true
  try {
    await ensureLogin()
    const record = await createCheckIn()
    successPulse.value = false
    await nextTick()
    successPulse.value = true
    todayCount.value += 1
    todayRecords.value = [record, ...todayRecords.value]
    recentRecords.value = [record, ...recentRecords.value].slice(0, 12)
    const [month, stats] = await Promise.all([
      getMonthCheckIns(monthKey.value),
      getCheckInStats(),
    ])
    monthStats.value = month
    checkInStats.value = stats
    triggerSuccessHaptic()
    uni.showToast({
      title: stats.todayCompleted ? '今日目标达成' : '打卡成功',
      icon: 'success',
    })
  }
  finally {
    checking.value = false
    setTimeout(() => {
      successPulse.value = false
    }, 360)
  }
}

async function handleDelete(record: CheckInRecord) {
  await deleteCheckIn(record.id)
  todayRecords.value = todayRecords.value.filter(item => item.id !== record.id)
  recentRecords.value = recentRecords.value.filter(item => item.id !== record.id)
  todayCount.value = Math.max(0, todayCount.value - 1)
  const [month, stats] = await Promise.all([
    getMonthCheckIns(monthKey.value),
    getCheckInStats(),
  ])
  monthStats.value = month
  checkInStats.value = stats
  uni.showToast({
    title: '已删除',
    icon: 'none',
  })
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function formatTime(value: string) {
  const date = new Date(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatRecordDate(value: string) {
  const date = new Date(value)
  const key = formatDateKey(date)
  return key === formatDateKey(new Date()) ? '今天' : `${date.getMonth() + 1}月${date.getDate()}日`
}
</script>

<template>
  <view class="app-page checkin-page" :class="{ ready: pageReady }">
    <ios-page-header title="运动" :subtitle="todayLabel" />

    <view class="activity-card ios-card" :class="{ pulse: successPulse }">
      <view class="activity-head">
        <view>
          <text class="activity-label">连续打卡</text>
          <view class="streak-value numeric">
            <text>{{ checkInStats.currentStreak }}</text>
            <text class="streak-unit">天</text>
          </view>
        </view>
        <view class="goal-copy">
          <text class="goal-caption">今日目标</text>
          <text class="goal-fraction numeric">{{ todayCount }}/{{ checkInStats.todayGoal || 1 }}</text>
          <text class="goal-status">{{ goalText }}</text>
        </view>
      </view>

      <view class="action-area">
        <view class="goal-ring" :style="goalRingStyle">
          <view class="goal-ring-inner">
            <text class="ring-percent numeric">{{ goalPercent }}%</text>
            <text class="ring-label">完成度</text>
          </view>
        </view>
        <view class="checkin-action">
          <button
            class="checkin-button"
            :class="{ checking, success: successPulse }"
            :disabled="checking || loading"
            hover-class="checkin-button-pressed"
            @click="handleCheckIn"
          >
            <text class="button-main">{{ checking ? '记录中' : '立即打卡' }}</text>
            <text class="button-sub">今日第 {{ todayCount + 1 }} 次</text>
          </button>
          <view v-if="successPulse" class="success-ring" />
        </view>
      </view>
    </view>

    <text class="ios-section-title">月度记录</text>
    <view class="calendar-card ios-card">
      <view class="calendar-head">
        <button class="icon-button" aria-label="上个月" hover-class="icon-button-pressed" @click="changeMonth(-1)">
          <text class="i-carbon-chevron-left" />
        </button>
        <view class="month-title-wrap" @click="backToCurrentMonth">
          <text class="month-title">{{ monthTitle }}</text>
        </view>
        <button class="icon-button" aria-label="下个月" hover-class="icon-button-pressed" @click="changeMonth(1)">
          <text class="i-carbon-chevron-right" />
        </button>
      </view>
      <view class="calendar-grid week-row">
        <text v-for="label in weekLabels" :key="label" class="week-label">{{ label }}</text>
      </view>
      <view class="calendar-grid days-grid">
        <view v-for="index in calendarStartOffset" :key="`blank-${index}`" class="calendar-day placeholder" />
        <view
          v-for="day in calendarDays"
          :key="day.key"
          class="calendar-day"
          :class="{ active: day.count > 0, today: day.isToday }"
        >
          <text>{{ day.day }}</text>
          <view v-if="day.count > 0" class="day-count numeric">
            {{ day.count }}
          </view>
        </view>
      </view>
    </view>

    <text class="ios-section-title">今日记录</text>
    <view class="record-group ios-card">
      <view v-if="todayRecords.length === 0" class="empty-state">
        暂无记录
      </view>
      <view
        v-for="(record, index) in todayRecords"
        v-else
        :key="record.id"
        class="record-row"
        :style="{ animationDelay: `${index * 35}ms` }"
      >
        <view class="record-icon green-icon">
          <text class="i-carbon-checkmark" />
        </view>
        <view class="record-main">
          <text class="record-title">运动打卡</text>
          <text class="record-detail">{{ formatTime(record.checkedAt) }}</text>
        </view>
        <button class="row-action danger" hover-class="row-action-pressed" @click="handleDelete(record)">
          删除
        </button>
      </view>
    </view>

    <text class="ios-section-title">最近记录</text>
    <view class="record-group ios-card">
      <view v-if="recentRecords.length === 0" class="empty-state">
        暂无记录
      </view>
      <view v-for="record in recentRecords" v-else :key="record.id" class="recent-row">
        <view class="timeline-marker">
          <view class="timeline-dot" />
        </view>
        <view class="recent-copy">
          <text class="recent-date">{{ formatRecordDate(record.checkedAt) }}</text>
          <text class="recent-event">运动打卡</text>
        </view>
        <text class="recent-time numeric">{{ formatTime(record.checkedAt) }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.checkin-page {
  padding-right: 0;
  padding-left: 0;
}

.activity-card,
.calendar-card,
.record-group {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
  opacity: 0;
  transform: translateY(16rpx);
}

.ready .activity-card {
  animation: content-enter var(--app-motion-normal) ease-out both;
}

.ready .calendar-card {
  animation: content-enter var(--app-motion-normal) 50ms ease-out both;
}

.ready .record-group {
  animation: content-enter var(--app-motion-normal) 90ms ease-out both;
}

.activity-card {
  position: relative;
  padding: 30rpx;
  border-color: rgba(52, 199, 89, 0.18);
  overflow: hidden;
}

.activity-card::before {
  position: absolute;
  top: 0;
  right: 30rpx;
  left: 30rpx;
  height: 5rpx;
  border-radius: 0 0 999rpx 999rpx;
  background: var(--app-green);
  content: '';
}

.activity-card.pulse {
  animation: success-pop 280ms ease-out both;
}

.activity-head,
.action-area,
.calendar-head,
.record-row,
.recent-row {
  display: flex;
  align-items: center;
}

.activity-head {
  justify-content: space-between;
  gap: 28rpx;
  padding-top: 6rpx;
}

.activity-label,
.goal-caption,
.goal-status,
.ring-label,
.record-detail,
.recent-time {
  color: var(--app-label-secondary);
}

.activity-label,
.goal-caption {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
}

.streak-value {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 4rpx;
  color: var(--app-green);
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1.1;
}

.streak-unit {
  font-size: 26rpx;
  font-weight: 600;
}

.goal-copy {
  min-width: 190rpx;
  padding: 14rpx 18rpx;
  border-radius: 20rpx;
  background: var(--app-fill);
  text-align: right;
}

.goal-fraction,
.goal-status {
  display: block;
}

.goal-fraction {
  margin-top: 5rpx;
  font-size: 36rpx;
  font-weight: 750;
}

.goal-status {
  margin-top: 3rpx;
  font-size: 22rpx;
}

.action-area {
  justify-content: space-between;
  gap: 34rpx;
  margin-top: 32rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid var(--app-separator);
}

.goal-ring {
  flex: 0 0 auto;
  width: 176rpx;
  height: 176rpx;
  padding: 14rpx;
  border-radius: 50%;
  box-sizing: border-box;
  transition: background-color var(--app-motion-normal) ease-out;
}

.goal-ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--app-surface);
}

.ring-percent {
  font-size: 34rpx;
  font-weight: 750;
}

.ring-label {
  margin-top: 2rpx;
  font-size: 20rpx;
}

.checkin-action {
  position: relative;
  flex: 1;
}

.checkin-button {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 138rpx;
  padding: 0;
  border-radius: 28rpx;
  color: #fff;
  background: var(--app-green);
  box-shadow:
    0 12rpx 0 rgba(20, 120, 48, 0.82),
    0 20rpx 30rpx rgba(52, 199, 89, 0.2),
    inset 0 3rpx 0 rgba(255, 255, 255, 0.26);
  transition:
    transform var(--app-motion-fast) ease-out,
    box-shadow var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.checkin-button-pressed,
.checkin-button.checking {
  opacity: 0.9;
  transform: translateY(8rpx) scale(0.99);
  box-shadow:
    0 4rpx 0 rgba(20, 120, 48, 0.82),
    0 8rpx 16rpx rgba(52, 199, 89, 0.16),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.18);
}

.checkin-button.success {
  animation: button-pop 280ms ease-out;
}

.button-main {
  font-size: 34rpx;
  font-weight: 750;
}

.button-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.82;
}

.success-ring {
  position: absolute;
  inset: 0;
  border-radius: 28rpx;
  background: var(--app-green-soft);
  animation: ring-spread 340ms ease-out forwards;
}

.calendar-card {
  padding: 28rpx 24rpx 26rpx;
}

.calendar-head {
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border-radius: 50%;
  color: var(--app-green);
  background: var(--app-green-soft);
  font-size: 32rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.icon-button-pressed,
.row-action-pressed {
  opacity: 0.68;
  transform: scale(0.94);
}

.month-title-wrap {
  flex: 1;
  text-align: center;
}

.month-title {
  display: block;
}

.month-title {
  font-size: 31rpx;
  font-weight: 720;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8rpx;
}

.week-label {
  color: var(--app-label-tertiary);
  font-size: 20rpx;
  font-weight: 600;
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
  border-radius: 50%;
  color: var(--app-label-secondary);
  font-size: 23rpx;
  background: transparent;
}

.calendar-day.active {
  color: var(--app-green);
  background: var(--app-green-soft);
  font-weight: 650;
}

.calendar-day.today {
  box-shadow: inset 0 0 0 3rpx var(--app-green);
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
  background: var(--app-green);
  font-size: 17rpx;
  line-height: 26rpx;
  text-align: center;
  box-sizing: border-box;
}

.record-group {
  overflow: hidden;
}

.record-row,
.recent-row {
  position: relative;
  min-height: 104rpx;
  margin-left: 28rpx;
  padding: 16rpx 24rpx 16rpx 0;
  border-bottom: 1rpx solid var(--app-separator);
  box-sizing: border-box;
}

.recent-row {
  min-height: 112rpx;
  padding-left: 0;
}

.record-row:last-child,
.recent-row:last-child {
  border-bottom: 0;
}

.record-row {
  animation: item-enter 220ms ease-out both;
}

.record-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  margin-right: 20rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.green-icon {
  color: var(--app-green);
  background: var(--app-green-soft);
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
  font-weight: 550;
}

.record-detail,
.recent-time {
  margin-top: 4rpx;
  font-size: 22rpx;
}

.row-action {
  min-width: 88rpx;
  height: 56rpx;
  padding: 0 16rpx;
  border-radius: 14rpx;
  color: var(--app-red);
  background: var(--app-pink-soft);
  font-size: 23rpx;
  line-height: 56rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.recent-row {
  justify-content: flex-start;
}

.timeline-marker {
  position: relative;
  align-self: stretch;
  width: 44rpx;
  margin-right: 12rpx;
}

.timeline-marker::after {
  position: absolute;
  top: 54rpx;
  bottom: -38rpx;
  left: 21rpx;
  width: 2rpx;
  background: var(--app-separator);
  content: '';
}

.recent-row:last-child .timeline-marker::after {
  display: none;
}

.timeline-dot {
  position: absolute;
  top: 34rpx;
  left: 13rpx;
  width: 16rpx;
  height: 16rpx;
  border: 5rpx solid var(--app-green-soft);
  border-radius: 50%;
  background: var(--app-green);
  box-sizing: content-box;
}

.recent-copy {
  flex: 1;
  min-width: 0;
}

.recent-event {
  display: block;
  margin-top: 5rpx;
  color: var(--app-label-secondary);
  font-size: 22rpx;
}

.recent-time {
  flex: 0 0 auto;
  margin: 0;
}

.empty-state {
  padding: 46rpx 24rpx;
  color: var(--app-label-secondary);
  font-size: 25rpx;
  text-align: center;
}

@keyframes content-enter {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes item-enter {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes button-pop {
  0% {
    transform: translateY(5rpx) scale(0.98);
  }

  65% {
    transform: translateY(-3rpx) scale(1.02);
  }

  100% {
    transform: translateY(0) scale(1);
  }
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
    opacity: 0.65;
    transform: scale(0.94);
  }

  to {
    opacity: 0;
    transform: scale(1.14);
  }
}
</style>

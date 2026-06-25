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
    return '今日目标已达成'
  }
  return `还差 ${Math.max((checkInStats.value.todayGoal || 1) - todayCount.value, 0)} 次达标`
})

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
    }, 420)
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
    <ios-page-header title="运动" :subtitle="todayLabel" accent="green" />

    <app-card class="energy-card" accent="green" elevated :class="{ pulse: successPulse }">
      <view class="hero-top">
        <view>
          <text class="eyebrow">今日能量</text>
          <view class="streak-value numeric">
            <text>{{ checkInStats.currentStreak }}</text>
            <text class="streak-unit">天连续</text>
          </view>
        </view>
        <progress-ring :percent="goalPercent" label="目标" accent="green" />
      </view>

      <view class="goal-panel">
        <view>
          <text class="goal-caption">今日目标</text>
          <text class="goal-status">{{ goalText }}</text>
        </view>
        <text class="goal-fraction numeric">{{ todayCount }}/{{ checkInStats.todayGoal || 1 }}</text>
      </view>

      <view class="checkin-action">
        <button
          class="checkin-button"
          :class="{ checking, success: successPulse }"
          :disabled="checking || loading"
          hover-class="checkin-button-pressed"
          @click="handleCheckIn"
        >
          <view class="button-copy">
            <text class="button-main">{{ checking ? '记录中' : '立即打卡' }}</text>
            <text class="button-sub">今日第 {{ todayCount + 1 }} 次</text>
          </view>
        </button>
        <view v-if="successPulse" class="success-ring" />
      </view>
    </app-card>

    <text class="ios-section-title">月度热力</text>
    <app-card class="calendar-card" accent="blue">
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
        <text v-for="label in weekLabels" :key="label" class="week-label">{{ label }}</text>
      </view>
      <view class="calendar-grid days-grid">
        <view v-for="index in calendarStartOffset" :key="`blank-${index}`" class="calendar-day placeholder" />
        <view
          v-for="day in calendarDays"
          :key="day.key"
          class="calendar-day"
          :class="{ active: day.count > 0, today: day.isToday, hot: day.count >= 2 }"
        >
          <text>{{ day.day }}</text>
          <view v-if="day.count > 0" class="day-count numeric">
            {{ day.count }}
          </view>
        </view>
      </view>
    </app-card>

    <text class="ios-section-title">今日记录</text>
    <app-card class="record-group" accent="green">
      <view v-if="todayRecords.length === 0" class="empty-state">
        <app-icon name="target" accent="green" size="md" />
        <text>还没有记录，点亮今天的第一格。</text>
      </view>
      <view
        v-for="(record, index) in todayRecords"
        v-else
        :key="record.id"
        class="record-row"
        :style="{ animationDelay: `${index * 35}ms` }"
      >
        <app-icon name="checkin" accent="green" size="sm" active />
        <view class="record-main">
          <text class="record-title">运动打卡</text>
          <text class="record-detail">{{ formatTime(record.checkedAt) }}</text>
        </view>
        <button class="row-action danger" hover-class="row-action-pressed" @click="handleDelete(record)">
          删除
        </button>
      </view>
    </app-card>

    <text class="ios-section-title">最近记录</text>
    <app-card class="record-group" accent="orange">
      <view v-if="recentRecords.length === 0" class="empty-state">
        <app-icon name="streak" accent="orange" size="md" />
        <text>持续运动后，时间线会在这里生长。</text>
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
    </app-card>
  </view>
</template>

<style scoped lang="scss">
.checkin-page {
  padding-right: 0;
  padding-left: 0;
}

.energy-card,
.calendar-card,
.record-group {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
  opacity: 0;
  transform: translateY(18rpx);
}

.ready .energy-card {
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.ready .calendar-card {
  animation: app-enter var(--app-motion-normal) 70ms var(--app-ease-out) both;
}

.ready .record-group {
  animation: app-enter var(--app-motion-normal) 120ms var(--app-ease-out) both;
}

.energy-card {
  padding: 30rpx;
}

.energy-card.pulse {
  animation: success-pop 320ms var(--app-ease-spring) both;
}

.hero-top,
.goal-panel,
.calendar-head,
.record-row,
.recent-row,
.checkin-button {
  display: flex;
  align-items: center;
}

.hero-top {
  justify-content: space-between;
  gap: 28rpx;
}

.eyebrow,
.goal-caption,
.goal-status,
.record-detail,
.recent-time,
.recent-event,
.month-subtitle {
  color: var(--app-label-secondary);
}

.eyebrow,
.goal-caption {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
}

.streak-value {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 8rpx;
  color: var(--app-green);
  font-size: 76rpx;
  font-weight: 860;
  line-height: 1.05;
}

.streak-unit {
  font-size: 25rpx;
  font-weight: 720;
}

.goal-panel {
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 28rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: var(--app-fill);
}

.goal-status,
.goal-fraction {
  display: block;
}

.goal-status {
  margin-top: 4rpx;
  font-size: 23rpx;
}

.goal-fraction {
  color: var(--app-green);
  font-size: 38rpx;
  font-weight: 820;
}

.checkin-action {
  position: relative;
  margin-top: 26rpx;
}

.checkin-button {
  position: relative;
  z-index: 2;
  justify-content: center;
  width: 100%;
  height: 124rpx;
  gap: 16rpx;
  padding: 0;
  border-radius: 30rpx;
  color: #fff;
  background: linear-gradient(135deg, var(--app-green), var(--app-green-deep));
  box-shadow:
    0 12rpx 0 var(--app-green-deep),
    0 22rpx 34rpx rgba(32, 196, 107, 0.2),
    inset 0 3rpx 0 rgba(255, 255, 255, 0.25);
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    box-shadow var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.checkin-button-pressed,
.checkin-button.checking {
  opacity: 0.9;
  transform: translateY(8rpx) scale(0.99);
  box-shadow:
    0 4rpx 0 var(--app-green-deep),
    0 8rpx 18rpx rgba(32, 196, 107, 0.16);
}

.button-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.button-main {
  font-size: 34rpx;
  font-weight: 800;
}

.button-sub {
  margin-top: 5rpx;
  font-size: 22rpx;
  opacity: 0.82;
}

.success-ring {
  position: absolute;
  inset: 0;
  border-radius: 30rpx;
  background: var(--app-green-soft);
  animation: ring-spread 420ms ease-out forwards;
}

.calendar-card {
  padding: 28rpx 24rpx 26rpx;
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

.icon-button-pressed,
.row-action-pressed {
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

.calendar-day.active {
  color: var(--app-green);
  background: var(--app-green-soft);
  font-weight: 750;
}

.calendar-day.hot {
  color: #fff;
  background: linear-gradient(135deg, var(--app-green), var(--app-blue));
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
  background: var(--app-orange);
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
  min-height: 106rpx;
  margin-left: 24rpx;
  padding: 18rpx 24rpx 18rpx 0;
  border-bottom: 1rpx solid var(--app-separator);
  box-sizing: border-box;
}

.record-row:last-child,
.recent-row:last-child {
  border-bottom: 0;
}

.record-row {
  gap: 18rpx;
  animation: app-enter 230ms ease-out both;
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

.row-action {
  min-width: 88rpx;
  height: 56rpx;
  padding: 0 16rpx;
  border-radius: 16rpx;
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
  left: 12rpx;
  width: 18rpx;
  height: 18rpx;
  border: 5rpx solid var(--app-orange-soft);
  border-radius: 50%;
  background: var(--app-orange);
  box-sizing: content-box;
}

.recent-copy {
  flex: 1;
  min-width: 0;
}

.recent-event {
  display: block;
  margin-top: 5rpx;
  font-size: 22rpx;
}

.recent-time {
  flex: 0 0 auto;
  margin: 0;
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

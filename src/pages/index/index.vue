<script lang="ts" setup>
import type { CheckInRecord, CheckInStatsRes, MonthCheckInRes } from '@/api/checkins'
import { createCheckIn, deleteCheckIn, getCheckInStats, getMonthCheckIns, getRecentCheckIns, getTodayCheckIns } from '@/api/checkins'
import { useTokenStore } from '@/store'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: '运动打卡',
    navigationBarBackgroundColor: '#ecfdf5',
    navigationBarTextStyle: 'black',
  },
})

interface CalendarDay {
  key: string
  day: number
  count: number
  isToday: boolean
}

const emptyStats: CheckInStatsRes = {
  weekStart: '',
  weekEnd: '',
  weekTotal: 0,
  activeDays: 0,
  currentStreak: 0,
  weekDays: [],
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

const heroHint = computed(() => {
  if (checkInStats.value.currentStreak > 0) {
    return `连续 ${checkInStats.value.currentStreak} 天`
  }
  return '今日打卡'
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
  finally {
    loading.value = false
  }
}

async function ensureLogin() {
  if (tokenStore.updateNowTime().hasLogin) {
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
    uni.showToast({
      title: '打卡成功',
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
  <view class="checkin-page" :class="{ ready: pageReady }">
    <view class="hero">
      <view>
        <view class="eyebrow">
          {{ todayLabel }}
        </view>
        <view class="title">
          运动打卡
        </view>
        <view class="subtitle">
          {{ heroHint }}
        </view>
      </view>
      <view class="count-pill" :class="{ bump: successPulse }">
        <text class="count-number">
          {{ checkInStats.currentStreak }}
        </text>
        <text class="count-label">
          连续天数
        </text>
      </view>
    </view>

    <view class="action-section">
      <button
        class="checkin-button"
        :class="{ checking, success: successPulse }"
        :disabled="checking || loading"
        hover-class="checkin-button-pressed"
        @click="handleCheckIn"
      >
        <text class="button-main">
          {{ checking ? '记录中' : '立即打卡' }}
        </text>
        <text class="button-sub">
          今日第 {{ todayCount + 1 }} 次
        </text>
      </button>
      <view v-if="successPulse" class="success-ring" />
    </view>

    <view class="section">
      <view class="section-head month-head">
        <button class="month-button" @click="changeMonth(-1)">
          上月
        </button>
        <view class="month-title-wrap" @click="backToCurrentMonth">
          <text class="section-title">
            {{ monthTitle }}
          </text>
          <text class="section-note">
            月度概览
          </text>
        </view>
        <button class="month-button" @click="changeMonth(1)">
          下月
        </button>
      </view>
      <view class="calendar-grid">
        <view
          v-for="day in calendarDays"
          :key="day.key"
          class="calendar-day"
          :class="{ active: day.count > 0, today: day.isToday }"
        >
          <text>{{ day.day }}</text>
          <view v-if="day.count > 0" class="day-dot">
            {{ day.count }}
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">
          今日记录
        </text>
        <text class="section-note">
          {{ todayCount }} 次
        </text>
      </view>
      <view v-if="todayRecords.length === 0" class="empty-state">
        暂无记录
      </view>
      <view v-else class="record-list">
        <view
          v-for="(record, index) in todayRecords"
          :key="record.id"
          class="record-item"
          :style="{ animationDelay: `${index * 35}ms` }"
        >
          <view>
            <view class="record-time">
              {{ formatTime(record.checkedAt) }}
            </view>
            <view class="record-label">
              运动打卡
            </view>
          </view>
          <button class="delete-button" @click="handleDelete(record)">
            删除
          </button>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">
          最近打卡
        </text>
        <text class="section-note">
          最近 12 次
        </text>
      </view>
      <view v-if="recentRecords.length === 0" class="empty-state">
        暂无记录
      </view>
      <view v-else class="recent-list">
        <view v-for="record in recentRecords" :key="record.id" class="recent-item">
          <text>{{ formatRecordDate(record.checkedAt) }}</text>
          <text>{{ formatTime(record.checkedAt) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.checkin-page {
  min-height: 100vh;
  padding: 28rpx 28rpx 150rpx;
  background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 46%, #ffffff 100%);
  color: #0f172a;
  box-sizing: border-box;
}

.hero,
.action-section,
.section {
  opacity: 0;
  transform: translateY(18rpx);
}

.ready .hero {
  animation: page-enter 240ms ease-out both;
}

.ready .action-section {
  animation: page-enter 260ms ease-out 45ms both;
}

.ready .section {
  animation: page-enter 260ms ease-out 90ms both;
}

.ready .section:nth-of-type(4) {
  animation-delay: 125ms;
}

.ready .section:nth-of-type(5) {
  animation-delay: 160ms;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 20rpx 0 28rpx;
}

.eyebrow {
  color: #047857;
  font-size: 26rpx;
  font-weight: 600;
}

.title {
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1.2;
}

.subtitle {
  margin-top: 12rpx;
  color: #475569;
  font-size: 28rpx;
}

.count-pill {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 148rpx;
  height: 148rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 42rpx rgba(15, 118, 110, 0.14);
  transition: transform 180ms ease-out;
}

.count-pill.bump {
  animation: count-bump 260ms ease-out;
}

.count-number {
  color: #059669;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1;
}

.count-label {
  margin-top: 10rpx;
  color: #64748b;
  font-size: 22rpx;
}

.action-section {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 24rpx 0 36rpx;
}

.checkin-button {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 340rpx;
  height: 340rpx;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(145deg, #10b981, #0f766e);
  box-shadow: 0 26rpx 60rpx rgba(15, 118, 110, 0.28);
  animation: breathe 2100ms ease-in-out infinite;
  transform: translateZ(0);
  overflow: hidden;
}

.checkin-button::after {
  border: 0;
}

.checkin-button::before {
  content: '';
  position: absolute;
  inset: 28rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  opacity: 0;
  transform: scale(0.72);
}

.checkin-button-pressed,
.checkin-button.checking {
  transform: scale(0.96);
  opacity: 0.92;
}

.checkin-button-pressed::before,
.checkin-button.checking::before {
  animation: tap-ripple 260ms ease-out;
}

.checkin-button.success {
  animation: success-pop 280ms ease-out;
}

.button-main {
  font-size: 44rpx;
  font-weight: 800;
}

.button-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.82;
}

.success-ring {
  position: absolute;
  top: 24rpx;
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.18);
  animation: ring-spread 340ms ease-out forwards;
}

.section {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.92);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
}

.section-note {
  color: #64748b;
  font-size: 24rpx;
}

.month-head {
  align-items: center;
}

.month-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.month-button {
  flex: 0 0 auto;
  min-width: 104rpx;
  height: 60rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  color: #047857;
  background: #d1fae5;
  font-size: 24rpx;
  line-height: 60rpx;
}

.month-button::after {
  border: 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12rpx;
}

.calendar-day {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68rpx;
  border-radius: 14rpx;
  color: #64748b;
  font-size: 24rpx;
  background: #f8fafc;
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}

.calendar-day.active {
  color: #065f46;
  background: #d1fae5;
}

.calendar-day.today {
  box-shadow: inset 0 0 0 2rpx #10b981;
}

.day-dot {
  position: absolute;
  right: 6rpx;
  bottom: 6rpx;
  min-width: 24rpx;
  height: 24rpx;
  padding: 0 6rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: #059669;
  font-size: 18rpx;
  line-height: 24rpx;
  text-align: center;
}

.empty-state {
  padding: 28rpx;
  border-radius: 14rpx;
  color: #64748b;
  background: #f8fafc;
  font-size: 26rpx;
  text-align: center;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  animation: item-enter 220ms ease-out both;
}

.record-time {
  font-size: 32rpx;
  font-weight: 700;
}

.record-label {
  margin-top: 4rpx;
  color: #64748b;
  font-size: 24rpx;
}

.delete-button {
  flex: 0 0 auto;
  min-width: 96rpx;
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  color: #0f766e;
  background: #ccfbf1;
  font-size: 24rpx;
  line-height: 56rpx;
}

.delete-button::after {
  border: 0;
}

.recent-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.recent-item {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  color: #334155;
  background: #f8fafc;
  font-size: 24rpx;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.025);
  }
}

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(18rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes tap-ripple {
  from {
    opacity: 0.5;
    transform: scale(0.72);
  }

  to {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes success-pop {
  0% {
    transform: scale(0.96);
  }

  70% {
    transform: scale(1.04);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes ring-spread {
  from {
    opacity: 0.8;
    transform: scale(0.9);
  }

  to {
    opacity: 0;
    transform: scale(1.28);
  }
}

@keyframes item-enter {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes count-bump {
  0% {
    transform: scale(1);
  }

  60% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
}
</style>

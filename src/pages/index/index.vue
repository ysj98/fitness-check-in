<script lang="ts" setup>
import type { CheckInRecord, CheckInStatsRes, MonthCheckInRes } from '@/api/checkins'
import {
  createCheckIn,
  deleteCheckIn,
  getCheckInStats,
  getMonthCheckIns,
  getRecentCheckIns,
  getTodayCheckIns,
} from '@/api/checkins'
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

interface RecentDaySummary {
  key: string
  label: string
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
const selectedDateKey = ref(formatDateKey(new Date()))
const recentExpanded = ref(false)
const activeRecordActionId = ref<number | null>(null)
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

const goalText = computed(() => {
  const goal = checkInStats.value.todayGoal || 1
  return `已完成 ${Math.min(todayCount.value, goal)}/${goal}`
})

const checkInButtonText = computed(() => {
  if (checking.value) {
    return '打卡中...'
  }
  if (successPulse.value) {
    return '打卡成功'
  }
  return checkInStats.value.todayCompleted ? '继续打卡' : '立即打卡'
})

const checkInSummaryText = computed(() => {
  return `今天已打卡 ${todayCount.value} 次，连续坚持 ${checkInStats.value.currentStreak} 天`
})

const recentDaySummaries = computed<RecentDaySummary[]>(() => {
  const countMap = recentRecords.value.reduce<Record<string, number>>((result, record) => {
    const key = formatDateKey(new Date(record.checkedAt))
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    const key = formatDateKey(date)
    return {
      key,
      label: index === 0 ? '今天' : `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
      count: countMap[key] || 0,
      isToday: index === 0,
    }
  })
})

const visibleRecentDaySummaries = computed(() => {
  return recentExpanded.value ? recentDaySummaries.value : recentDaySummaries.value.slice(0, 3)
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
    recentRecords.value = [record, ...recentRecords.value].slice(0, 100)
    const [month, stats] = await Promise.all([getMonthCheckIns(monthKey.value), getCheckInStats()])
    monthStats.value = month
    checkInStats.value = stats
    triggerSuccessHaptic()
    uni.showToast({
      title: stats.todayCompleted ? '今日目标达成' : '打卡成功',
      icon: 'success',
    })
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

function selectCalendarDay(day: CalendarDay) {
  selectedDateKey.value = day.key
}

function toggleRecordActions(recordId: number) {
  activeRecordActionId.value = activeRecordActionId.value === recordId ? null : recordId
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
</script>

<template>
  <view class="app-page checkin-page" :class="{ ready: pageReady }">
    <ios-page-header title="运动" :subtitle="todayLabel" accent="green" />

    <view class="energy-card-shell">
      <app-card accent="green" elevated>
        <view class="energy-card-content" :class="{ pulse: successPulse }">
          <view class="goal-panel">
            <view>
              <text class="goal-caption">今日目标</text>
              <text class="goal-status">{{ goalText }}</text>
            </view>
            <text class="goal-fraction numeric"> {{ todayCount }}/{{ checkInStats.todayGoal || 1 }} </text>
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
                <text class="button-main">{{ checkInButtonText }}</text>
                <text class="button-sub">今日第 {{ todayCount + 1 }} 次</text>
              </view>
            </button>
            <view v-if="successPulse" class="success-ring" />
          </view>

          <text class="checkin-summary">{{ checkInSummaryText }}</text>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">月度热力</text>
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
                selected: day.key === selectedDateKey,
              }"
              @click="selectCalendarDay(day)"
            >
              <text>{{ day.day }}</text>
              <view v-if="day.count > 0" class="day-count numeric">
                {{ day.count }}
              </view>
            </view>
          </view>
          <view class="heat-legend">
            <text>少</text>
            <view class="legend-dot level-1" />
            <view class="legend-dot level-2" />
            <view class="legend-dot level-3" />
            <text>多</text>
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
        >
          <app-icon name="checkin" accent="green" size="sm" active />
          <view class="record-main">
            <text class="record-title">运动打卡</text>
            <text class="record-detail">
              {{ formatTime(record.checkedAt) }}
            </text>
          </view>
          <view class="record-menu">
            <button
              class="more-action"
              aria-label="更多操作"
              hover-class="row-action-pressed"
              @click="toggleRecordActions(record.id)"
            >
              <text class="i-carbon-overflow-menu-horizontal" />
            </button>
            <button
              v-if="activeRecordActionId === record.id"
              class="row-action danger"
              hover-class="row-action-pressed"
              @click="handleDelete(record)"
            >
              删除
            </button>
          </view>
        </view>
      </app-card>
    </view>

    <text class="ios-section-title">最近 7 天</text>
    <view class="record-card-shell">
      <app-card class="record-card" accent="orange" :show-accent="false">
        <view v-if="recentRecords.length === 0" class="empty-state">
          <app-icon name="streak" accent="orange" size="md" />
          <text>持续运动后，时间线会在这里生长。</text>
        </view>
        <view
          v-for="day in visibleRecentDaySummaries"
          v-else
          :key="day.key"
          class="recent-row"
          :class="{ muted: day.count === 0 }"
        >
          <view class="timeline-marker">
            <view class="timeline-dot" :class="{ empty: day.count === 0 }" />
          </view>
          <view class="recent-copy">
            <text class="recent-date">{{ day.label }}</text>
            <text class="recent-event">
              {{ day.count > 0 ? '运动打卡' : '未打卡' }}
            </text>
          </view>
          <text class="recent-time numeric">
            {{ day.count > 0 ? `${day.count} 次` : '未完成' }}
          </text>
        </view>
        <button
          v-if="recentRecords.length > 0"
          class="recent-toggle"
          hover-class="recent-toggle-pressed"
          @click="recentExpanded = !recentExpanded"
        >
          {{ recentExpanded ? '收起' : '展开全部' }}
        </button>
      </app-card>
    </view>
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

.goal-panel,
.calendar-head,
.record-row,
.recent-row,
.checkin-button {
  display: flex;
  align-items: center;
}

.goal-caption,
.goal-status,
.record-detail,
.recent-time,
.recent-event,
.month-subtitle {
  color: var(--app-label-secondary);
}

.goal-caption {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
}

.goal-panel {
  justify-content: space-between;
  gap: 24rpx;
  padding: 24rpx 26rpx;
  border-radius: 24rpx;
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
  margin-top: 30rpx;
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

.button-sub {
  margin-top: 8rpx;
  font-size: 25rpx;
  opacity: 0.82;
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

.heat-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  margin-top: 22rpx;
  color: var(--app-label-tertiary);
  font-size: 19rpx;
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

.record-row.actions-open {
  align-items: center;
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

.record-menu {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8rpx;
}

.more-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 48rpx;
  padding: 0;
  border-radius: 14rpx;
  color: var(--app-label-tertiary);
  background: transparent;
  font-size: 28rpx;
  line-height: 48rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out,
    background-color var(--app-motion-fast) ease-out;
}

.actions-open .more-action {
  color: var(--app-label-secondary);
  background: var(--app-fill);
}

.row-action {
  min-width: 68rpx;
  height: 48rpx;
  padding: 0 12rpx;
  border-radius: 14rpx;
  color: rgba(255, 90, 110, 0.72);
  background: rgba(255, 90, 110, 0.08);
  font-size: 21rpx;
  line-height: 48rpx;
  transition:
    transform var(--app-motion-fast) ease-out,
    opacity var(--app-motion-fast) ease-out;
}

.recent-row {
  justify-content: flex-start;
  min-height: 92rpx;
}

.recent-row.muted {
  opacity: 0.72;
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
  left: 24rpx;
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

.timeline-dot.empty {
  border-color: var(--app-surface-tertiary);
  background: var(--app-label-tertiary);
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

.recent-row.muted .recent-time {
  color: var(--app-label-tertiary);
  font-size: 21rpx;
}

.recent-toggle {
  height: 74rpx;
  margin: 8rpx 24rpx 20rpx;
  border-radius: 18rpx;
  color: var(--app-green);
  background: var(--app-green-soft);
  font-size: 24rpx;
  font-weight: 680;
  line-height: 74rpx;
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

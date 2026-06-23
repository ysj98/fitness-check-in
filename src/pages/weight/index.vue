<script lang="ts" setup>
import type { WeightRecord, WeightStatsRes, WeightUnit } from '@/api/weights'
import {
  createWeight,
  deleteWeight,
  fromWeightKg,
  getWeights,
  getWeightStats,
  toWeightKg,
  updateWeight,
  updateWeightSettings,
} from '@/api/weights'
import { useThemeStore, useTokenStore, useUserStore } from '@/store'
import { triggerSuccessHaptic } from '@/utils/haptics'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '体重管理',
  },
})

type TrendMetric = 'weight' | 'bmi'

const emptyStats: WeightStatsRes = {
  days: 30,
  currentWeightKg: null,
  previousWeightKg: null,
  changeKg: null,
  targetWeightKg: null,
  distanceToTargetKg: null,
  heightCm: null,
  weightUnit: 'kg',
  bmi: null,
  bmiCategory: null,
  bmiLabel: '',
  trend: [],
}

const tokenStore = useTokenStore()
const userStore = useUserStore()
const themeStore = useThemeStore()
const loading = ref(false)
const loadFailed = ref(false)
const savingRecord = ref(false)
const savingSettings = ref(false)
const successPulse = ref(false)
const recordModalVisible = ref(false)
const settingsModalVisible = ref(false)
const editingRecord = ref<WeightRecord | null>(null)
const selectedDays = ref<7 | 30 | 90>(30)
const trendMetric = ref<TrendMetric>('weight')
const records = ref<WeightRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const stats = ref<WeightStatsRes>({ ...emptyStats })
const recordForm = reactive({
  weight: '',
  date: '',
  time: '',
})
const settingsForm = reactive({
  heightCm: '',
  targetWeight: '',
  weightUnit: 'kg' as WeightUnit,
})

const unitLabel = computed(() => stats.value.weightUnit === 'jin' ? '斤' : 'kg')
const currentWeight = computed(() => displayWeight(stats.value.currentWeightKg))
const targetWeight = computed(() => displayWeight(stats.value.targetWeightKg))
const targetDistance = computed(() => displayWeight(stats.value.distanceToTargetKg))
const canLoadMore = computed(() => records.value.length < total.value)
const bmiReady = computed(() => Boolean(stats.value.heightCm))
const chartData = computed(() => ({
  categories: stats.value.trend.map(item => item.date.slice(5)),
  series: [{
    name: trendMetric.value === 'weight' ? `体重(${unitLabel.value})` : 'BMI',
    data: stats.value.trend.map(item => trendMetric.value === 'weight'
      ? fromWeightKg(item.weightKg, stats.value.weightUnit)
      : item.bmi ?? 0),
  }],
}))
const chartOpts = computed(() => ({
  color: [themeStore.isDark ? '#0a84ff' : '#007aff'],
  padding: [12, 12, 4, 8],
  dataLabel: false,
  dataPointShape: true,
  legend: { show: false },
  xAxis: {
    disableGrid: true,
    fontColor: themeStore.isDark ? '#98989d' : '#8e8e93',
    axisLineColor: themeStore.isDark ? '#38383a' : '#d1d1d6',
  },
  yAxis: {
    gridType: 'dash',
    dashLength: 4,
    gridColor: themeStore.isDark ? '#2c2c2e' : '#e5e5ea',
    data: [{
      title: trendMetric.value === 'weight' ? unitLabel.value : 'BMI',
      tofix: 1,
      fontColor: themeStore.isDark ? '#98989d' : '#8e8e93',
    }],
  },
  extra: {
    line: {
      type: 'curve',
      width: 3,
      activeType: 'hollow',
    },
  },
}))

onShow(() => {
  loadPage()
})

async function ensureLogin() {
  if (!tokenStore.updateNowTime().hasLogin) {
    await tokenStore.wxLogin()
  }
}

async function loadPage() {
  if (loading.value) {
    return
  }
  loading.value = true
  loadFailed.value = false
  try {
    await ensureLogin()
    const [list, nextStats] = await Promise.all([
      getWeights(1, pageSize),
      getWeightStats(selectedDays.value),
    ])
    records.value = list.items
    total.value = list.total
    page.value = 1
    stats.value = nextStats
  }
  catch {
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!canLoadMore.value || loading.value) {
    return
  }
  loading.value = true
  try {
    const nextPage = page.value + 1
    const list = await getWeights(nextPage, pageSize)
    records.value = [...records.value, ...list.items]
    total.value = list.total
    page.value = nextPage
  }
  finally {
    loading.value = false
  }
}

async function selectDays(days: 7 | 30 | 90) {
  if (selectedDays.value === days) {
    return
  }
  selectedDays.value = days
  stats.value = await getWeightStats(days)
}

function selectMetric(metric: TrendMetric) {
  if (metric === 'bmi' && !bmiReady.value) {
    openSettings()
    return
  }
  trendMetric.value = metric
}

function openCreateRecord() {
  editingRecord.value = null
  const now = getChinaDateTimeParts(new Date())
  recordForm.weight = stats.value.currentWeightKg === null
    ? ''
    : String(fromWeightKg(stats.value.currentWeightKg, stats.value.weightUnit))
  recordForm.date = now.date
  recordForm.time = now.time
  recordModalVisible.value = true
}

function openEditRecord(record: WeightRecord) {
  editingRecord.value = record
  const measuredAt = getChinaDateTimeParts(new Date(record.measuredAt))
  recordForm.weight = String(fromWeightKg(record.weightKg, stats.value.weightUnit))
  recordForm.date = measuredAt.date
  recordForm.time = measuredAt.time
  recordModalVisible.value = true
}

function closeRecordModal() {
  if (!savingRecord.value) {
    recordModalVisible.value = false
  }
}

function handleRecordDateChange(event: { detail: { value: string } }) {
  recordForm.date = event.detail.value
}

function handleRecordTimeChange(event: { detail: { value: string } }) {
  recordForm.time = event.detail.value
}

async function saveRecord() {
  const inputWeight = Number(recordForm.weight)
  const weightKg = toWeightKg(inputWeight, stats.value.weightUnit)
  if (!Number.isFinite(inputWeight) || weightKg < 20 || weightKg > 300) {
    uni.showToast({ title: `请输入有效体重（${stats.value.weightUnit === 'jin' ? '40-600 斤' : '20-300 kg'}）`, icon: 'none' })
    return
  }
  const measuredAt = new Date(`${recordForm.date}T${recordForm.time}:00+08:00`)
  if (Number.isNaN(measuredAt.getTime()) || measuredAt.getTime() > Date.now() + 60 * 1000) {
    uni.showToast({ title: '测量时间不能晚于当前时间', icon: 'none' })
    return
  }

  savingRecord.value = true
  try {
    const payload = { weightKg, measuredAt: measuredAt.toISOString() }
    if (editingRecord.value) {
      await updateWeight(editingRecord.value.id, payload)
    }
    else {
      await createWeight(payload)
    }
    recordModalVisible.value = false
    await refreshWeightData()
    successPulse.value = true
    triggerSuccessHaptic()
    uni.showToast({ title: editingRecord.value ? '记录已更新' : '体重已记录', icon: 'success' })
    setTimeout(() => {
      successPulse.value = false
    }, 320)
  }
  finally {
    savingRecord.value = false
  }
}

async function confirmDelete(record: WeightRecord) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除记录',
      content: `删除 ${formatDateTime(record.measuredAt)} 的体重记录？`,
      confirmColor: '#dc2626',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) {
    return
  }
  await deleteWeight(record.id)
  await refreshWeightData()
  uni.showToast({ title: '记录已删除', icon: 'none' })
}

async function refreshWeightData() {
  const [list, nextStats] = await Promise.all([
    getWeights(1, pageSize),
    getWeightStats(selectedDays.value),
  ])
  records.value = list.items
  total.value = list.total
  page.value = 1
  stats.value = nextStats
}

function openSettings() {
  settingsForm.heightCm = stats.value.heightCm === null ? '' : String(stats.value.heightCm)
  settingsForm.targetWeight = stats.value.targetWeightKg === null
    ? ''
    : String(fromWeightKg(stats.value.targetWeightKg, stats.value.weightUnit))
  settingsForm.weightUnit = stats.value.weightUnit
  settingsModalVisible.value = true
}

function closeSettingsModal() {
  if (!savingSettings.value) {
    settingsModalVisible.value = false
  }
}

function selectSettingsUnit(unit: WeightUnit) {
  if (settingsForm.weightUnit === unit) {
    return
  }
  const currentTarget = Number(settingsForm.targetWeight)
  if (Number.isFinite(currentTarget) && currentTarget > 0) {
    const targetKg = toWeightKg(currentTarget, settingsForm.weightUnit)
    settingsForm.targetWeight = String(fromWeightKg(targetKg, unit))
  }
  settingsForm.weightUnit = unit
}

async function saveSettings() {
  const heightCm = settingsForm.heightCm === '' ? null : Number(settingsForm.heightCm)
  const targetInput = settingsForm.targetWeight === '' ? null : Number(settingsForm.targetWeight)
  const targetWeightKg = targetInput === null ? null : toWeightKg(targetInput, settingsForm.weightUnit)
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
    uni.showToast({ title: '请输入 100-250 cm 的身高', icon: 'none' })
    return
  }
  if (targetWeightKg !== null && (!Number.isFinite(targetWeightKg) || targetWeightKg < 20 || targetWeightKg > 300)) {
    uni.showToast({ title: '请输入有效目标体重', icon: 'none' })
    return
  }

  savingSettings.value = true
  try {
    const userInfo = await updateWeightSettings({
      heightCm,
      targetWeightKg,
      weightUnit: settingsForm.weightUnit,
    })
    userStore.setUserInfo(userInfo)
    settingsModalVisible.value = false
    await refreshWeightData()
    uni.showToast({ title: '设置已保存', icon: 'success' })
  }
  finally {
    savingSettings.value = false
  }
}

function displayWeight(value: number | null) {
  return value === null ? '--' : fromWeightKg(value, stats.value.weightUnit).toFixed(1)
}

function formatChange() {
  if (stats.value.changeKg === null) {
    return '--'
  }
  const value = fromWeightKg(Math.abs(stats.value.changeKg), stats.value.weightUnit)
  const sign = stats.value.changeKg > 0 ? '+' : stats.value.changeKg < 0 ? '-' : ''
  return `${sign}${value.toFixed(1)}`
}

function formatDateTime(value: string) {
  const parts = getChinaDateTimeParts(new Date(value))
  return `${parts.date.slice(5).replace('-', '月')}日 ${parts.time}`
}

function getChinaDateTimeParts(date: Date) {
  const chinaDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const iso = chinaDate.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}
</script>

<template>
  <view class="app-page weight-page">
    <ios-page-header title="体重" subtitle="健康趋势" />

    <view v-if="loadFailed" class="state-panel">
      <text>加载失败</text>
      <button class="retry-button" @click="loadPage">
        重新加载
      </button>
    </view>

    <template v-else>
      <view class="hero ios-card" :class="{ pulse: successPulse }">
        <view class="hero-main">
          <text class="hero-label">当前体重</text>
          <view class="weight-value">
            <text class="weight-number">{{ currentWeight }}</text>
            <text class="weight-unit">{{ unitLabel }}</text>
          </view>
          <text class="hero-change">较上次 {{ formatChange() }} {{ unitLabel }}</text>
        </view>
        <button class="settings-button" aria-label="体重设置" hover-class="control-pressed" @click="openSettings">
          <text class="i-carbon-settings" />
        </button>
      </view>

      <view class="summary-grid">
        <view class="summary-item bmi-card">
          <text class="summary-label">BMI</text>
          <text class="summary-value">{{ stats.bmi ?? '--' }}</text>
          <text v-if="bmiReady" class="summary-note">{{ stats.bmiLabel }}</text>
          <button v-else class="height-action" @click="openSettings">
            设置身高
          </button>
        </view>
        <view class="summary-item goal-card">
          <text class="summary-label">目标体重</text>
          <text class="summary-value">{{ targetWeight }}</text>
          <text class="summary-note">{{ stats.targetWeightKg === null ? '未设置' : unitLabel }}</text>
        </view>
        <view class="summary-item distance-card">
          <text class="summary-label">距离目标</text>
          <text class="summary-value">{{ targetDistance }}</text>
          <text class="summary-note">{{ stats.distanceToTargetKg === null ? '未计算' : unitLabel }}</text>
        </view>
      </view>

      <button class="record-button" hover-class="record-button-pressed" @click="openCreateRecord">
        <text class="i-carbon-add" />
        <text>记录体重</text>
      </button>

      <text class="ios-section-title">数据趋势</text>
      <view class="section ios-card trend-section">
        <view class="section-head">
          <text class="section-title">趋势</text>
          <view class="metric-switch">
            <button :class="{ active: trendMetric === 'weight' }" @click="selectMetric('weight')">
              体重
            </button>
            <button :class="{ active: trendMetric === 'bmi', disabled: !bmiReady }" @click="selectMetric('bmi')">
              BMI
            </button>
          </view>
        </view>
        <view class="range-switch">
          <button v-for="days in ([7, 30, 90] as const)" :key="days" :class="{ active: selectedDays === days }" @click="selectDays(days)">
            {{ days }}天
          </button>
        </view>
        <view v-if="loading && stats.trend.length === 0" class="chart-loading">
          加载中
        </view>
        <view v-else-if="stats.trend.length === 0" class="chart-empty">
          暂无趋势数据
        </view>
        <view v-else class="chart-box">
          <qiun-data-charts type="line" :opts="chartOpts" :chart-data="chartData" :canvas2d="true" />
        </view>
      </view>

      <text class="ios-section-title">历史记录</text>
      <view class="section ios-card history-section">
        <view class="section-head">
          <text class="section-title">全部记录</text>
          <text class="section-count">{{ total }} 条</text>
        </view>
        <view v-if="records.length === 0" class="empty-list">
          暂无体重记录
        </view>
        <view v-else class="record-list">
          <view v-for="(record, index) in records" :key="record.id" class="record-item" :style="{ animationDelay: `${Math.min(index, 8) * 30}ms` }">
            <view class="record-data">
              <text class="record-weight">{{ fromWeightKg(record.weightKg, stats.weightUnit).toFixed(1) }} {{ unitLabel }}</text>
              <text class="record-date">{{ formatDateTime(record.measuredAt) }}</text>
            </view>
            <view class="record-bmi">
              <text>BMI</text>
              <text class="record-bmi-value">{{ record.bmi ?? '--' }}</text>
            </view>
            <view class="record-actions">
              <button hover-class="mini-button-pressed" @click="openEditRecord(record)">
                <text class="i-carbon-edit" />
                <text>编辑</text>
              </button>
              <button class="danger" hover-class="mini-button-pressed" @click="confirmDelete(record)">
                <text class="i-carbon-trash-can" />
                <text>删除</text>
              </button>
            </view>
          </view>
        </view>
        <button v-if="canLoadMore" class="load-more" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中' : '加载更多' }}
        </button>
        <view v-else-if="records.length > 0" class="list-end">
          已显示全部记录
        </view>
      </view>
    </template>

    <view v-if="recordModalVisible" class="modal-mask" @click.self="closeRecordModal">
      <view class="sheet">
        <view class="sheet-grabber" />
        <view class="sheet-head">
          <button class="toolbar-button" @click="closeRecordModal">
            取消
          </button>
          <text class="sheet-title">{{ editingRecord ? '编辑体重' : '记录体重' }}</text>
          <button class="toolbar-button primary" :disabled="savingRecord" @click="saveRecord">
            {{ savingRecord ? '保存中' : '保存' }}
          </button>
        </view>
        <view class="weight-input-row">
          <input v-model="recordForm.weight" class="weight-input" type="digit" :maxlength="6" focus placeholder="0.0">
          <text>{{ unitLabel }}</text>
        </view>
        <view class="form-group">
          <view class="form-row">
            <text class="form-label">测量日期</text>
            <picker mode="date" :value="recordForm.date" @change="handleRecordDateChange">
              <view class="picker-value">
                {{ recordForm.date }}
              </view>
            </picker>
          </view>
          <view class="form-row">
            <text class="form-label">测量时间</text>
            <picker mode="time" :value="recordForm.time" @change="handleRecordTimeChange">
              <view class="picker-value">
                {{ recordForm.time }}
              </view>
            </picker>
          </view>
        </view>
      </view>
    </view>

    <view v-if="settingsModalVisible" class="modal-mask" @click.self="closeSettingsModal">
      <view class="sheet">
        <view class="sheet-grabber" />
        <view class="sheet-head">
          <button class="toolbar-button" @click="closeSettingsModal">
            取消
          </button>
          <text class="sheet-title">体重设置</text>
          <button class="toolbar-button primary" :disabled="savingSettings" @click="saveSettings">
            {{ savingSettings ? '保存中' : '保存' }}
          </button>
        </view>
        <view class="form-group settings-group">
          <view class="form-row input-form-row">
            <text class="form-label">身高</text>
            <view class="inline-input">
              <input v-model="settingsForm.heightCm" type="digit" :maxlength="5" placeholder="未设置">
              <text>cm</text>
            </view>
          </view>
          <view class="form-row input-form-row">
            <text class="form-label">目标体重</text>
            <view class="inline-input">
              <input v-model="settingsForm.targetWeight" type="digit" :maxlength="6" placeholder="未设置">
              <text>{{ settingsForm.weightUnit === 'jin' ? '斤' : 'kg' }}</text>
            </view>
          </view>
          <view class="form-row unit-row">
            <text class="form-label">显示单位</text>
            <view class="unit-switch">
              <button :class="{ active: settingsForm.weightUnit === 'kg' }" @click="selectSettingsUnit('kg')">
                kg
              </button>
              <button :class="{ active: settingsForm.weightUnit === 'jin' }" @click="selectSettingsUnit('jin')">
                斤
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* Apple Health inspired presentation layer. */
.weight-page {
  padding: 0 0 calc(150rpx + env(safe-area-inset-bottom));
  color: var(--app-label-primary);
  background: var(--app-bg);
}

.hero,
.summary-grid,
.record-button,
.section,
.state-panel {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
}

.hero {
  padding: 30rpx;
  border: 0;
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.hero-label,
.summary-label,
.hero-change,
.summary-note,
.section-count,
.record-date,
.record-bmi,
.list-end,
.chart-empty,
.chart-loading,
.empty-list {
  color: var(--app-label-secondary);
}

.weight-number,
.weight-unit {
  color: var(--app-blue);
  font-variant-numeric: tabular-nums;
}

.weight-number {
  font-size: 76rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 76rpx;
  width: 76rpx;
  height: 76rpx;
  padding: 0;
  border-radius: 50%;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 32rpx;
  line-height: 76rpx;
}

.summary-grid {
  gap: 14rpx;
}

.summary-item {
  padding: 24rpx 12rpx;
  border: 0;
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.summary-value {
  font-variant-numeric: tabular-nums;
}

.bmi-card .summary-value {
  color: var(--app-orange);
}

.goal-card .summary-value {
  color: var(--app-pink);
}

.distance-card .summary-value {
  color: var(--app-blue);
}

.height-action {
  color: var(--app-orange);
}

.record-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 94rpx;
  border-radius: var(--app-control-radius);
  color: #fff;
  background: var(--app-green);
  box-shadow: 0 10rpx 24rpx rgba(52, 199, 89, 0.18);
  font-size: 30rpx;
  line-height: 94rpx;
}

.section {
  margin-top: 0;
  padding: 28rpx;
  border: 0;
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.metric-switch,
.range-switch,
.unit-switch {
  background: var(--app-fill);
}

.metric-switch button,
.range-switch button,
.unit-switch button {
  color: var(--app-label-secondary);
  background: transparent;
}

.metric-switch button.active,
.range-switch button.active,
.unit-switch button.active {
  color: var(--app-label-primary);
  background: var(--app-surface);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.chart-box {
  height: 350rpx;
}

.history-section {
  padding: 0;
  overflow: hidden;
}

.history-section .section-head {
  min-height: 88rpx;
  padding: 0 28rpx;
  border-bottom: 1rpx solid var(--app-separator);
}

.record-list {
  gap: 0;
  margin-top: 0;
}

.record-item {
  margin-left: 28rpx;
  padding: 22rpx 24rpx 22rpx 0;
  border-bottom: 1rpx solid var(--app-separator);
  border-radius: 0;
  background: transparent;
}

.record-item:last-child {
  border-bottom: 0;
}

.record-weight,
.record-bmi-value {
  color: var(--app-label-primary);
  font-variant-numeric: tabular-nums;
}

.record-bmi-value {
  color: var(--app-orange);
}

.record-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  color: var(--app-blue);
  background: var(--app-blue-soft);
}

.record-actions button.danger {
  color: var(--app-red);
  background: var(--app-pink-soft);
}

.load-more,
.retry-button {
  color: var(--app-blue);
  background: var(--app-blue-soft);
}

.state-panel {
  margin-top: 80rpx;
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
}

.state-panel text {
  color: var(--app-label-secondary);
}

.modal-mask {
  background: var(--app-mask);
}

.sheet {
  max-height: 88vh;
  padding: 14rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));
  border-radius: 30rpx 30rpx 0 0;
  color: var(--app-label-primary);
  background: var(--app-surface-secondary);
}

.sheet-grabber {
  width: 74rpx;
  height: 10rpx;
  margin: 0 auto 12rpx;
  border-radius: 999rpx;
  background: var(--app-fill-strong);
}

.sheet-head {
  min-height: 72rpx;
}

.sheet-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.toolbar-button {
  min-width: 112rpx;
  height: 64rpx;
  padding: 0 8rpx;
  color: var(--app-blue);
  background: transparent;
  font-size: 27rpx;
  line-height: 64rpx;
}

.toolbar-button:first-child {
  text-align: left;
}

.toolbar-button.primary {
  font-weight: 650;
  text-align: right;
}

.toolbar-button[disabled] {
  color: var(--app-label-tertiary);
}

.weight-input-row {
  margin: 30rpx 0 26rpx;
}

.weight-input {
  border-bottom-color: var(--app-blue);
  color: var(--app-label-primary);
  font-variant-numeric: tabular-nums;
}

.weight-input-row > text {
  color: var(--app-blue);
}

.form-group {
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  overflow: hidden;
}

.settings-group {
  margin-top: 26rpx;
}

.form-row {
  min-height: 102rpx;
  margin-left: 28rpx;
  padding-right: 28rpx;
  border-bottom-color: var(--app-separator);
}

.form-row:last-child {
  border-bottom: 0;
}

.form-label {
  color: var(--app-label-primary);
}

.picker-value,
.inline-input input {
  color: var(--app-label-primary);
}

.inline-input {
  color: var(--app-label-secondary);
}
</style>

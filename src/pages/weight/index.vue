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
import { useTokenStore, useUserStore } from '@/store'

definePage({
  style: {
    navigationBarTitleText: '体重管理',
    navigationBarBackgroundColor: '#ecfdf5',
    navigationBarTextStyle: 'black',
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
  color: ['#059669'],
  padding: [12, 12, 4, 8],
  dataLabel: false,
  dataPointShape: true,
  legend: { show: false },
  xAxis: {
    disableGrid: true,
    fontColor: '#64748b',
    axisLineColor: '#cbd5e1',
  },
  yAxis: {
    gridType: 'dash',
    dashLength: 4,
    gridColor: '#e2e8f0',
    data: [{
      title: trendMetric.value === 'weight' ? unitLabel.value : 'BMI',
      tofix: 1,
      fontColor: '#64748b',
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
  <view class="weight-page">
    <view v-if="loadFailed" class="state-panel">
      <text>加载失败</text>
      <button class="retry-button" @click="loadPage">
        重新加载
      </button>
    </view>

    <template v-else>
      <view class="hero" :class="{ pulse: successPulse }">
        <view class="hero-main">
          <text class="hero-label">当前体重</text>
          <view class="weight-value">
            <text class="weight-number">{{ currentWeight }}</text>
            <text class="weight-unit">{{ unitLabel }}</text>
          </view>
          <text class="hero-change">较上次 {{ formatChange() }} {{ unitLabel }}</text>
        </view>
        <button class="settings-button" hover-class="control-pressed" @click="openSettings">
          设置
        </button>
      </view>

      <view class="summary-grid">
        <view class="summary-item">
          <text class="summary-label">BMI</text>
          <text class="summary-value">{{ stats.bmi ?? '--' }}</text>
          <text v-if="bmiReady" class="summary-note">{{ stats.bmiLabel }}</text>
          <button v-else class="height-action" @click="openSettings">
            设置身高
          </button>
        </view>
        <view class="summary-item">
          <text class="summary-label">目标体重</text>
          <text class="summary-value">{{ targetWeight }}</text>
          <text class="summary-note">{{ stats.targetWeightKg === null ? '未设置' : unitLabel }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">距离目标</text>
          <text class="summary-value">{{ targetDistance }}</text>
          <text class="summary-note">{{ stats.distanceToTargetKg === null ? '未计算' : unitLabel }}</text>
        </view>
      </view>

      <button class="record-button" hover-class="record-button-pressed" @click="openCreateRecord">
        记录体重
      </button>

      <view class="section trend-section">
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

      <view class="section">
        <view class="section-head">
          <text class="section-title">历史记录</text>
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
                编辑
              </button>
              <button class="danger" hover-class="mini-button-pressed" @click="confirmDelete(record)">
                删除
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
        <view class="sheet-head">
          <text class="sheet-title">{{ editingRecord ? '编辑体重' : '记录体重' }}</text>
          <button class="close-button" @click="closeRecordModal">
            关闭
          </button>
        </view>
        <view class="weight-input-row">
          <input v-model="recordForm.weight" class="weight-input" type="digit" :maxlength="6" focus placeholder="0.0">
          <text>{{ unitLabel }}</text>
        </view>
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
        <button class="sheet-save" :disabled="savingRecord" hover-class="save-pressed" @click="saveRecord">
          {{ savingRecord ? '保存中' : '保存记录' }}
        </button>
      </view>
    </view>

    <view v-if="settingsModalVisible" class="modal-mask" @click.self="closeSettingsModal">
      <view class="sheet">
        <view class="sheet-head">
          <text class="sheet-title">体重设置</text>
          <button class="close-button" @click="closeSettingsModal">
            关闭
          </button>
        </view>
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
        <button class="sheet-save" :disabled="savingSettings" hover-class="save-pressed" @click="saveSettings">
          {{ savingSettings ? '保存中' : '保存设置' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.weight-page {
  min-height: 100vh;
  padding: 28rpx 28rpx 150rpx;
  color: #0f172a;
  background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 42%, #ffffff 100%);
  box-sizing: border-box;
}

button::after {
  border: 0;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  padding: 30rpx;
  border: 1px solid #a7f3d0;
  border-radius: 16rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 40rpx rgba(15, 118, 110, 0.12);
  animation: enter 240ms ease-out both;
}

.hero.pulse {
  animation: success-pop 280ms ease-out both;
}
.hero-main {
  min-width: 0;
}
.hero-label,
.summary-label {
  color: #64748b;
  font-size: 24rpx;
}
.weight-value {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 8rpx;
}
.weight-number {
  color: #047857;
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1.15;
}
.weight-unit {
  color: #047857;
  font-size: 28rpx;
  font-weight: 700;
}
.hero-change {
  display: block;
  margin-top: 12rpx;
  color: #475569;
  font-size: 24rpx;
}

.settings-button,
.retry-button {
  min-width: 104rpx;
  height: 72rpx;
  padding: 0 20rpx;
  color: #047857;
  background: #d1fae5;
  border-radius: 999rpx;
  font-size: 26rpx;
  line-height: 72rpx;
  transition:
    transform 160ms ease-out,
    opacity 160ms ease-out;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 20rpx;
  animation: enter 240ms 45ms ease-out both;
}

.summary-item {
  min-width: 0;
  padding: 22rpx 14rpx;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.94);
  text-align: center;
}

.summary-value {
  display: block;
  margin-top: 10rpx;
  font-size: 34rpx;
  font-weight: 800;
}
.summary-note {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 20rpx;
}

.record-button {
  height: 96rpx;
  margin-top: 24rpx;
  color: #ffffff;
  background: linear-gradient(145deg, #10b981, #0f766e);
  border-radius: 16rpx;
  box-shadow:
    0 18rpx 34rpx rgba(15, 118, 110, 0.22),
    inset 0 4rpx 0 rgba(255, 255, 255, 0.2);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 96rpx;
  transition:
    transform 160ms ease-out,
    opacity 160ms ease-out;
  animation: enter 240ms 75ms ease-out both;
}

.record-button-pressed {
  opacity: 0.9;
  transform: translateY(3rpx) scale(0.99);
}
.control-pressed,
.mini-button-pressed,
.save-pressed {
  opacity: 0.86;
  transform: scale(0.97);
}

.section {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.96);
  animation: enter 260ms 105ms ease-out both;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
}
.section-count {
  color: #64748b;
  font-size: 24rpx;
}
.metric-switch,
.range-switch,
.unit-switch {
  display: flex;
  padding: 4rpx;
  border-radius: 14rpx;
  background: #f1f5f9;
}
.metric-switch button,
.range-switch button,
.unit-switch button {
  min-width: 88rpx;
  height: 60rpx;
  padding: 0 18rpx;
  color: #64748b;
  background: transparent;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 60rpx;
}
.metric-switch button.active,
.range-switch button.active,
.unit-switch button.active {
  color: #047857;
  background: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.08);
  font-weight: 700;
}
.metric-switch button.disabled {
  opacity: 0.48;
}
.range-switch {
  margin-top: 22rpx;
}
.range-switch button {
  flex: 1;
}
.chart-box {
  height: 380rpx;
  margin-top: 18rpx;
}
.chart-empty,
.chart-loading,
.empty-list {
  padding: 70rpx 20rpx;
  color: #64748b;
  font-size: 26rpx;
  text-align: center;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}
.record-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx 20rpx;
  align-items: center;
  padding: 22rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  animation: item-enter 220ms ease-out both;
}
.record-data {
  min-width: 0;
}
.record-weight {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
}
.record-date {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 22rpx;
}
.record-bmi {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  color: #64748b;
  font-size: 22rpx;
}
.record-bmi-value {
  color: #0f766e;
  font-size: 30rpx;
  font-weight: 700;
}
.height-action {
  height: 48rpx;
  margin-top: 4rpx;
  padding: 0 10rpx;
  color: #047857;
  background: transparent;
  font-size: 20rpx;
  line-height: 48rpx;
}
.record-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
}
.record-actions button {
  min-width: 92rpx;
  height: 60rpx;
  padding: 0 18rpx;
  color: #0f766e;
  background: #ccfbf1;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 60rpx;
  transition:
    transform 150ms ease-out,
    opacity 150ms ease-out;
}
.record-actions button.danger {
  color: #b91c1c;
  background: #fee2e2;
}
.load-more {
  height: 76rpx;
  margin-top: 22rpx;
  color: #047857;
  background: #d1fae5;
  border-radius: 14rpx;
  font-size: 26rpx;
  line-height: 76rpx;
}
.list-end {
  padding-top: 24rpx;
  color: #94a3b8;
  font-size: 22rpx;
  text-align: center;
}

.state-panel {
  margin-top: 120rpx;
  padding: 48rpx;
  border-radius: 16rpx;
  background: #ffffff;
  text-align: center;
}
.state-panel text {
  display: block;
  margin-bottom: 24rpx;
  color: #475569;
}
.retry-button {
  margin: 0 auto;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.52);
  animation: fade-in 180ms ease-out both;
}
.sheet {
  width: 100%;
  padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));
  border-radius: 16rpx 16rpx 0 0;
  background: #ffffff;
  box-sizing: border-box;
  animation: sheet-enter 240ms ease-out both;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 800;
}
.close-button {
  min-width: 88rpx;
  height: 64rpx;
  padding: 0 16rpx;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 64rpx;
}
.weight-input-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 14rpx;
  margin: 34rpx 0 22rpx;
}
.weight-input {
  width: 260rpx;
  height: 100rpx;
  border-bottom: 3rpx solid #10b981;
  color: #0f172a;
  font-size: 64rpx;
  font-weight: 800;
  text-align: center;
}
.weight-input-row > text {
  color: #047857;
  font-size: 30rpx;
  font-weight: 700;
}
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  border-bottom: 1px solid #f1f5f9;
}
.form-label {
  color: #334155;
  font-size: 28rpx;
  font-weight: 600;
}
.picker-value {
  min-width: 220rpx;
  padding: 26rpx 0;
  color: #0f172a;
  font-size: 28rpx;
  text-align: right;
}
.inline-input {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #64748b;
  font-size: 26rpx;
}
.inline-input input {
  width: 220rpx;
  height: 80rpx;
  color: #0f172a;
  font-size: 28rpx;
  text-align: right;
}
.unit-row {
  border-bottom: 0;
}
.sheet-save {
  height: 92rpx;
  margin-top: 30rpx;
  color: #ffffff;
  background: #059669;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 92rpx;
  transition:
    transform 160ms ease-out,
    opacity 160ms ease-out;
}
.sheet-save[disabled] {
  opacity: 0.48;
}

@keyframes enter {
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
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes sheet-enter {
  from {
    opacity: 0;
    transform: translateY(40rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes success-pop {
  0% {
    opacity: 0.88;
    transform: scale(0.98);
  }
  70% {
    opacity: 1;
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}
</style>

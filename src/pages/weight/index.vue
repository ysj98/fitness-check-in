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
type MetricAccent = 'green' | 'blue' | 'orange' | 'pink' | 'gold' | 'red'

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

const unitLabel = computed(() => (stats.value.weightUnit === 'jin' ? '斤' : 'kg'))
const currentWeight = computed(() => displayWeight(stats.value.currentWeightKg))
const targetWeight = computed(() => displayWeight(stats.value.targetWeightKg))
const targetDistance = computed(() => displayWeight(stats.value.distanceToTargetKg))
const canLoadMore = computed(() => records.value.length < total.value)
const bmiReady = computed(() => Boolean(stats.value.heightCm))
const hasTargetWeight = computed(() => {
  return (
    typeof stats.value.targetWeightKg === 'number' &&
    Number.isFinite(stats.value.targetWeightKg) &&
    stats.value.targetWeightKg > 0
  )
})
const targetWeightValue = computed(() => (hasTargetWeight.value ? targetWeight.value : '未设置'))
const targetDistanceValue = computed(() =>
  stats.value.distanceToTargetKg === null || !hasTargetWeight.value ? '待计算' : targetDistance.value,
)
const bmiValue = computed(() => stats.value.bmi ?? '待计算')
const bmiAccent = computed<MetricAccent>(() => {
  switch (stats.value.bmiCategory) {
    case 'underweight':
      return 'blue'
    case 'normal':
      return 'green'
    case 'overweight':
      return 'orange'
    case 'obese':
      return 'red'
    default:
      return 'orange'
  }
})
const bmiAccentColor = computed(() => {
  switch (bmiAccent.value) {
    case 'blue':
      return 'var(--app-blue)'
    case 'green':
      return 'var(--app-green)'
    case 'red':
      return 'var(--app-red)'
    default:
      return 'var(--app-orange)'
  }
})
const targetGuidance = computed(() => {
  if (stats.value.currentWeightKg === null) {
    return '记录体重后，可查看目标进度'
  }
  if (!hasTargetWeight.value) {
    return '设置目标体重后，可查看进度'
  }
  return `距离目标还差 ${targetDistance.value} ${unitLabel.value}`
})
const changeGuidance = computed(() => {
  if (stats.value.changeKg === null) {
    return records.value.length > 0 ? '再记录 1 次后显示变化' : '记录后显示变化'
  }
  return `较上次 ${formatChange()} ${unitLabel.value}`
})
const bmiGuidance = computed(() => {
  if (!bmiReady.value) {
    return '设置身高后计算 BMI'
  }
  if (stats.value.bmi === null) {
    return '记录体重后生成 BMI'
  }
  return `${stats.value.bmiLabel}，建议控制在 18.5 - 23.9`
})
const bmiPointerStyle = computed(() => {
  const bmi = stats.value.bmi ?? 18.5
  const min = 16
  const max = 32
  const percent = Math.max(0, Math.min(100, ((bmi - min) / (max - min)) * 100))
  return { left: `${percent}%`, background: bmiAccentColor.value }
})
const trendEmptyText = computed(() => {
  const remaining = Math.max(0, 3 - stats.value.trend.length)
  return `再记录 ${remaining} 次体重后，即可生成趋势图`
})
const weightProgress = computed(() => {
  if (stats.value.currentWeightKg === null || !hasTargetWeight.value || stats.value.previousWeightKg === null) {
    return 0
  }
  const startDistance = Math.abs(stats.value.previousWeightKg - stats.value.targetWeightKg)
  const currentDistance = Math.abs(stats.value.currentWeightKg - stats.value.targetWeightKg)
  if (startDistance === 0) {
    return currentDistance === 0 ? 100 : 0
  }
  return Math.max(0, Math.min(100, Math.round(((startDistance - currentDistance) / startDistance) * 100)))
})
const chartData = computed(() => ({
  categories: stats.value.trend.map((item) => item.date.slice(5)),
  series: [
    {
      name: trendMetric.value === 'weight' ? `体重(${unitLabel.value})` : 'BMI',
      data: stats.value.trend.map((item) =>
        trendMetric.value === 'weight' ? fromWeightKg(item.weightKg, stats.value.weightUnit) : (item.bmi ?? 0),
      ),
    },
  ],
}))
const chartOpts = computed(() => ({
  color: [themeStore.isDark ? '#4aa3ff' : '#1688ff'],
  padding: [12, 12, 4, 8],
  dataLabel: false,
  dataPointShape: true,
  legend: { show: false },
  xAxis: {
    disableGrid: true,
    fontColor: themeStore.isDark ? '#a8b8b0' : '#7a8a82',
    axisLineColor: themeStore.isDark ? '#20352d' : '#d8e8df',
  },
  yAxis: {
    gridType: 'dash',
    dashLength: 4,
    gridColor: themeStore.isDark ? '#20352d' : '#d8e8df',
    data: [
      {
        title: trendMetric.value === 'weight' ? unitLabel.value : 'BMI',
        tofix: 1,
        fontColor: themeStore.isDark ? '#a8b8b0' : '#7a8a82',
      },
    ],
  },
  extra: {
    line: {
      type: 'curve',
      width: 3,
      activeType: 'hollow',
    },
  },
}))

const metricOptions = [
  { label: '体重', value: 'weight' as const },
  { label: 'BMI', value: 'bmi' as const },
]
const rangeOptions = [
  { label: '7天', value: 7 as const },
  { label: '30天', value: 30 as const },
  { label: '90天', value: 90 as const },
]
const unitOptions = [
  { label: 'kg', value: 'kg' as const },
  { label: '斤', value: 'jin' as const },
]

onShow(() => {
  loadPage()
})

async function ensureLogin() {
  if (!tokenStore.hasLogin()) {
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
    const [list, nextStats] = await Promise.all([getWeights(1, pageSize), getWeightStats(selectedDays.value)])
    records.value = list.items
    total.value = list.total
    page.value = 1
    stats.value = nextStats
  } catch {
    loadFailed.value = true
  } finally {
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
  } finally {
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
  recordForm.weight =
    stats.value.currentWeightKg === null
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
    uni.showToast({
      title: `请输入有效体重（${stats.value.weightUnit === 'jin' ? '40-600 斤' : '20-300 kg'}）`,
      icon: 'none',
    })
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
    } else {
      await createWeight(payload)
    }
    recordModalVisible.value = false
    await refreshWeightData()
    successPulse.value = true
    triggerSuccessHaptic()
    uni.showToast({ title: editingRecord.value ? '记录已更新' : '体重已记录', icon: 'success' })
    setTimeout(() => {
      successPulse.value = false
    }, 360)
  } finally {
    savingRecord.value = false
  }
}

async function confirmDelete(record: WeightRecord) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除记录',
      content: `删除 ${formatDateTime(record.measuredAt)} 的体重记录？`,
      confirmColor: '#ff4d4f',
      success: (result) => resolve(result.confirm),
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
  const [list, nextStats] = await Promise.all([getWeights(1, pageSize), getWeightStats(selectedDays.value)])
  records.value = list.items
  total.value = list.total
  page.value = 1
  stats.value = nextStats
}

function openSettings() {
  settingsForm.heightCm = stats.value.heightCm === null ? '' : String(stats.value.heightCm)
  settingsForm.targetWeight =
    stats.value.targetWeightKg === null ? '' : String(fromWeightKg(stats.value.targetWeightKg, stats.value.weightUnit))
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
  } finally {
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
    <ios-page-header title="体重" subtitle="健康趋势" accent="blue" />

    <view v-if="loadFailed" class="state-panel">
      <app-icon name="weight" accent="blue" size="lg" />
      <text>加载失败</text>
      <app-button accent="blue" variant="soft" @click="loadPage"> 重新加载 </app-button>
    </view>

    <template v-else>
      <view class="hero-shell">
        <app-card accent="blue" elevated>
          <view class="hero-content" :class="{ pulse: successPulse }">
            <view class="hero-main">
              <text class="hero-label">当前体重</text>
              <view class="weight-value">
                <text class="weight-number numeric">{{ currentWeight }}</text>
                <text class="weight-unit">{{ unitLabel }}</text>
              </view>
              <text class="hero-change">{{ changeGuidance }}</text>
              <text class="hero-target">{{ targetGuidance }}</text>
            </view>
            <view v-if="hasTargetWeight && stats.currentWeightKg !== null" class="hero-ring">
              <progress-ring :percent="weightProgress" label="目标" accent="blue" />
            </view>
            <view v-else class="target-status" @click="openSettings">
              <text class="target-status-main">{{ hasTargetWeight ? '记录体重' : '未设目标' }}</text>
              <text class="target-status-sub">{{ hasTargetWeight ? '查看进度' : '点击设置' }}</text>
            </view>
            <button class="settings-button" aria-label="体重设置" hover-class="control-pressed" @click="openSettings">
              <text class="i-carbon-settings" />
            </button>
          </view>
        </app-card>
      </view>

      <view class="summary-grid">
        <metric-card
          class="bmi-metric"
          label="BMI"
          :value="bmiValue"
          :note="bmiGuidance"
          icon="target"
          :accent="bmiAccent"
          :muted-value="stats.bmi === null"
          note-emphasis
        >
          <view v-if="stats.bmi !== null" class="bmi-scale">
            <view class="bmi-track">
              <view class="bmi-pointer" :style="bmiPointerStyle" />
            </view>
            <view class="bmi-labels">
              <text>偏低</text>
              <text>正常</text>
              <text>超重</text>
              <text>肥胖</text>
            </view>
          </view>
        </metric-card>
        <metric-card
          label="目标体重"
          :value="targetWeightValue"
          :note="!hasTargetWeight ? '点击设置目标' : unitLabel"
          icon="weight"
          accent="pink"
          :muted-value="!hasTargetWeight"
          @click="!hasTargetWeight && openSettings()"
        />
        <metric-card
          label="距离目标"
          :value="targetDistanceValue"
          :note="stats.distanceToTargetKg === null || !hasTargetWeight ? '设置目标后计算' : unitLabel"
          icon="streak"
          accent="blue"
          :muted-value="stats.distanceToTargetKg === null || !hasTargetWeight"
          @click="(stats.distanceToTargetKg === null || !hasTargetWeight) && openSettings()"
        />
        <metric-card label="记录总数" :value="total" note="历史条目" icon="badge" accent="green" />
      </view>

      <view class="record-button-shell">
        <app-button icon="weight" accent="green" @click="openCreateRecord"> 记录体重 </app-button>
      </view>

      <text class="ios-section-title">数据趋势</text>
      <view class="section-shell">
        <app-card accent="blue">
          <view class="section-content trend-section">
            <view class="section-head">
              <text class="section-title">趋势</text>
              <view class="metric-control">
                <app-segmented-control
                  :model-value="trendMetric"
                  :options="metricOptions.map((item) => ({ ...item, disabled: item.value === 'bmi' && !bmiReady }))"
                  @change="selectMetric"
                />
              </view>
            </view>
            <app-segmented-control
              class="range-switch"
              :model-value="selectedDays"
              :options="rangeOptions"
              @change="selectDays"
            />
            <view v-if="loading && stats.trend.length === 0" class="chart-loading"> 加载中 </view>
            <view v-else-if="stats.trend.length < 3" class="chart-empty compact">
              {{ trendEmptyText }}
            </view>
            <view v-else-if="!recordModalVisible && !settingsModalVisible" class="chart-box">
              <qiun-data-charts type="line" :opts="chartOpts" :chart-data="chartData" :canvas2d="true" />
            </view>
            <view v-else class="chart-empty"> 图表已暂时隐藏 </view>
          </view>
        </app-card>
      </view>

      <text class="ios-section-title">历史记录</text>
      <view class="section-shell">
        <app-card accent="green" :show-accent="false">
          <view class="history-section">
            <view class="section-head history-head">
              <text class="section-title">全部记录</text>
              <text class="section-count">{{ total }} 条</text>
            </view>
            <view v-if="records.length === 0" class="empty-list">
              <app-icon name="weight" accent="blue" size="md" />
              <text>暂无体重记录</text>
            </view>
            <view v-else class="record-list">
              <view
                v-for="(record, index) in records"
                :key="record.id"
                class="record-item"
                :style="{ animationDelay: `${Math.min(index, 8) * 30}ms` }"
              >
                <app-icon name="weight" accent="blue" size="sm" />
                <view class="record-data">
                  <text class="record-weight numeric"
                    >{{ fromWeightKg(record.weightKg, stats.weightUnit).toFixed(1) }} {{ unitLabel }}</text
                  >
                  <text class="record-date">{{ formatDateTime(record.measuredAt) }}</text>
                </view>
                <view class="record-bmi">
                  <text>BMI</text>
                  <text class="record-bmi-value numeric">{{ record.bmi ?? '--' }}</text>
                </view>
                <view class="record-actions">
                  <button hover-class="mini-button-pressed" @click="openEditRecord(record)">
                    <text class="i-carbon-edit" />
                  </button>
                  <button class="danger" hover-class="mini-button-pressed" @click="confirmDelete(record)">
                    <text class="i-carbon-trash-can" />
                  </button>
                </view>
              </view>
            </view>
            <button v-if="canLoadMore" class="load-more" :disabled="loading" @click="loadMore">
              {{ loading ? '加载中' : '加载更多' }}
            </button>
            <view v-else-if="records.length > 0" class="list-end"> 已显示全部记录 </view>
          </view>
        </app-card>
      </view>
    </template>

    <app-sheet
      v-if="recordModalVisible"
      :title="editingRecord ? '编辑体重' : '记录体重'"
      :saving="savingRecord"
      @close="closeRecordModal"
      @save="saveRecord"
    >
      <view class="weight-input-row">
        <input v-model="recordForm.weight" class="weight-input" type="digit" :maxlength="6" focus placeholder="0.0" />
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
    </app-sheet>

    <app-sheet
      v-if="settingsModalVisible"
      title="体重设置"
      :saving="savingSettings"
      @close="closeSettingsModal"
      @save="saveSettings"
    >
      <view class="form-group settings-group">
        <view class="form-row input-form-row">
          <text class="form-label">身高</text>
          <view class="inline-input">
            <input v-model="settingsForm.heightCm" type="digit" :maxlength="5" placeholder="未设置" />
            <text>cm</text>
          </view>
        </view>
        <view class="form-row input-form-row">
          <text class="form-label">目标体重</text>
          <view class="inline-input">
            <input v-model="settingsForm.targetWeight" type="digit" :maxlength="6" placeholder="未设置" />
            <text>{{ settingsForm.weightUnit === 'jin' ? '斤' : 'kg' }}</text>
          </view>
        </view>
        <view class="form-row unit-row">
          <text class="form-label">显示单位</text>
          <app-segmented-control
            :model-value="settingsForm.weightUnit"
            :options="unitOptions"
            @change="selectSettingsUnit"
          />
        </view>
      </view>
    </app-sheet>
  </view>
</template>

<style scoped lang="scss">
.weight-page {
  padding: 0 0 calc(150rpx + env(safe-area-inset-bottom));
}

.hero-shell,
.summary-grid,
.record-button-shell,
.section-shell,
.state-panel {
  margin-right: var(--app-gutter);
  margin-left: var(--app-gutter);
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 246rpx;
  padding: 34rpx 86rpx 34rpx 32rpx;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) var(--app-ease-out) both;
}

.hero-content.pulse {
  animation: app-pop 320ms var(--app-ease-spring) both;
}

.hero-main {
  flex: 1;
  min-width: 0;
}

.hero-label,
.hero-change,
.hero-target {
  display: block;
  color: var(--app-label-secondary);
}

.hero-label {
  font-size: 24rpx;
  font-weight: 720;
}

.weight-value {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 8rpx;
}

.weight-number,
.weight-unit {
  color: var(--app-blue);
}

.weight-number {
  font-size: 78rpx;
  font-weight: 860;
  line-height: 1.05;
}

.weight-unit {
  font-size: 28rpx;
  font-weight: 720;
}

.hero-change {
  margin-top: 8rpx;
  font-size: 23rpx;
}

.hero-target {
  margin-top: 6rpx;
  font-size: 22rpx;
}

.hero-ring {
  flex: 0 0 auto;
  transform: scale(0.82);
  transform-origin: center right;
}

.target-status {
  display: flex;
  flex: 0 0 150rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150rpx;
  border: 1rpx solid var(--app-separator);
  border-radius: 50%;
  background: var(--app-blue-soft);
  box-sizing: border-box;
}

.target-status-main,
.target-status-sub {
  display: block;
}

.target-status-main {
  color: var(--app-blue);
  font-size: 25rpx;
  font-weight: 780;
}

.target-status-sub {
  margin-top: 4rpx;
  color: var(--app-label-secondary);
  font-size: 20rpx;
}

.settings-button {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  padding: 0;
  border-radius: 50%;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 27rpx;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out;
}

.control-pressed,
.mini-button-pressed {
  opacity: 0.78;
  transform: scale(0.94);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.summary-grid :deep(.metric-card) {
  min-height: 260rpx;
}

.summary-grid :deep(.metric-note) {
  line-height: 1.35;
}

.bmi-scale {
  width: 100%;
  margin-top: 14rpx;
}

.bmi-track {
  position: relative;
  height: 10rpx;
  border-radius: 999rpx;
  background: linear-gradient(
    90deg,
    var(--app-blue) 0 25%,
    var(--app-green) 25% 50%,
    var(--app-orange) 50% 75%,
    var(--app-red) 75% 100%
  );
}

.bmi-pointer {
  position: absolute;
  top: -6rpx;
  width: 6rpx;
  height: 22rpx;
  border-radius: 999rpx;
  transform: translateX(-50%);
}

.bmi-labels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 8rpx;
  color: var(--app-label-tertiary);
  font-size: 19rpx;
  text-align: center;
}

.record-button-shell {
  margin-top: 22rpx;
}

.section-content {
  padding: 28rpx;
  box-sizing: border-box;
  animation: app-enter var(--app-motion-normal) 90ms var(--app-ease-out) both;
}

.section-head,
.weight-input-row,
.form-row,
.inline-input,
.record-item,
.record-actions {
  display: flex;
  align-items: center;
}

.section-head {
  justify-content: space-between;
  gap: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 780;
}

.section-count {
  color: var(--app-label-secondary);
  font-size: 22rpx;
}

.metric-control {
  flex: 0 0 220rpx;
}

.range-switch {
  margin-top: 24rpx;
}

.chart-box {
  position: relative;
  z-index: 0;
  height: 350rpx;
  margin-top: 18rpx;
}

.chart-loading,
.chart-empty,
.empty-list,
.state-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-label-secondary);
  font-size: 24rpx;
}

.chart-loading,
.chart-empty,
.empty-list {
  min-height: 260rpx;
}

.chart-empty.compact {
  min-height: 180rpx;
}

.empty-list,
.state-panel {
  flex-direction: column;
  gap: 16rpx;
}

.state-panel {
  min-height: 420rpx;
  padding: 48rpx 28rpx;
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
}

.history-section {
  overflow: hidden;
}

.history-head {
  min-height: 90rpx;
  padding: 0 28rpx;
  border-bottom: 1rpx solid var(--app-separator);
}

.record-item {
  gap: 16rpx;
  margin-left: 24rpx;
  padding: 22rpx 24rpx 22rpx 0;
  border-bottom: 1rpx solid var(--app-separator);
  animation: app-enter 230ms var(--app-ease-out) both;
}

.record-item:last-child {
  border-bottom: 0;
}

.record-data {
  flex: 1;
  min-width: 0;
}

.record-weight,
.record-date {
  display: block;
}

.record-weight {
  color: var(--app-label-primary);
  font-size: 28rpx;
  font-weight: 720;
}

.record-date,
.record-bmi,
.list-end {
  color: var(--app-label-secondary);
}

.record-date {
  margin-top: 5rpx;
  font-size: 21rpx;
}

.record-bmi {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 3rpx;
  font-size: 19rpx;
}

.record-bmi-value {
  color: var(--app-orange);
  font-size: 27rpx;
  font-weight: 760;
}

.record-actions {
  flex: 0 0 auto;
  gap: 8rpx;
}

.record-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 58rpx;
  height: 54rpx;
  padding: 0 12rpx;
  border-radius: 16rpx;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 24rpx;
  line-height: 54rpx;
  transition:
    transform var(--app-motion-fast) var(--app-ease-out),
    opacity var(--app-motion-fast) ease-out;
}

.record-actions button.danger {
  color: var(--app-red);
  background: var(--app-pink-soft);
}

.load-more {
  min-height: 72rpx;
  margin: 18rpx 24rpx;
  border-radius: 18rpx;
  color: var(--app-blue);
  background: var(--app-blue-soft);
  font-size: 24rpx;
  line-height: 72rpx;
}

.list-end {
  padding: 26rpx;
  font-size: 22rpx;
  text-align: center;
}

.weight-input-row {
  align-items: baseline;
  justify-content: center;
  gap: 14rpx;
  margin: 30rpx 0 26rpx;
}

.weight-input {
  width: 260rpx;
  height: 104rpx;
  border-bottom: 3rpx solid var(--app-blue);
  color: var(--app-label-primary);
  font-size: 68rpx;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.weight-input-row > text {
  color: var(--app-blue);
  font-size: 28rpx;
  font-weight: 720;
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
  justify-content: space-between;
  gap: 24rpx;
  min-height: 102rpx;
  margin-left: 28rpx;
  padding-right: 28rpx;
  border-bottom: 1rpx solid var(--app-separator);
}

.form-row:last-child {
  border-bottom: 0;
}

.form-label {
  flex: 0 0 auto;
  color: var(--app-label-primary);
  font-size: 27rpx;
  font-weight: 620;
}

.picker-value,
.inline-input input {
  color: var(--app-label-primary);
  font-size: 27rpx;
  text-align: right;
}

.inline-input {
  justify-content: flex-end;
  gap: 10rpx;
  min-width: 240rpx;
  color: var(--app-label-secondary);
  font-size: 23rpx;
}

.inline-input input {
  width: 170rpx;
}

.unit-row {
  align-items: center;
}

@media screen and (max-width: 360px) {
  .hero-ring {
    display: none;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .metric-control {
    flex-basis: 190rpx;
  }
}
</style>

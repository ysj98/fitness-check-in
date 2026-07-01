import type { FastifyRequest } from 'fastify'
import type { AppCheckIn, AppDb, WxSession } from './types.js'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { z, ZodError } from 'zod'
import { addChinaDays, formatChinaDate, getChinaDayRange, getChinaMonthRange, getChinaWeekRange } from './date.js'
import { exchangeWeChatCode } from './wechat.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: number }
    user: { userId: number }
  }
}

interface CreateAppOptions {
  db: AppDb
  exchangeCode?: (code: string) => Promise<WxSession>
  uploadDir?: string
}

interface UploadedFile {
  filename: string
  mimeType: string
  data: Buffer
}

type AchievementCategory = 'checkin' | 'streak' | 'weight' | 'profile'
type AchievementBadge = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
type AchievementMetricKey = 'totalCheckinCount' | 'currentStreak' | 'weightRecordCount' | 'profileCompleted'
type AchievementIcon = 'checkin' | 'streak' | 'weight' | 'profile'
type GoalMode = 'count' | 'duration' | 'both'
type GoalPeriod = 'week' | 'month'

const goalRules: Record<
  GoalPeriod,
  { countMin: number; countMax: number; durationMin: number; durationMax: number; defaultCount: number; defaultDuration: number }
> = {
  week: {
    countMin: 1,
    countMax: 14,
    durationMin: 30,
    durationMax: 1500,
    defaultCount: 4,
    defaultDuration: 180,
  },
  month: {
    countMin: 1,
    countMax: 60,
    durationMin: 100,
    durationMax: 6000,
    defaultCount: 20,
    defaultDuration: 800,
  },
}

interface AchievementLevel {
  threshold: number
  title: string
  description: string
  badge: AchievementBadge
}

interface AchievementSeries {
  key: string
  category: AchievementCategory
  metricKey: AchievementMetricKey
  icon: AchievementIcon
  seriesName: string
  levels: AchievementLevel[]
}

const achievementSeriesList: AchievementSeries[] = [
  {
    key: 'total-checkin',
    category: 'checkin',
    metricKey: 'totalCheckinCount',
    icon: 'checkin',
    seriesName: '累计打卡',
    levels: [
      {
        threshold: 1,
        title: '初次点亮',
        description: '完成第一次运动打卡',
        badge: 'BRONZE',
      },
      {
        threshold: 10,
        title: '稳定起步',
        description: '累计完成 10 次打卡',
        badge: 'SILVER',
      },
      {
        threshold: 30,
        title: '习惯养成',
        description: '累计完成 30 次打卡',
        badge: 'GOLD',
      },
      {
        threshold: 60,
        title: '坚持进阶',
        description: '累计完成 60 次打卡',
        badge: 'PLATINUM',
      },
      {
        threshold: 100,
        title: '百次坚持',
        description: '累计完成 100 次打卡',
        badge: 'PLATINUM',
      },
      {
        threshold: 200,
        title: '运动达人',
        description: '累计完成 200 次打卡',
        badge: 'DIAMOND',
      },
      {
        threshold: 365,
        title: '年度习惯',
        description: '累计完成 365 次打卡',
        badge: 'DIAMOND',
      },
    ],
  },
  {
    key: 'current-streak',
    category: 'streak',
    metricKey: 'currentStreak',
    icon: 'streak',
    seriesName: '连续打卡',
    levels: [
      {
        threshold: 3,
        title: '连续 3 天',
        description: '连续 3 天保持运动打卡',
        badge: 'BRONZE',
      },
      {
        threshold: 7,
        title: '一周不断',
        description: '连续 7 天保持运动打卡',
        badge: 'SILVER',
      },
      {
        threshold: 14,
        title: '双周节奏',
        description: '连续 14 天保持运动打卡',
        badge: 'GOLD',
      },
      {
        threshold: 30,
        title: '月度长燃',
        description: '连续 30 天保持运动打卡',
        badge: 'PLATINUM',
      },
      {
        threshold: 60,
        title: '长期坚持',
        description: '连续 60 天保持运动打卡',
        badge: 'DIAMOND',
      },
      {
        threshold: 100,
        title: '百日不坠',
        description: '连续 100 天保持运动打卡',
        badge: 'DIAMOND',
      },
    ],
  },
  {
    key: 'weight-record',
    category: 'weight',
    metricKey: 'weightRecordCount',
    icon: 'weight',
    seriesName: '体重记录',
    levels: [
      {
        threshold: 1,
        title: '体重起点',
        description: '记录第一次体重',
        badge: 'BRONZE',
      },
      {
        threshold: 7,
        title: '趋势观察',
        description: '累计记录 7 次体重',
        badge: 'SILVER',
      },
      {
        threshold: 30,
        title: '身体档案',
        description: '累计记录 30 次体重',
        badge: 'GOLD',
      },
      {
        threshold: 60,
        title: '稳定追踪',
        description: '累计记录 60 次体重',
        badge: 'PLATINUM',
      },
      {
        threshold: 100,
        title: '长期记录',
        description: '累计记录 100 次体重',
        badge: 'DIAMOND',
      },
    ],
  },
  {
    key: 'profile-complete',
    category: 'profile',
    metricKey: 'profileCompleted',
    icon: 'profile',
    seriesName: '个人资料',
    levels: [
      {
        threshold: 1,
        title: '资料完整',
        description: '完善头像、昵称、性别、生日和身高',
        badge: 'GOLD',
      },
    ],
  },
]

const loginSchema = z.object({
  code: z.string().min(1),
})

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const sportTypeSchema = z.enum(['散步', '跑步', '健身', '骑行', '游泳', '瑜伽', '其他'])
const durationMinutesSchema = z.coerce.number().int().min(1).max(300)

const createCheckInSchema = z.object({
  sportType: sportTypeSchema,
  durationMinutes: durationMinutesSchema,
})

const backfillReasonSchema = z.enum(['忘记打卡', '已运动未记录', '其他'])

const backfillCheckInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: backfillReasonSchema.default('忘记打卡'),
  sportType: sportTypeSchema,
  durationMinutes: durationMinutesSchema,
})

const weightValueSchema = z.coerce.number().min(20).max(300)
const heightValueSchema = z.coerce.number().min(100).max(250)

const weightRecordSchema = z.object({
  weightKg: weightValueSchema,
  measuredAt: z.string().datetime(),
})

const weightListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const weightStatsQuerySchema = z.object({
  days: z.coerce.number().refine((value) => [7, 30, 90].includes(value), 'days must be 7, 30 or 90'),
})

const weightSettingsSchema = z.object({
  heightCm: heightValueSchema.optional().nullable(),
  targetWeightKg: weightValueSchema.optional().nullable(),
  weightUnit: z.enum(['kg', 'jin']).optional(),
})

const emptyStringToNull = (value: unknown) => (value === '' ? null : value)

const profileSchema = z
  .object({
    nickname: z.string().trim().min(1).max(30),
    avatarUrl: z.preprocess(emptyStringToNull, z.string().trim().max(500).optional().nullable()),
    gender: z.preprocess(emptyStringToNull, z.enum(['male', 'female', 'other']).optional().nullable()),
    birthday: z.preprocess(
      emptyStringToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    ),
    goalPeriod: z.enum(['week', 'month']).optional(),
    goalMode: z.enum(['count', 'duration', 'both']).optional(),
    goalCount: z.coerce.number().int().optional(),
    goalDuration: z.coerce.number().int().optional(),
    heightCm: heightValueSchema.optional().nullable(),
  })
  .superRefine((value, context) => {
    const period = value.goalPeriod || 'week'
    const rule = goalRules[period]
    if (
      value.goalCount !== undefined &&
      (value.goalCount < rule.countMin || value.goalCount > rule.countMax)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['goalCount'],
        message: `goalCount must be between ${rule.countMin} and ${rule.countMax}`,
      })
    }
    if (
      value.goalDuration !== undefined &&
      (value.goalDuration < rule.durationMin || value.goalDuration > rule.durationMax)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['goalDuration'],
        message: `goalDuration must be between ${rule.durationMin} and ${rule.durationMax}`,
      })
    }
  })

function ok<T>(data: T, message = 'ok') {
  return { code: 0, data, message, msg: message }
}

function fail(message: string, code = 400) {
  return { code, data: null, message, msg: message }
}

function toNumber(value: number | string | null | undefined) {
  return value === null || value === undefined ? null : Number(value)
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isGoalMode(value: unknown): value is GoalMode {
  return value === 'count' || value === 'duration' || value === 'both'
}

function isGoalPeriod(value: unknown): value is GoalPeriod {
  return value === 'week' || value === 'month'
}

function getGoalSettings(user: NonNullable<Awaited<ReturnType<AppDb['user']['findUnique']>>>) {
  const period = isGoalPeriod(user.goalPeriod) ? user.goalPeriod : 'week'
  const rule = goalRules[period]
  const mode = isGoalMode(user.goalMode) ? user.goalMode : 'count'
  const countSource = Number(user.goalCount || rule.defaultCount)
  const durationSource = Number(user.goalDuration || rule.defaultDuration)

  return {
    period,
    mode,
    countGoal: clampNumber(
      Number.isFinite(countSource) ? Math.trunc(countSource) : rule.defaultCount,
      rule.countMin,
      rule.countMax,
    ),
    durationGoal: clampNumber(
      Number.isFinite(durationSource) ? Math.trunc(durationSource) : rule.defaultDuration,
      rule.durationMin,
      rule.durationMax,
    ),
  }
}

function getGoalDateRange(period: GoalPeriod) {
  if (period === 'week') {
    return getChinaWeekRange()
  }

  return getChinaMonthRange(formatChinaDate(new Date()).slice(0, 7))
}

function buildGoalMetric(current: number, target: number) {
  const safeCurrent = Math.max(0, current)
  const safeTarget = Math.max(1, target)
  return {
    current: safeCurrent,
    target: safeTarget,
    percent: Math.min(100, Math.round((Math.min(safeCurrent, safeTarget) / safeTarget) * 100)),
    completed: safeCurrent >= safeTarget,
  }
}

function buildGoalProgress(params: {
  user: NonNullable<Awaited<ReturnType<AppDb['user']['findUnique']>>>
  goalCount: number
  goalDurationMinutes: number
}) {
  const settings = getGoalSettings(params.user)
  const count = buildGoalMetric(params.goalCount, settings.countGoal)
  const duration = buildGoalMetric(params.goalDurationMinutes, settings.durationGoal)
  const completed =
    settings.mode === 'count'
      ? count.completed
      : settings.mode === 'duration'
        ? duration.completed
        : count.completed && duration.completed
  const percent =
    settings.mode === 'count'
      ? count.percent
      : settings.mode === 'duration'
        ? duration.percent
        : Math.min(count.percent, duration.percent)

  return {
    period: settings.period,
    mode: settings.mode,
    countGoal: settings.countGoal,
    durationGoal: settings.durationGoal,
    count,
    duration,
    completed,
    percent,
  }
}

function calculateRawBmi(weightKg: number, heightCm: number | null) {
  if (!heightCm) {
    return null
  }
  return weightKg / (heightCm / 100) ** 2
}

function calculateBmi(weightKg: number, heightCm: number | null) {
  const bmi = calculateRawBmi(weightKg, heightCm)
  return bmi === null ? null : round(bmi, 1)
}

function getChinaDayRangeByDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const start = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000)

  if (formatChinaDate(start) !== dateKey) {
    return null
  }

  return {
    start,
    end: addChinaDays(start, 1),
  }
}

function getChinaMonthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7)
}

function serializeCheckInRecord(record: AppCheckIn) {
  return {
    id: record.id,
    checkedAt: record.checkedAt.toISOString(),
    isBackfill: record.isBackfill,
    backfillReason: record.backfillReason ?? '',
    sportType: record.sportType,
    durationMinutes: record.durationMinutes,
  }
}

function getBmiCategory(bmi: number | null) {
  if (bmi === null) {
    return null
  }
  if (bmi < 18.5) {
    return 'underweight'
  }
  if (bmi < 24) {
    return 'normal'
  }
  if (bmi < 28) {
    return 'overweight'
  }
  return 'obese'
}

function getBmiLabel(category: ReturnType<typeof getBmiCategory>) {
  const labels = {
    underweight: '偏低',
    normal: '正常',
    overweight: '超重',
    obese: '肥胖',
  }
  return category ? labels[category] : ''
}

function parseMeasuredAt(value: string) {
  const measuredAt = new Date(value)
  if (measuredAt.getTime() > Date.now() + 60 * 1000) {
    const error = new Error('测量时间不能晚于当前时间') as Error & { statusCode: number }
    error.statusCode = 400
    throw error
  }
  return measuredAt
}

function serializeWeightRecord(
  record: Awaited<ReturnType<AppDb['weightRecord']['findFirst']>>,
  heightCm: number | null,
) {
  if (!record) {
    return null
  }
  const weightKg = Number(record.weightKg)
  return {
    id: record.id,
    weightKg,
    bmi: calculateBmi(weightKg, heightCm),
    measuredAt: record.measuredAt.toISOString(),
  }
}

function buildBadges(params: { currentStreak: number; totalCount: number; goalCompleted: boolean }) {
  const { currentStreak, totalCount, goalCompleted } = params

  return [
    {
      key: 'first_checkin',
      name: '初次打卡',
      description: '完成第 1 次打卡',
      unlocked: totalCount >= 1,
    },
    {
      key: 'streak_3',
      name: '连续 3 天',
      description: '连续打卡 3 天',
      unlocked: currentStreak >= 3,
    },
    {
      key: 'streak_7',
      name: '连续 7 天',
      description: '连续打卡 7 天',
      unlocked: currentStreak >= 7,
    },
    {
      key: 'total_10',
      name: '累计 10 次',
      description: '累计打卡 10 次',
      unlocked: totalCount >= 10,
    },
    {
      key: 'total_30',
      name: '累计 30 次',
      description: '累计打卡 30 次',
      unlocked: totalCount >= 30,
    },
    {
      key: 'period_goal',
      name: '目标达成',
      description: '完成当前周期目标',
      unlocked: goalCompleted,
    },
  ]
}

function calculateCurrentStreak(records: AppCheckIn[]) {
  const checkedDateSet = new Set(records.map((record) => formatChinaDate(record.checkedAt)))
  let currentStreak = 0
  let cursor = getChinaDayRange().start

  while (checkedDateSet.has(formatChinaDate(cursor))) {
    currentStreak += 1
    cursor = addChinaDays(cursor, -1)
  }

  return currentStreak
}

function clampProgress(current: number, target: number) {
  const displayCurrent = Math.min(Math.max(current, 0), target)
  return {
    current,
    displayCurrent,
    target,
    percent: target <= 0 ? 100 : Math.min(100, Math.round((displayCurrent / target) * 100)),
  }
}

function buildAchievementSeriesProgress(series: AchievementSeries, metricValue: number) {
  const levels = series.levels.map((level) => {
    const progress = clampProgress(metricValue, level.threshold)
    return {
      key: `${series.key}-${level.threshold}`,
      ...level,
      completed: metricValue >= level.threshold,
      isCurrent: false,
      progress,
    }
  })
  const currentLevelIndex = levels.findIndex((level) => !level.completed)
  const allCompleted = currentLevelIndex === -1
  const activeLevelIndex = allCompleted ? Math.max(levels.length - 1, 0) : currentLevelIndex
  const nextLevels = levels.map((level, index) => ({
    ...level,
    isCurrent: index === activeLevelIndex,
  }))
  const completedLevelCount = nextLevels.filter((level) => level.completed).length

  return {
    key: series.key,
    category: series.category,
    metricKey: series.metricKey,
    icon: series.icon,
    seriesName: series.seriesName,
    metricValue,
    completedLevelCount,
    totalLevelCount: nextLevels.length,
    allCompleted,
    currentLevel: nextLevels[activeLevelIndex],
    levels: nextLevels,
  }
}

function buildAchievements(params: {
  user: NonNullable<Awaited<ReturnType<AppDb['user']['findUnique']>>>
  checkIns: AppCheckIn[]
  weightCount: number
}) {
  const { user, checkIns, weightCount } = params
  const totalCount = checkIns.length
  const currentStreak = calculateCurrentStreak(checkIns)
  const profileFields = [user.nickname, user.avatarUrl, user.gender, user.birthday, toNumber(user.heightCm)]
  const metrics: Record<AchievementMetricKey, number> = {
    totalCheckinCount: totalCount,
    currentStreak,
    weightRecordCount: weightCount,
    profileCompleted: profileFields.every(Boolean) ? 1 : 0,
  }

  return achievementSeriesList.map((series) => buildAchievementSeriesProgress(series, metrics[series.metricKey]))
}

function serializeUser(user: Awaited<ReturnType<AppDb['user']['findUnique']>>) {
  if (!user) {
    return null
  }

  const goal = getGoalSettings(user)

  return {
    userId: user.id,
    username: user.openid,
    nickname: user.nickname,
    avatar: user.avatarUrl || '',
    avatarUrl: user.avatarUrl || '',
    gender: user.gender || '',
    birthday: user.birthday || '',
    goalPeriod: goal.period,
    goalMode: goal.mode,
    goalCount: goal.countGoal,
    goalDuration: goal.durationGoal,
    heightCm: toNumber(user.heightCm),
    targetWeightKg: toNumber(user.targetWeightKg),
    weightUnit: user.weightUnit || 'kg',
  }
}

function splitBuffer(source: Buffer, delimiter: Buffer) {
  const parts: Buffer[] = []
  let start = 0
  let index = source.indexOf(delimiter, start)

  while (index !== -1) {
    parts.push(source.subarray(start, index))
    start = index + delimiter.length
    index = source.indexOf(delimiter, start)
  }

  parts.push(source.subarray(start))
  return parts
}

function trimMultipartPart(part: Buffer) {
  let start = 0
  let end = part.length

  if (part.subarray(0, 2).toString() === '\r\n') {
    start = 2
  }
  if (part.subarray(end - 2).toString() === '\r\n') {
    end -= 2
  }
  if (part.subarray(start, start + 2).toString() === '--') {
    return Buffer.alloc(0)
  }

  return part.subarray(start, end)
}

function parseAvatarUpload(body: Buffer, contentType = ''): UploadedFile | null {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean)
  if (!boundary) {
    return null
  }

  const parts = splitBuffer(body, Buffer.from(`--${boundary}`))
  for (const rawPart of parts) {
    const part = trimMultipartPart(rawPart)
    if (!part.length) {
      continue
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) {
      continue
    }

    const headers = part.subarray(0, headerEnd).toString('utf8')
    if (!/name="avatar"/.test(headers)) {
      continue
    }

    const filename = /filename="([^"]+)"/.exec(headers)?.[1] || 'avatar'
    const mimeType = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() || 'application/octet-stream'
    let data = part.subarray(headerEnd + 4)
    if (data.subarray(data.length - 2).toString() === '\r\n') {
      data = data.subarray(0, data.length - 2)
    }

    return { filename, mimeType, data }
  }

  return null
}

function getAvatarExt(file: UploadedFile) {
  const mimeExtMap: Record<string, string> = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const fromMime = mimeExtMap[file.mimeType.toLowerCase()]
  if (fromMime) {
    return fromMime
  }

  const ext = path.extname(file.filename).replace('.', '').toLowerCase()
  return ['gif', 'jpeg', 'jpg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
}

function getMimeByFilename(filename: string) {
  const ext = path.extname(filename).replace('.', '').toLowerCase()
  const mimeMap: Record<string, string> = {
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }

  return mimeMap[ext] || 'application/octet-stream'
}

function getPublicUrl(request: FastifyRequest, urlPath: string) {
  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || 'http'
  const host = request.headers.host || `localhost:${process.env.PORT || 3000}`
  return `${protocol}://${host}${urlPath}`
}

async function requireAuth(request: FastifyRequest) {
  await request.jwtVerify()
}

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDb
  }
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  })
  const uploadDir = options.uploadDir || path.resolve(process.cwd(), 'uploads')
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }

  app.addContentTypeParser(/^multipart\/form-data/i, { parseAs: 'buffer' }, (request, body, done) => {
    done(null, parseAvatarUpload(body as Buffer, request.headers['content-type']))
  })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, body === '' ? {} : JSON.parse(body as string))
    } catch (error) {
      done(error as Error)
    }
  })

  app.decorate('db', options.db)

  await app.register(cors, {
    origin: true,
  })
  await app.register(jwt, {
    secret: jwtSecret || 'development-only-secret',
  })

  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      error instanceof ZodError ? 400 : error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    reply.code(statusCode).send(fail(error.message || 'Server error', statusCode))
  })

  app.get('/health', async () => ok({ status: 'ok' }))

  app.get('/uploads/avatars/:file', async (request, reply) => {
    const params = z.object({ file: z.string().regex(/^[\w.-]+$/) }).parse(request.params)
    reply.type(getMimeByFilename(params.file))
    return reply.send(createReadStream(path.join(uploadDir, 'avatars', params.file)))
  })

  app.post('/api/auth/wx-login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const wxSession = await (options.exchangeCode || exchangeWeChatCode)(body.code)
    const user = await app.db.user.upsert({
      where: { openid: wxSession.openid },
      update: {},
      create: {
        openid: wxSession.openid,
        goalPeriod: 'week',
        goalMode: 'count',
        goalCount: goalRules.week.defaultCount,
        goalDuration: goalRules.week.defaultDuration,
        nickname: '运动达人',
      },
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '30d' })
    reply.send(
      ok({
        token,
        expiresIn: 30 * 24 * 60 * 60,
        user: serializeUser(user),
      }),
    )
  })

  app.get('/api/user/info', async (request) => {
    await request.jwtVerify()
    const user = await app.db.user.findUnique({ where: { id: request.user.userId } })
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }

    return ok(serializeUser(user))
  })

  app.patch('/api/user/profile', async (request) => {
    await requireAuth(request)
    const body = profileSchema.parse(request.body)
    const user = await app.db.user.update({
      where: { id: request.user.userId },
      data: {
        nickname: body.nickname,
        avatarUrl: body.avatarUrl || null,
        gender: body.gender || null,
        birthday: body.birthday || null,
        ...(body.goalPeriod ? { goalPeriod: body.goalPeriod } : {}),
        ...(body.goalMode ? { goalMode: body.goalMode } : {}),
        ...(body.goalCount ? { goalCount: body.goalCount } : {}),
        ...(body.goalDuration ? { goalDuration: body.goalDuration } : {}),
        ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
      },
    })

    return ok(serializeUser(user), '保存成功')
  })

  app.patch('/api/user/weight-settings', async (request) => {
    await requireAuth(request)
    const body = weightSettingsSchema.parse(request.body)
    const user = await app.db.user.update({
      where: { id: request.user.userId },
      data: {
        ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
        ...(body.targetWeightKg !== undefined ? { targetWeightKg: body.targetWeightKg } : {}),
        ...(body.weightUnit ? { weightUnit: body.weightUnit } : {}),
      },
    })

    return ok(serializeUser(user), '设置已保存')
  })

  app.post('/api/user/avatar', async (request, reply) => {
    await requireAuth(request)
    const file = request.body as UploadedFile | null
    if (!file || !file.data.length) {
      return reply.code(400).send(fail('头像文件不能为空', 400))
    }
    if (!file.mimeType.startsWith('image/')) {
      return reply.code(400).send(fail('只支持图片文件', 400))
    }

    const avatarDir = path.join(uploadDir, 'avatars')
    await mkdir(avatarDir, { recursive: true })
    const filename = `${request.user.userId}-${Date.now()}-${randomUUID()}.${getAvatarExt(file)}`
    await writeFile(path.join(avatarDir, filename), file.data)

    return ok({
      avatarUrl: getPublicUrl(request, `/uploads/avatars/${filename}`),
    })
  })

  app.addHook('preHandler', async (request) => {
    if (
      request.routeOptions.url?.startsWith('/api/checkins') ||
      request.routeOptions.url?.startsWith('/api/weights') ||
      request.routeOptions.url?.startsWith('/api/achievements')
    ) {
      await requireAuth(request)
    }
  })

  app.get('/api/achievements', async (request) => {
    const [user, checkIns, weightCount] = await Promise.all([
      app.db.user.findUnique({ where: { id: request.user.userId } }),
      app.db.checkIn.findMany({
        where: { userId: request.user.userId },
        orderBy: { checkedAt: 'desc' },
      }),
      app.db.weightRecord.count({ where: { userId: request.user.userId } }),
    ])
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }

    return ok(buildAchievements({ user, checkIns, weightCount }))
  })

  app.get('/api/weights', async (request) => {
    const query = weightListQuerySchema.parse(request.query)
    const user = await app.db.user.findUnique({ where: { id: request.user.userId } })
    const heightCm = toNumber(user?.heightCm)
    const where = { userId: request.user.userId }
    const [total, records] = await Promise.all([
      app.db.weightRecord.count({ where }),
      app.db.weightRecord.findMany({
        where,
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    return ok({
      items: records.map((record) => serializeWeightRecord(record, heightCm)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get('/api/weights/stats', async (request) => {
    const query = weightStatsQuerySchema.parse(request.query)
    const user = await app.db.user.findUnique({ where: { id: request.user.userId } })
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }

    const heightCm = toNumber(user.heightCm)
    const dayRange = getChinaDayRange()
    const start = addChinaDays(dayRange.start, -(query.days - 1))
    const [latestRecords, periodRecords] = await Promise.all([
      app.db.weightRecord.findMany({
        where: { userId: request.user.userId },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
      app.db.weightRecord.findMany({
        where: {
          userId: request.user.userId,
          measuredAt: { gte: start, lt: dayRange.end },
        },
        orderBy: [{ measuredAt: 'asc' }, { id: 'asc' }],
      }),
    ])

    const currentWeightKg = latestRecords[0] ? Number(latestRecords[0].weightKg) : null
    const previousWeightKg = latestRecords[1] ? Number(latestRecords[1].weightKg) : null
    const rawBmi = currentWeightKg === null ? null : calculateRawBmi(currentWeightKg, heightCm)
    const bmi = rawBmi === null ? null : round(rawBmi, 1)
    const bmiCategory = getBmiCategory(rawBmi)
    const dailyLatest = new Map<string, (typeof periodRecords)[number]>()
    for (const record of periodRecords) {
      dailyLatest.set(formatChinaDate(record.measuredAt), record)
    }
    const trend = Array.from(dailyLatest.entries()).map(([date, record]) => {
      const weightKg = Number(record.weightKg)
      return {
        date,
        weightKg,
        bmi: calculateBmi(weightKg, heightCm),
      }
    })
    const targetWeightKg = toNumber(user.targetWeightKg)

    return ok({
      days: query.days,
      currentWeightKg,
      previousWeightKg,
      changeKg:
        currentWeightKg !== null && previousWeightKg !== null ? round(currentWeightKg - previousWeightKg) : null,
      targetWeightKg,
      distanceToTargetKg:
        currentWeightKg !== null && targetWeightKg !== null ? round(Math.abs(currentWeightKg - targetWeightKg)) : null,
      heightCm,
      weightUnit: user.weightUnit || 'kg',
      bmi,
      bmiCategory,
      bmiLabel: getBmiLabel(bmiCategory),
      trend,
    })
  })

  app.post('/api/weights', async (request) => {
    const body = weightRecordSchema.parse(request.body)
    const record = await app.db.weightRecord.create({
      data: {
        userId: request.user.userId,
        weightKg: body.weightKg,
        measuredAt: parseMeasuredAt(body.measuredAt),
      },
    })
    const user = await app.db.user.findUnique({ where: { id: request.user.userId } })

    return ok(serializeWeightRecord(record, toNumber(user?.heightCm)), '体重已记录')
  })

  app.patch('/api/weights/:id', async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params)
    const body = weightRecordSchema.parse(request.body)
    const existing = await app.db.weightRecord.findFirst({
      where: { id: params.id, userId: request.user.userId },
    })
    if (!existing) {
      return reply.code(404).send(fail('体重记录不存在', 404))
    }
    const record = await app.db.weightRecord.update({
      where: { id: params.id },
      data: {
        weightKg: body.weightKg,
        measuredAt: parseMeasuredAt(body.measuredAt),
      },
    })
    const user = await app.db.user.findUnique({ where: { id: request.user.userId } })

    return ok(serializeWeightRecord(record, toNumber(user?.heightCm)), '记录已更新')
  })

  app.delete('/api/weights/:id', async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params)
    const record = await app.db.weightRecord.findFirst({
      where: { id: params.id, userId: request.user.userId },
    })
    if (!record) {
      return reply.code(404).send(fail('体重记录不存在', 404))
    }

    await app.db.weightRecord.delete({ where: { id: params.id } })
    return ok({ id: params.id }, '记录已删除')
  })

  app.get('/api/checkins/today', async (request) => {
    const { start, end } = getChinaDayRange()
    const where = {
      userId: request.user.userId,
      checkedAt: { gte: start, lt: end },
    }
    const [count, records] = await Promise.all([
      app.db.checkIn.count({ where }),
      app.db.checkIn.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
      }),
    ])

    return ok({
      count,
      records: records.map((record) => serializeCheckInRecord(record)),
    })
  })

  app.post('/api/checkins', async (request) => {
    const body = createCheckInSchema.parse(request.body)
    const record = await app.db.checkIn.create({
      data: {
        userId: request.user.userId,
        checkedAt: new Date(),
        isBackfill: false,
        backfillReason: null,
        sportType: body.sportType,
        durationMinutes: body.durationMinutes,
      },
    })

    return ok(serializeCheckInRecord(record), '打卡成功')
  })

  app.post('/api/checkins/backfill', async (request, reply) => {
    const body = backfillCheckInSchema.parse(request.body)
    const targetRange = getChinaDayRangeByDateKey(body.date)

    if (!targetRange) {
      return reply.code(400).send(fail('补签日期格式不正确', 400))
    }

    const todayRange = getChinaDayRange()
    if (targetRange.start >= todayRange.start) {
      return reply
        .code(400)
        .send(fail(body.date === formatChinaDate(todayRange.start) ? '今天请使用正常打卡' : '不能补签未来日期', 400))
    }

    const earliestAllowed = addChinaDays(todayRange.start, -30)
    if (targetRange.start < earliestAllowed) {
      return reply.code(400).send(fail('只能补签最近 30 天内的未打卡日期', 400))
    }

    const existing = await app.db.checkIn.findFirst({
      where: {
        userId: request.user.userId,
        checkedAt: { gte: targetRange.start, lt: targetRange.end },
      },
    })
    if (existing) {
      return reply.code(409).send(fail('该日期已有打卡记录，不能补签', 409))
    }

    const monthRange = getChinaMonthRange(getChinaMonthKeyFromDateKey(body.date))
    const backfillUsed = await app.db.checkIn.count({
      where: {
        userId: request.user.userId,
        isBackfill: true,
        checkedAt: { gte: monthRange.start, lt: monthRange.end },
      },
    })
    if (backfillUsed >= 3) {
      return reply.code(400).send(fail('本月补签次数已用完', 400))
    }

    const record = await app.db.checkIn.create({
      data: {
        userId: request.user.userId,
        checkedAt: new Date(targetRange.start.getTime() + 12 * 60 * 60 * 1000),
        isBackfill: true,
        backfillReason: body.reason,
        sportType: body.sportType,
        durationMinutes: body.durationMinutes,
      },
    })

    return ok(serializeCheckInRecord(record), '补签成功')
  })

  app.get('/api/checkins/recent', async (request) => {
    const query = recentQuerySchema.parse(request.query)
    const records = await app.db.checkIn.findMany({
      where: { userId: request.user.userId },
      orderBy: { checkedAt: 'desc' },
      take: query.limit,
    })

    return ok(records.map((record) => serializeCheckInRecord(record)))
  })

  app.get('/api/checkins/month', async (request) => {
    const query = monthQuerySchema.parse(request.query)
    const { start, end } = getChinaMonthRange(query.month)
    const records = await app.db.checkIn.findMany({
      where: {
        userId: request.user.userId,
        checkedAt: { gte: start, lt: end },
      },
      orderBy: { checkedAt: 'asc' },
    })

    const days = records.reduce<Record<string, number>>((result, record) => {
      const key = formatChinaDate(record.checkedAt)
      result[key] = (result[key] || 0) + 1
      return result
    }, {})
    const backfillDays = records.reduce<Record<string, number>>((result, record) => {
      if (!record.isBackfill) {
        return result
      }
      const key = formatChinaDate(record.checkedAt)
      result[key] = (result[key] || 0) + 1
      return result
    }, {})
    const backfillUsed = records.filter((record) => record.isBackfill).length

    return ok({ month: query.month, days, backfillDays, backfillUsed, backfillLimit: 3 })
  })

  app.get('/api/checkins/stats', async (request) => {
    const todayRange = getChinaDayRange()
    const [allRecords, user] = await Promise.all([
      app.db.checkIn.findMany({
        where: { userId: request.user.userId },
        orderBy: { checkedAt: 'desc' },
      }),
      app.db.user.findUnique({ where: { id: request.user.userId } }),
    ])
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }
    const goalSettings = getGoalSettings(user)
    const goalRange = getGoalDateRange(goalSettings.period)
    const currentStreak = calculateCurrentStreak(allRecords)
    const totalCount = allRecords.length
    const todayRecords = allRecords.filter(
      (record) => record.checkedAt >= todayRange.start && record.checkedAt < todayRange.end,
    )
    const goalRecords = allRecords.filter(
      (record) => record.checkedAt >= goalRange.start && record.checkedAt < goalRange.end,
    )
    const todayCount = todayRecords.length
    const todayDurationMinutes = todayRecords.reduce((total, record) => total + record.durationMinutes, 0)
    const goalCount = goalRecords.length
    const goalDurationMinutes = goalRecords.reduce((total, record) => total + record.durationMinutes, 0)
    const goalProgress = buildGoalProgress({ user, goalCount, goalDurationMinutes })

    return ok({
      currentStreak,
      totalCount,
      todayCount,
      todayDurationMinutes,
      goalCount,
      goalDurationMinutes,
      goalProgress,
      goalCompleted: goalProgress.completed,
      badges: buildBadges({ currentStreak, totalCount, goalCompleted: goalProgress.completed }),
    })
  })

  app.delete('/api/checkins/:id', async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params)
    const record = await app.db.checkIn.findFirst({
      where: {
        id: params.id,
        userId: request.user.userId,
      },
    })

    if (!record) {
      return reply.code(404).send(fail('打卡记录不存在', 404))
    }

    await app.db.checkIn.delete({ where: { id: params.id } })
    return ok({ id: params.id }, '删除成功')
  })

  return app
}

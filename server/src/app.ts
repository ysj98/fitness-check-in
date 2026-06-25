import type { FastifyRequest } from 'fastify'
import type { AppDb, WxSession } from './types.js'
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
import { addChinaDays, formatChinaDate, getChinaDayRange, getChinaMonthRange } from './date.js'
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

const loginSchema = z.object({
  code: z.string().min(1),
})

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  days: z.coerce.number().refine(value => [7, 30, 90].includes(value), 'days must be 7, 30 or 90'),
})

const weightSettingsSchema = z.object({
  heightCm: heightValueSchema.optional().nullable(),
  targetWeightKg: weightValueSchema.optional().nullable(),
  weightUnit: z.enum(['kg', 'jin']).optional(),
})

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dailyGoal: z.coerce.number().int().min(1).max(9).optional(),
  heightCm: heightValueSchema.optional().nullable(),
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

function calculateRawBmi(weightKg: number, heightCm: number | null) {
  if (!heightCm) {
    return null
  }
  return weightKg / ((heightCm / 100) ** 2)
}

function calculateBmi(weightKg: number, heightCm: number | null) {
  const bmi = calculateRawBmi(weightKg, heightCm)
  return bmi === null ? null : round(bmi, 1)
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

function serializeWeightRecord(record: Awaited<ReturnType<AppDb['weightRecord']['findFirst']>>, heightCm: number | null) {
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

function buildBadges(params: { currentStreak: number, totalCount: number, todayCompleted: boolean }) {
  const { currentStreak, totalCount, todayCompleted } = params

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
      key: 'daily_goal',
      name: '今日达标',
      description: '完成今日目标',
      unlocked: todayCompleted,
    },
  ]
}

function serializeUser(user: Awaited<ReturnType<AppDb['user']['findUnique']>>) {
  if (!user) {
    return null
  }

  return {
    userId: user.id,
    username: user.openid,
    nickname: user.nickname,
    avatar: user.avatarUrl || '',
    avatarUrl: user.avatarUrl || '',
    gender: user.gender || '',
    birthday: user.birthday || '',
    dailyGoal: user.dailyGoal || 1,
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

  app.decorate('db', options.db)

  await app.register(cors, {
    origin: true,
  })
  await app.register(jwt, {
    secret: jwtSecret || 'development-only-secret',
  })

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof ZodError ? 400 : error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
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
        dailyGoal: 1,
        nickname: '运动达人',
      },
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '30d' })
    reply.send(ok({
      token,
      expiresIn: 30 * 24 * 60 * 60,
      user: serializeUser(user),
    }))
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
        ...(body.dailyGoal ? { dailyGoal: body.dailyGoal } : {}),
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
    if (request.routeOptions.url?.startsWith('/api/checkins') || request.routeOptions.url?.startsWith('/api/weights')) {
      await requireAuth(request)
    }
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
      items: records.map(record => serializeWeightRecord(record, heightCm)),
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
      changeKg: currentWeightKg !== null && previousWeightKg !== null
        ? round(currentWeightKg - previousWeightKg)
        : null,
      targetWeightKg,
      distanceToTargetKg: currentWeightKg !== null && targetWeightKg !== null
        ? round(Math.abs(currentWeightKg - targetWeightKg))
        : null,
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
      records: records.map(record => ({
        id: record.id,
        checkedAt: record.checkedAt.toISOString(),
      })),
    })
  })

  app.post('/api/checkins', async (request) => {
    const record = await app.db.checkIn.create({
      data: {
        userId: request.user.userId,
        checkedAt: new Date(),
      },
    })

    return ok({
      id: record.id,
      checkedAt: record.checkedAt.toISOString(),
    }, '打卡成功')
  })

  app.get('/api/checkins/recent', async (request) => {
    const query = recentQuerySchema.parse(request.query)
    const records = await app.db.checkIn.findMany({
      where: { userId: request.user.userId },
      orderBy: { checkedAt: 'desc' },
      take: query.limit,
    })

    return ok(records.map(record => ({
      id: record.id,
      checkedAt: record.checkedAt.toISOString(),
    })))
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

    return ok({ month: query.month, days })
  })

  app.get('/api/checkins/stats', async (request) => {
    const todayRange = getChinaDayRange()
    const [allRecords, todayCount, user] = await Promise.all([
      app.db.checkIn.findMany({
        where: { userId: request.user.userId },
        orderBy: { checkedAt: 'desc' },
      }),
      app.db.checkIn.count({
        where: {
          userId: request.user.userId,
          checkedAt: { gte: todayRange.start, lt: todayRange.end },
        },
      }),
      app.db.user.findUnique({ where: { id: request.user.userId } }),
    ])
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }
    const checkedDateSet = new Set(allRecords.map(record => formatChinaDate(record.checkedAt)))
    let currentStreak = 0
    let cursor = getChinaDayRange().start

    while (checkedDateSet.has(formatChinaDate(cursor))) {
      currentStreak += 1
      cursor = addChinaDays(cursor, -1)
    }
    const totalCount = allRecords.length
    const todayGoal = user.dailyGoal || 1
    const todayCompleted = todayCount >= todayGoal

    return ok({
      currentStreak,
      totalCount,
      todayGoal,
      todayCompleted,
      badges: buildBadges({ currentStreak, totalCount, todayCompleted }),
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

import type { FastifyInstance, FastifyRequest } from 'fastify'
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
import { z } from 'zod'
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

const loginSchema = z.object({
  code: z.string().min(1),
})

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

function ok<T>(data: T, message = 'ok') {
  return { code: 0, data, message, msg: message }
}

function fail(message: string, code = 400) {
  return { code, data: null, message, msg: message }
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
    role: 'user',
    roles: ['user'],
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

async function requireAuth(app: FastifyInstance, request: FastifyRequest) {
  await request.jwtVerify()
  const user = await app.db.user.findUnique({ where: { id: request.user.userId } })
  if (!user) {
    const error = new Error('User not found') as Error & { statusCode: number }
    error.statusCode = 401
    throw error
  }
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

  app.addContentTypeParser(/^multipart\/form-data/i, { parseAs: 'buffer' }, (request, body, done) => {
    done(null, parseAvatarUpload(body as Buffer, request.headers['content-type']))
  })

  app.decorate('db', options.db)

  await app.register(cors, {
    origin: true,
  })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  })

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
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
        nickname: '运动达人',
      },
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '30d' })
    reply.send(ok({
      token,
      expiresIn: 30 * 24 * 60 * 60,
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        birthday: user.birthday,
      },
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
    await request.jwtVerify()
    const body = profileSchema.parse(request.body)
    const user = await app.db.user.update({
      where: { id: request.user.userId },
      data: {
        nickname: body.nickname,
        avatarUrl: body.avatarUrl || null,
        gender: body.gender || null,
        birthday: body.birthday || null,
      },
    })

    return ok(serializeUser(user), '保存成功')
  })

  app.post('/api/user/avatar', async (request) => {
    await request.jwtVerify()
    const file = request.body as UploadedFile | null
    if (!file || !file.data.length) {
      return fail('头像文件不能为空', 400)
    }
    if (!file.mimeType.startsWith('image/')) {
      return fail('只支持图片文件', 400)
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
    if (request.routeOptions.url?.startsWith('/api/checkins')) {
      await requireAuth(app, request)
    }
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
    const { start, end } = getChinaWeekRange()
    const weekRecords = await app.db.checkIn.findMany({
      where: {
        userId: request.user.userId,
        checkedAt: { gte: start, lt: end },
      },
      orderBy: { checkedAt: 'asc' },
    })
    const allRecords = await app.db.checkIn.findMany({
      where: { userId: request.user.userId },
      orderBy: { checkedAt: 'desc' },
    })
    const weekCounts = weekRecords.reduce<Record<string, number>>((result, record) => {
      const key = formatChinaDate(record.checkedAt)
      result[key] = (result[key] || 0) + 1
      return result
    }, {})
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = formatChinaDate(addChinaDays(start, index))
      return {
        date,
        count: weekCounts[date] || 0,
      }
    })
    const checkedDateSet = new Set(allRecords.map(record => formatChinaDate(record.checkedAt)))
    let currentStreak = 0
    let cursor = getChinaDayRange().start

    while (checkedDateSet.has(formatChinaDate(cursor))) {
      currentStreak += 1
      cursor = addChinaDays(cursor, -1)
    }

    return ok({
      weekStart: formatChinaDate(start),
      weekEnd: formatChinaDate(addChinaDays(end, -1)),
      weekTotal: weekRecords.length,
      activeDays: weekDays.filter(day => day.count > 0).length,
      currentStreak,
      weekDays,
    })
  })

  app.delete('/api/checkins/:id', async (request) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params)
    const record = await app.db.checkIn.findFirst({
      where: {
        id: params.id,
        userId: request.user.userId,
      },
    })

    if (!record) {
      return fail('打卡记录不存在', 404)
    }

    await app.db.checkIn.delete({ where: { id: params.id } })
    return ok({ id: params.id }, '删除成功')
  })

  return app
}

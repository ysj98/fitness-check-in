import type { AppCheckIn, AppDb, AppUser, AppWeightRecord } from './types.js'
import { Buffer } from 'node:buffer'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { getChinaDayRange } from './date.js'

function createMemoryDb(): AppDb & { users: AppUser[], checkIns: AppCheckIn[], weightRecords: AppWeightRecord[] } {
  const users: AppUser[] = []
  const checkIns: AppCheckIn[] = []
  const weightRecords: AppWeightRecord[] = []
  let userId = 1
  let checkInId = 1
  let weightRecordId = 1

  return {
    users,
    checkIns,
    weightRecords,
    user: {
      async upsert(args: any) {
        const openid = args.where.openid
        let user = users.find(item => item.openid === openid)
        if (!user) {
          user = {
            id: userId++,
            openid,
            nickname: args.create.nickname,
            avatarUrl: null,
            gender: null,
            birthday: null,
            dailyGoal: args.create.dailyGoal || 1,
            heightCm: null,
            targetWeightKg: null,
            weightUnit: 'kg',
          }
          users.push(user)
        }
        return user
      },
      async findUnique(args: any) {
        return users.find(item => item.id === args.where.id) || null
      },
      async update(args: any) {
        const user = users.find(item => item.id === args.where.id)
        if (!user) {
          throw new Error('User not found')
        }
        Object.assign(user, args.data)
        return user
      },
    },
    checkIn: {
      async count(args: any) {
        return checkIns.filter(item => matchWhere(item, args.where)).length
      },
      async create(args: any) {
        const record = {
          id: checkInId++,
          userId: args.data.userId,
          checkedAt: args.data.checkedAt,
          createdAt: new Date(),
        }
        checkIns.push(record)
        return record
      },
      async findMany(args: any) {
        let records = checkIns.filter(item => matchWhere(item, args.where || {}))
        if (args.orderBy?.checkedAt === 'desc') {
          records = records.sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())
        }
        else if (args.orderBy?.checkedAt === 'asc') {
          records = records.sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())
        }
        return typeof args.take === 'number' ? records.slice(0, args.take) : records
      },
      async findFirst(args: any) {
        return checkIns.find(item => matchWhere(item, args.where)) || null
      },
      async delete(args: any) {
        const index = checkIns.findIndex(item => item.id === args.where.id)
        const [record] = checkIns.splice(index, 1)
        return record
      },
    },
    weightRecord: {
      async count(args: any) {
        return weightRecords.filter(item => matchWeightWhere(item, args.where || {})).length
      },
      async create(args: any) {
        const record: AppWeightRecord = {
          id: weightRecordId++,
          userId: args.data.userId,
          weightKg: args.data.weightKg,
          measuredAt: args.data.measuredAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        weightRecords.push(record)
        return record
      },
      async findMany(args: any) {
        let records = weightRecords.filter(item => matchWeightWhere(item, args.where || {}))
        const measuredAtOrder = Array.isArray(args.orderBy)
          ? args.orderBy.find((item: any) => item.measuredAt)?.measuredAt
          : args.orderBy?.measuredAt
        const idOrder = Array.isArray(args.orderBy)
          ? args.orderBy.find((item: any) => item.id)?.id
          : args.orderBy?.id
        records = [...records].sort((a, b) => {
          const timeDiff = a.measuredAt.getTime() - b.measuredAt.getTime()
          if (timeDiff !== 0) {
            return measuredAtOrder === 'desc' ? -timeDiff : timeDiff
          }
          const idDiff = a.id - b.id
          return idOrder === 'desc' ? -idDiff : idDiff
        })
        const start = args.skip || 0
        return typeof args.take === 'number' ? records.slice(start, start + args.take) : records.slice(start)
      },
      async findFirst(args: any) {
        return weightRecords.find(item => matchWeightWhere(item, args.where || {})) || null
      },
      async update(args: any) {
        const record = weightRecords.find(item => item.id === args.where.id)
        if (!record) {
          throw new Error('Weight record not found')
        }
        Object.assign(record, args.data, { updatedAt: new Date() })
        return record
      },
      async delete(args: any) {
        const index = weightRecords.findIndex(item => item.id === args.where.id)
        const [record] = weightRecords.splice(index, 1)
        return record
      },
    },
  }
}

function matchWhere(record: AppCheckIn, where: any) {
  if (where.userId !== undefined && record.userId !== where.userId) {
    return false
  }
  if (where.id !== undefined && record.id !== where.id) {
    return false
  }
  if (where.checkedAt?.gte && record.checkedAt < where.checkedAt.gte) {
    return false
  }
  if (where.checkedAt?.lt && record.checkedAt >= where.checkedAt.lt) {
    return false
  }
  return true
}

function matchWeightWhere(record: AppWeightRecord, where: any) {
  if (where.userId !== undefined && record.userId !== where.userId) {
    return false
  }
  if (where.id !== undefined && record.id !== where.id) {
    return false
  }
  if (where.measuredAt?.gte && record.measuredAt < where.measuredAt.gte) {
    return false
  }
  if (where.measuredAt?.lt && record.measuredAt >= where.measuredAt.lt) {
    return false
  }
  return true
}

async function login(app: Awaited<ReturnType<typeof createApp>>, code = 'code-1') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/wx-login',
    payload: { code },
  })
  return response.json().data as { token: string, user: { userId: number } }
}

function checkInAtChinaDay(userId: number, dayOffset: number, id: number): AppCheckIn {
  const checkedAt = new Date(getChinaDayRange().start.getTime() - dayOffset * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)

  return {
    id,
    userId,
    checkedAt,
    createdAt: checkedAt,
  }
}

function multipartAvatarPayload() {
  const boundary = '----avatar-test-boundary'
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from('Content-Disposition: form-data; name="avatar"; filename="avatar.png"\r\n'),
    Buffer.from('Content-Type: image/png\r\n\r\n'),
    Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  return {
    boundary,
    payload,
  }
}

describe('fitness check-in api', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret'
    process.env.NODE_ENV = 'test'
  })

  it('logs in with injected WeChat exchange', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async code => ({ openid: `openid-${code}` }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/wx-login',
      payload: { code: 'abc' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.token).toBeTruthy()
    expect(response.json().data.user.username).toBe('openid-abc')
    expect(response.json().data.user.dailyGoal).toBe(1)
  })

  it('creates check-ins and returns today summary', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: { authorization: `Bearer ${session.token}` },
    })
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: { authorization: `Bearer ${session.token}` },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/today',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.count).toBe(2)
    expect(response.json().data.records).toHaveLength(2)
  })

  it('groups month check-ins by China date', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      { id: 1, userId: session.user.userId, checkedAt: new Date('2026-06-01T01:00:00.000Z'), createdAt: new Date() },
      { id: 2, userId: session.user.userId, checkedAt: new Date('2026-06-01T02:00:00.000Z'), createdAt: new Date() },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/month?month=2026-06',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.days['2026-06-01']).toBe(2)
  })

  it('does not delete another user check-in', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async code => ({ openid: `openid-${code}` }),
    })
    const first = await login(app, 'first')
    const second = await login(app, 'second')
    db.checkIns.push({ id: 1, userId: first.user.id, checkedAt: new Date(), createdAt: new Date() })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/checkins/1',
      headers: { authorization: `Bearer ${second.token}` },
    })

    expect(response.json().code).toBe(404)
    expect(db.checkIns).toHaveLength(1)
  })

  it('returns current streak when recent days are checked in', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      checkInAtChinaDay(session.user.userId, 0, 1),
      checkInAtChinaDay(session.user.userId, 1, 2),
      checkInAtChinaDay(session.user.userId, 2, 3),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.currentStreak).toBe(3)
  })

  it('stops current streak when yesterday is missing', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      checkInAtChinaDay(session.user.userId, 0, 1),
      checkInAtChinaDay(session.user.userId, 2, 2),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.currentStreak).toBe(1)
  })

  it('updates current user profile', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        nickname: 'Alex',
        avatarUrl: 'https://example.com/avatar.png',
        gender: 'other',
        birthday: '1995-05-20',
        dailyGoal: 3,
      },
    })

    expect(response.json().data.nickname).toBe('Alex')
    expect(response.json().data.gender).toBe('other')
    expect(response.json().data.birthday).toBe('1995-05-20')
    expect(response.json().data.dailyGoal).toBe(3)
  })

  it('rejects invalid daily goal', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        nickname: 'Alex',
        dailyGoal: 10,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('dailyGoal')
  })

  it('returns goal progress and badges in stats', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        nickname: 'Alex',
        dailyGoal: 2,
      },
    })
    db.checkIns.push(
      checkInAtChinaDay(session.user.userId, 0, 1),
      checkInAtChinaDay(session.user.userId, 0, 2),
      checkInAtChinaDay(session.user.userId, 1, 3),
      checkInAtChinaDay(session.user.userId, 2, 4),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const data = response.json().data

    expect(data.totalCount).toBe(4)
    expect(data.todayGoal).toBe(2)
    expect(data.todayCompleted).toBe(true)
    expect(data.badges.find((badge: { key: string }) => badge.key === 'streak_3').unlocked).toBe(true)
    expect(data.badges.find((badge: { key: string }) => badge.key === 'daily_goal').unlocked).toBe(true)
  })

  it('rejects avatar upload without login', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
      uploadDir: await mkdtemp(path.join(tmpdir(), 'fitness-avatar-')),
    })
    const { boundary, payload } = multipartAvatarPayload()

    const response = await app.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })

    expect(response.statusCode).toBe(401)
  })

  it('uploads avatar and saves profile avatar url', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
      uploadDir: await mkdtemp(path.join(tmpdir(), 'fitness-avatar-')),
    })
    const session = await login(app)
    const { boundary, payload } = multipartAvatarPayload()
    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: {
        'authorization': `Bearer ${session.token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'host': 'api.example.com',
        'x-forwarded-proto': 'https',
      },
      payload,
    })
    const avatarUrl = uploadResponse.json().data.avatarUrl

    const profileResponse = await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        nickname: 'Alex',
        avatarUrl,
        gender: 'other',
        birthday: '1995-05-20',
        dailyGoal: 1,
      },
    })

    expect(avatarUrl).toMatch(/^https:\/\/api\.example\.com\/uploads\/avatars\//)
    expect(profileResponse.json().data.avatarUrl).toBe(avatarUrl)
  })

  it('requires login for weight records', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/weights?page=1&pageSize=20',
    })

    expect(response.statusCode).toBe(401)
  })

  it('saves weight settings and calculates BMI with Chinese adult thresholds', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    const settingsResponse = await app.inject({
      method: 'PATCH',
      url: '/api/user/weight-settings',
      headers: authorization,
      payload: {
        heightCm: 170,
        targetWeightKg: 60,
        weightUnit: 'jin',
      },
    })
    expect(settingsResponse.json().data.heightCm).toBe(170)
    expect(settingsResponse.json().data.targetWeightKg).toBe(60)
    expect(settingsResponse.json().data.weightUnit).toBe('jin')

    const measuredAt = new Date(Date.now() - 1000).toISOString()
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 53.44, measuredAt },
    })
    const recordId = createResponse.json().data.id

    let statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmi).toBe(18.5)
    expect(statsResponse.json().data.bmiCategory).toBe('underweight')

    await app.inject({
      method: 'PATCH',
      url: `/api/weights/${recordId}`,
      headers: authorization,
      payload: { weightKg: 53.47, measuredAt },
    })
    statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmiCategory).toBe('normal')

    await app.inject({
      method: 'PATCH',
      url: `/api/weights/${recordId}`,
      headers: authorization,
      payload: { weightKg: 69.36, measuredAt },
    })
    statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmi).toBe(24)
    expect(statsResponse.json().data.bmiCategory).toBe('overweight')

    await app.inject({
      method: 'PATCH',
      url: `/api/weights/${recordId}`,
      headers: authorization,
      payload: { weightKg: 80.92, measuredAt },
    })
    statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmi).toBe(28)
    expect(statsResponse.json().data.bmiCategory).toBe('obese')
  })

  it('keeps multiple daily weights and uses the last measurement in the trend', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }
    const yesterdayStart = getChinaDayRange().start.getTime() - 24 * 60 * 60 * 1000
    const firstTime = new Date(yesterdayStart + 8 * 60 * 60 * 1000).toISOString()
    const lastTime = new Date(yesterdayStart + 12 * 60 * 60 * 1000).toISOString()

    await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 70.5, measuredAt: firstTime },
    })
    await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 70.1, measuredAt: lastTime },
    })

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/weights?page=1&pageSize=20',
      headers: authorization,
    })
    const statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=7',
      headers: authorization,
    })

    expect(listResponse.json().data.total).toBe(2)
    expect(statsResponse.json().data.trend).toHaveLength(1)
    expect(statsResponse.json().data.trend[0].weightKg).toBe(70.1)
  })

  it('paginates, edits and deletes owned weight records', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async code => ({ openid: `openid-${code}` }),
    })
    const owner = await login(app, 'owner')
    const other = await login(app, 'other')
    const ownerHeaders = { authorization: `Bearer ${owner.token}` }
    const now = Date.now()
    const createdIds: number[] = []

    for (let index = 0; index < 3; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/weights',
        headers: ownerHeaders,
        payload: {
          weightKg: 70 + index,
          measuredAt: new Date(now - (index + 1) * 60 * 1000).toISOString(),
        },
      })
      createdIds.push(response.json().data.id)
    }

    const pageResponse = await app.inject({
      method: 'GET',
      url: '/api/weights?page=2&pageSize=2',
      headers: ownerHeaders,
    })
    expect(pageResponse.json().data.total).toBe(3)
    expect(pageResponse.json().data.items).toHaveLength(1)

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/weights/${createdIds[0]}`,
      headers: ownerHeaders,
      payload: {
        weightKg: 68.8,
        measuredAt: new Date(now - 30 * 1000).toISOString(),
      },
    })
    expect(updateResponse.json().data.weightKg).toBe(68.8)

    const forbiddenDelete = await app.inject({
      method: 'DELETE',
      url: `/api/weights/${createdIds[0]}`,
      headers: { authorization: `Bearer ${other.token}` },
    })
    expect(forbiddenDelete.statusCode).toBe(404)

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/weights/${createdIds[0]}`,
      headers: ownerHeaders,
    })
    expect(deleteResponse.statusCode).toBe(200)
    expect(db.weightRecords).toHaveLength(2)
  })

  it('validates weight, height, stats range and future measurement time', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    const invalidHeight = await app.inject({
      method: 'PATCH',
      url: '/api/user/weight-settings',
      headers: authorization,
      payload: { heightCm: 99 },
    })
    const invalidWeight = await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 301, measuredAt: new Date().toISOString() },
    })
    const invalidDays = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=14',
      headers: authorization,
    })
    const futureTime = await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 70, measuredAt: new Date(Date.now() + 2 * 60 * 1000).toISOString() },
    })

    expect(invalidHeight.statusCode).toBe(400)
    expect(invalidWeight.statusCode).toBe(400)
    expect(invalidDays.statusCode).toBe(400)
    expect(futureTime.statusCode).toBe(400)
  })

  it('returns null BMI until height is set and recalculates historical records', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    await app.inject({
      method: 'POST',
      url: '/api/weights',
      headers: authorization,
      payload: { weightKg: 72, measuredAt: new Date(Date.now() - 1000).toISOString() },
    })
    let statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmi).toBeNull()

    await app.inject({
      method: 'PATCH',
      url: '/api/user/weight-settings',
      headers: authorization,
      payload: { heightCm: 180 },
    })
    statsResponse = await app.inject({
      method: 'GET',
      url: '/api/weights/stats?days=30',
      headers: authorization,
    })
    expect(statsResponse.json().data.bmi).toBe(22.2)
    expect(statsResponse.json().data.trend[0].bmi).toBe(22.2)
  })
})

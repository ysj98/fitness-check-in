import type { AppCheckIn, AppDb, AppUser, AppWeightRecord } from './types.js'
import { Buffer } from 'node:buffer'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { addChinaDays, formatChinaDate, getChinaDayRange, getChinaMonthRange } from './date.js'

function createMemoryDb(): AppDb & { users: AppUser[]; checkIns: AppCheckIn[]; weightRecords: AppWeightRecord[] } {
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
        let user = users.find((item) => item.openid === openid)
        if (!user) {
          user = {
            id: userId++,
            openid,
            nickname: args.create.nickname,
            avatarUrl: null,
            gender: null,
            birthday: null,
            dailyGoal: args.create.dailyGoal || 1,
            goalPeriod: args.create.goalPeriod || 'none',
            goalMode: args.create.goalMode || 'count',
            goalCount: args.create.goalCount || 4,
            goalDuration: args.create.goalDuration || 180,
            heightCm: null,
            targetWeightKg: null,
            weightUnit: 'kg',
          }
          users.push(user)
        }
        return user
      },
      async findUnique(args: any) {
        return users.find((item) => item.id === args.where.id) || null
      },
      async update(args: any) {
        const user = users.find((item) => item.id === args.where.id)
        if (!user) {
          throw new Error('User not found')
        }
        Object.assign(user, args.data)
        return user
      },
    },
    checkIn: {
      async count(args: any) {
        return checkIns.filter((item) => matchWhere(item, args.where)).length
      },
      async create(args: any) {
        const record = {
          id: checkInId++,
          userId: args.data.userId,
          checkedAt: args.data.checkedAt,
          createdAt: new Date(),
          isBackfill: args.data.isBackfill,
          backfillReason: args.data.backfillReason,
          sportType: args.data.sportType,
          durationMinutes: args.data.durationMinutes,
        }
        checkIns.push(record)
        return record
      },
      async findMany(args: any) {
        let records = checkIns.filter((item) => matchWhere(item, args.where || {}))
        if (args.orderBy?.checkedAt === 'desc') {
          records = records.sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())
        } else if (args.orderBy?.checkedAt === 'asc') {
          records = records.sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())
        }
        return typeof args.take === 'number' ? records.slice(0, args.take) : records
      },
      async findFirst(args: any) {
        return checkIns.find((item) => matchWhere(item, args.where)) || null
      },
      async delete(args: any) {
        const index = checkIns.findIndex((item) => item.id === args.where.id)
        const [record] = checkIns.splice(index, 1)
        return record
      },
    },
    weightRecord: {
      async count(args: any) {
        return weightRecords.filter((item) => matchWeightWhere(item, args.where || {})).length
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
        let records = weightRecords.filter((item) => matchWeightWhere(item, args.where || {}))
        const measuredAtOrder = Array.isArray(args.orderBy)
          ? args.orderBy.find((item: any) => item.measuredAt)?.measuredAt
          : args.orderBy?.measuredAt
        const idOrder = Array.isArray(args.orderBy) ? args.orderBy.find((item: any) => item.id)?.id : args.orderBy?.id
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
        return weightRecords.find((item) => matchWeightWhere(item, args.where || {})) || null
      },
      async update(args: any) {
        const record = weightRecords.find((item) => item.id === args.where.id)
        if (!record) {
          throw new Error('Weight record not found')
        }
        Object.assign(record, args.data, { updatedAt: new Date() })
        return record
      },
      async delete(args: any) {
        const index = weightRecords.findIndex((item) => item.id === args.where.id)
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
  if (where.isBackfill !== undefined && record.isBackfill !== where.isBackfill) {
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
  return response.json().data as { token: string; user: { userId: number } }
}

function createCheckInRecord(params: {
  id: number
  userId: number
  checkedAt: Date
  isBackfill?: boolean
  backfillReason?: string | null
  sportType?: string
  durationMinutes?: number
}): AppCheckIn {
  return {
    id: params.id,
    userId: params.userId,
    checkedAt: params.checkedAt,
    createdAt: params.checkedAt,
    isBackfill: params.isBackfill ?? false,
    backfillReason: params.backfillReason ?? null,
    sportType: params.sportType ?? '其他',
    durationMinutes: params.durationMinutes ?? 30,
  }
}

function checkInAtChinaDay(userId: number, dayOffset: number, id: number): AppCheckIn {
  const checkedAt = new Date(getChinaDayRange().start.getTime() - dayOffset * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)

  return createCheckInRecord({
    userId,
    id,
    checkedAt,
  })
}

function chinaDateKeyForOffset(dayOffset: number) {
  return formatChinaDate(addChinaDays(getChinaDayRange().start, -dayOffset))
}

function multipartAvatarPayload() {
  const boundary = '----avatar-test-boundary'
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from('Content-Disposition: form-data; name="avatar"; filename="avatar.png"\r\n'),
    Buffer.from('Content-Type: image/png\r\n\r\n'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
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
      exchangeCode: async (code) => ({ openid: `openid-${code}` }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/wx-login',
      payload: { code: 'abc' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.token).toBeTruthy()
    expect(response.json().data.user.username).toBe('openid-abc')
    expect(response.json().data.user).toMatchObject({
      goalPeriod: 'none',
      goalMode: 'count',
      goalCount: 4,
      goalDuration: 180,
    })
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
      payload: { sportType: '跑步', durationMinutes: 30 },
    })
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: { authorization: `Bearer ${session.token}` },
      payload: { sportType: '瑜伽', durationMinutes: 45 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/today',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.count).toBe(2)
    expect(response.json().data.records).toHaveLength(2)
    expect(response.json().data.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sportType: '瑜伽',
          durationMinutes: 45,
        }),
      ]),
    )
  })

  it('saves check-in sport details and rejects invalid duration', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      payload: { sportType: '骑行', durationMinutes: 60 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      id: 1,
      sportType: '骑行',
      durationMinutes: 60,
    })

    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      payload: { sportType: '跑步', durationMinutes: 301 },
    })

    expect(invalidResponse.statusCode).toBe(400)
  })

  it('groups month check-ins by China date', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      createCheckInRecord({
        id: 1,
        userId: session.user.userId,
        checkedAt: new Date('2026-06-01T01:00:00.000Z'),
      }),
      createCheckInRecord({
        id: 2,
        userId: session.user.userId,
        checkedAt: new Date('2026-06-01T02:00:00.000Z'),
      }),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/month?month=2026-06',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.days['2026-06-01']).toBe(2)
  })

  it('creates a backfill check-in for a past missing day and returns monthly backfill stats', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }
    const date = chinaDateKeyForOffset(1)

    const response = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date, reason: '已运动未记录', sportType: '跑步', durationMinutes: 45 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      isBackfill: true,
      backfillReason: '已运动未记录',
      sportType: '跑步',
      durationMinutes: 45,
    })

    const monthResponse = await app.inject({
      method: 'GET',
      url: `/api/checkins/month?month=${date.slice(0, 7)}`,
      headers: authorization,
    })
    expect(monthResponse.json().data.days[date]).toBe(1)
    expect(monthResponse.json().data.backfillDays[date]).toBe(1)
    expect(monthResponse.json().data.backfillUsed).toBe(1)
    expect(monthResponse.json().data.backfillLimit).toBe(3)
  })

  it('rejects backfill for today, future dates, old dates, existing check-ins, and monthly limit', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }
    const today = chinaDateKeyForOffset(0)
    const yesterday = chinaDateKeyForOffset(1)
    const future = formatChinaDate(addChinaDays(getChinaDayRange().start, 1))
    const tooOld = chinaDateKeyForOffset(31)

    db.checkIns.push(checkInAtChinaDay(session.user.userId, 1, 1))
    db.checkIns.push(
      { ...checkInAtChinaDay(session.user.userId, 2, 2), isBackfill: true, backfillReason: '忘记打卡' },
      { ...checkInAtChinaDay(session.user.userId, 3, 3), isBackfill: true, backfillReason: '忘记打卡' },
      { ...checkInAtChinaDay(session.user.userId, 4, 4), isBackfill: true, backfillReason: '其他' },
    )

    const todayResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: today, reason: '忘记打卡', sportType: '散步', durationMinutes: 30 },
    })
    const futureResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: future, reason: '忘记打卡', sportType: '散步', durationMinutes: 30 },
    })
    const oldResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: tooOld, reason: '忘记打卡', sportType: '散步', durationMinutes: 30 },
    })
    const existingResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: yesterday, reason: '忘记打卡', sportType: '散步', durationMinutes: 30 },
    })
    const limitResponse = await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: chinaDateKeyForOffset(5), reason: '忘记打卡', sportType: '散步', durationMinutes: 30 },
    })

    expect(todayResponse.statusCode).toBe(400)
    expect(todayResponse.json().message).toBe('今天请使用正常打卡')
    expect(futureResponse.statusCode).toBe(400)
    expect(futureResponse.json().message).toBe('不能补签未来日期')
    expect(oldResponse.statusCode).toBe(400)
    expect(existingResponse.statusCode).toBe(409)
    expect(limitResponse.statusCode).toBe(400)
    expect(limitResponse.json().message).toBe('本月补签次数已用完')
  })

  it('includes backfilled days in current streak', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }
    db.checkIns.push(checkInAtChinaDay(session.user.userId, 0, 1), checkInAtChinaDay(session.user.userId, 2, 2))

    await app.inject({
      method: 'POST',
      url: '/api/checkins/backfill',
      headers: authorization,
      payload: { date: chinaDateKeyForOffset(1), reason: '忘记打卡', sportType: '瑜伽', durationMinutes: 60 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: authorization,
    })

    expect(response.json().data.currentStreak).toBe(3)
  })

  it('does not delete another user check-in', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async (code) => ({ openid: `openid-${code}` }),
    })
    const first = await login(app, 'first')
    const second = await login(app, 'second')
    db.checkIns.push(createCheckInRecord({ id: 1, userId: first.user.id, checkedAt: new Date() }))

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
    db.checkIns.push(checkInAtChinaDay(session.user.userId, 0, 1), checkInAtChinaDay(session.user.userId, 2, 2))

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
        goalPeriod: 'month',
        goalMode: 'both',
        goalCount: 3,
        goalDuration: 800,
      },
    })

    expect(response.json().data.nickname).toBe('Alex')
    expect(response.json().data.gender).toBe('other')
    expect(response.json().data.birthday).toBe('1995-05-20')
    expect(response.json().data.goalPeriod).toBe('month')
    expect(response.json().data.goalMode).toBe('both')
    expect(response.json().data.goalCount).toBe(3)
    expect(response.json().data.goalDuration).toBe(800)
  })

  it('normalizes empty optional profile fields to null', async () => {
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
        avatarUrl: '',
        gender: '',
        birthday: '',
        goalPeriod: 'week',
        goalMode: 'duration',
        goalCount: 3,
        goalDuration: 60,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(db.users[0]).toMatchObject({
      avatarUrl: null,
      gender: null,
      birthday: null,
    })
  })

  it('rejects invalid goal settings', async () => {
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
        goalPeriod: 'week',
        goalMode: 'both',
        goalCount: 15,
        goalDuration: 29,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('goalCount')
  })

  it('returns count goal progress and badges in stats', async () => {
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
        goalPeriod: 'week',
        goalMode: 'count',
        goalCount: 2,
        goalDuration: 60,
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
    expect(data.todayCount).toBe(2)
    expect(data.todayDurationMinutes).toBe(60)
    expect(data.goalCount).toBe(4)
    expect(data.goalDurationMinutes).toBe(120)
    expect(data.goalProgress).toMatchObject({
      period: 'week',
      mode: 'count',
      countGoal: 2,
      durationGoal: 60,
      completed: true,
      count: { current: 4, target: 2, completed: true, percent: 100 },
    })
    expect(data.goalCompleted).toBe(true)
    expect(data.badges.find((badge: { key: string }) => badge.key === 'streak_3').unlocked).toBe(true)
    expect(data.badges.find((badge: { key: string }) => badge.key === 'period_goal').unlocked).toBe(true)
  })

  it('does not return goal progress when goal is not configured', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    db.checkIns.push(checkInAtChinaDay(session.user.userId, 0, 1))

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const data = response.json().data

    expect(data.todayCount).toBe(1)
    expect(data.goalCount).toBe(0)
    expect(data.goalDurationMinutes).toBe(0)
    expect(data.goalProgress).toBeNull()
    expect(data.goalCompleted).toBe(false)
    expect(data.badges.find((badge: { key: string }) => badge.key === 'period_goal').unlocked).toBe(false)
  })

  it('requires both count and duration when goal mode is both', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: authorization,
      payload: {
        nickname: 'Alex',
        goalPeriod: 'week',
        goalMode: 'both',
        goalCount: 2,
        goalDuration: 60,
      },
    })
    db.checkIns.push(
      createCheckInRecord({
        userId: session.user.userId,
        id: 1,
        checkedAt: new Date(),
        durationMinutes: 45,
      }),
      createCheckInRecord({
        userId: session.user.userId,
        id: 2,
        checkedAt: new Date(),
        durationMinutes: 10,
      }),
    )

    const firstResponse = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: authorization,
    })

    expect(firstResponse.json().data.goalProgress).toMatchObject({
      period: 'week',
      mode: 'both',
      completed: false,
      count: { current: 2, completed: true },
      duration: { current: 55, completed: false },
    })
    expect(firstResponse.json().data.goalCompleted).toBe(false)

    db.checkIns.push(
      createCheckInRecord({
        userId: session.user.userId,
        id: 3,
        checkedAt: new Date(),
        durationMinutes: 5,
      }),
    )
    const secondResponse = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: authorization,
    })

    expect(secondResponse.json().data.goalCompleted).toBe(true)
    expect(secondResponse.json().data.badges.find((badge: { key: string }) => badge.key === 'period_goal').unlocked).toBe(true)
  })

  it('calculates monthly duration goal progress from the current month', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    await app.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: authorization,
      payload: {
        nickname: 'Alex',
        goalPeriod: 'month',
        goalMode: 'duration',
        goalCount: 2,
        goalDuration: 100,
      },
    })
    const monthStart = getChinaMonthRange(formatChinaDate(new Date()).slice(0, 7)).start
    db.checkIns.push(
      createCheckInRecord({
        userId: session.user.userId,
        id: 1,
        checkedAt: new Date(monthStart.getTime() + 12 * 60 * 60 * 1000),
        durationMinutes: 50,
      }),
      createCheckInRecord({
        userId: session.user.userId,
        id: 2,
        checkedAt: new Date(monthStart.getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        durationMinutes: 50,
      }),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: authorization,
    })

    expect(response.json().data.goalProgress).toMatchObject({
      period: 'month',
      mode: 'duration',
      completed: true,
      duration: { current: 100, target: 100, completed: true, percent: 100 },
    })
    expect(response.json().data.goalCompleted).toBe(true)
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
        authorization: `Bearer ${session.token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        host: 'api.example.com',
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
        goalPeriod: 'week',
        goalMode: 'count',
        goalCount: 4,
        goalDuration: 180,
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
      exchangeCode: async (code) => ({ openid: `openid-${code}` }),
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

  it('requires login for achievements', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns empty achievement progress for a new user', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const achievements = response.json().data

    expect(achievements).toHaveLength(4)
    expect(achievements.find((item: { key: string }) => item.key === 'total-checkin')).toMatchObject({
      completedLevelCount: 0,
      totalLevelCount: 7,
      currentLevel: {
        threshold: 1,
        progress: { current: 0, displayCurrent: 0, target: 1, percent: 0 },
      },
    })
    expect(achievements.find((item: { key: string }) => item.key === 'profile-complete')).toMatchObject({
      completedLevelCount: 0,
      allCompleted: false,
    })
  })

  it('advances check-in stages without displaying progress above the target', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(...Array.from({ length: 30 }, (_, index) => checkInAtChinaDay(session.user.userId, 0, index + 1)))

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const achievements = response.json().data
    const checkinSeries = achievements.find((item: { key: string }) => item.key === 'total-checkin')
    const tenCountLevel = checkinSeries.levels.find((level: { threshold: number }) => level.threshold === 10)

    expect(checkinSeries.completedLevelCount).toBe(3)
    expect(checkinSeries.currentLevel).toMatchObject({
      threshold: 60,
      progress: { current: 30, displayCurrent: 30, target: 60, percent: 50 },
    })
    expect(tenCountLevel.progress).toEqual({
      current: 30,
      displayCurrent: 10,
      target: 10,
      percent: 100,
    })
  })

  it('marks streak stages complete at 100 consecutive days', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      ...Array.from({ length: 100 }, (_, index) => checkInAtChinaDay(session.user.userId, index, index + 1)),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const achievements = response.json().data
    const streakSeries = achievements.find((item: { key: string }) => item.key === 'current-streak')

    expect(streakSeries).toMatchObject({
      completedLevelCount: 6,
      totalLevelCount: 6,
      allCompleted: true,
      currentLevel: {
        threshold: 100,
        progress: { current: 100, displayCurrent: 100, target: 100, percent: 100 },
      },
    })
  })

  it('returns weight achievement progress', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    const authorization = { authorization: `Bearer ${session.token}` }

    await app.inject({
      method: 'PATCH',
      url: '/api/user/weight-settings',
      headers: authorization,
      payload: { targetWeightKg: 65 },
    })
    for (let index = 0; index < 7; index += 1) {
      await app.inject({
        method: 'POST',
        url: '/api/weights',
        headers: authorization,
        payload: {
          weightKg: 70 - index * 0.1,
          measuredAt: new Date(Date.now() - (index + 1) * 60 * 1000).toISOString(),
        },
      })
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
      headers: authorization,
    })
    const achievements = response.json().data
    const weightSeries = achievements.find((item: { key: string }) => item.key === 'weight-record')

    expect(weightSeries).toMatchObject({
      completedLevelCount: 2,
      currentLevel: {
        threshold: 30,
        progress: { current: 7, displayCurrent: 7, target: 30, percent: 23 },
      },
    })
  })

  it('unlocks profile achievement when core fields are complete', async () => {
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
        avatarUrl: 'https://example.com/avatar.png',
        gender: 'other',
        birthday: '1995-05-20',
        goalPeriod: 'week',
        goalMode: 'count',
        goalCount: 4,
        goalDuration: 180,
        heightCm: 178,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/achievements',
      headers: { authorization: `Bearer ${session.token}` },
    })
    const profileAchievement = response.json().data.find((item: { key: string }) => item.key === 'profile-complete')

    expect(profileAchievement).toMatchObject({
      completedLevelCount: 1,
      totalLevelCount: 1,
      allCompleted: true,
      currentLevel: {
        progress: { current: 1, displayCurrent: 1, target: 1, percent: 100 },
      },
    })
  })

  it('requires login for monthly report', async () => {
    const app = await createApp({ db: createMemoryDb(), exchangeCode: async (code) => ({ openid: code }) })

    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/month?month=2026-06',
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns empty monthly report for a month without records', async () => {
    const db = createMemoryDb()
    const app = await createApp({ db, exchangeCode: async (code) => ({ openid: code }) })
    const session = await login(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/month?month=2026-06',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      month: '2026-06',
      checkin: {
        days: 0,
        count: 0,
        durationMinutes: 0,
        averageDurationMinutes: 0,
      },
      weight: {
        recordCount: 0,
        startWeightKg: null,
        endWeightKg: null,
        changeKg: null,
        weightUnit: 'kg',
      },
    })
  })

  it('summarizes monthly check-ins, duration and weight change', async () => {
    const db = createMemoryDb()
    const app = await createApp({ db, exchangeCode: async (code) => ({ openid: code }) })
    const session = await login(app)
    const range = getChinaMonthRange('2026-06')
    const authorization = { authorization: `Bearer ${session.token}` }

    await app.inject({
      method: 'PATCH',
      url: '/api/user/weight-settings',
      headers: authorization,
      payload: { heightCm: 173, targetWeightKg: 68, weightUnit: 'jin' },
    })
    db.checkIns.push(
      createCheckInRecord({
        id: 1,
        userId: session.user.userId,
        checkedAt: new Date(range.start.getTime() + 12 * 60 * 60 * 1000),
        sportType: '跑步',
        durationMinutes: 30,
      }),
      createCheckInRecord({
        id: 2,
        userId: session.user.userId,
        checkedAt: new Date(range.start.getTime() + 14 * 60 * 60 * 1000),
        sportType: '健身',
        durationMinutes: 45,
      }),
      createCheckInRecord({
        id: 3,
        userId: session.user.userId,
        checkedAt: new Date(range.start.getTime() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        sportType: '瑜伽',
        durationMinutes: 60,
      }),
    )
    db.weightRecords.push(
      {
        id: 1,
        userId: session.user.userId,
        weightKg: 70.2,
        measuredAt: new Date(range.start.getTime() + 8 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: session.user.userId,
        weightKg: 69.4,
        measuredAt: new Date(range.start.getTime() + 20 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/month?month=2026-06',
      headers: authorization,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      month: '2026-06',
      checkin: {
        days: 2,
        count: 3,
        durationMinutes: 135,
        averageDurationMinutes: 68,
      },
      weight: {
        recordCount: 2,
        startWeightKg: 70.2,
        endWeightKg: 69.4,
        changeKg: -0.8,
        weightUnit: 'jin',
      },
    })
  })
})

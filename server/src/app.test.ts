import type { AppCheckIn, AppDb, AppUser } from './types.js'
import { Buffer } from 'node:buffer'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { getChinaDayRange } from './date.js'

function createMemoryDb(): AppDb & { users: AppUser[], checkIns: AppCheckIn[] } {
  const users: AppUser[] = []
  const checkIns: AppCheckIn[] = []
  let userId = 1
  let checkInId = 1

  return {
    users,
    checkIns,
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

async function login(app: Awaited<ReturnType<typeof createApp>>, code = 'code-1') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/wx-login',
    payload: { code },
  })
  return response.json().data as { token: string, user: AppUser }
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
    expect(response.json().data.user.openid).toBe('openid-abc')
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
      { id: 1, userId: session.user.id, checkedAt: new Date('2026-06-01T01:00:00.000Z'), createdAt: new Date() },
      { id: 2, userId: session.user.id, checkedAt: new Date('2026-06-01T02:00:00.000Z'), createdAt: new Date() },
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
      checkInAtChinaDay(session.user.id, 0, 1),
      checkInAtChinaDay(session.user.id, 1, 2),
      checkInAtChinaDay(session.user.id, 2, 3),
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
      checkInAtChinaDay(session.user.id, 0, 1),
      checkInAtChinaDay(session.user.id, 2, 2),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.currentStreak).toBe(1)
  })

  it('groups current week stats', async () => {
    const db = createMemoryDb()
    const app = await createApp({
      db,
      exchangeCode: async () => ({ openid: 'openid-1' }),
    })
    const session = await login(app)
    db.checkIns.push(
      checkInAtChinaDay(session.user.id, 0, 1),
      checkInAtChinaDay(session.user.id, 0, 2),
      checkInAtChinaDay(session.user.id, 1, 3),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/checkins/stats',
      headers: { authorization: `Bearer ${session.token}` },
    })

    expect(response.json().data.weekTotal).toBeGreaterThanOrEqual(2)
    expect(response.json().data.activeDays).toBeGreaterThanOrEqual(1)
    expect(response.json().data.weekDays.reduce((sum: number, day: { count: number }) => sum + day.count, 0)).toBe(response.json().data.weekTotal)
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
      },
    })

    expect(response.json().data.nickname).toBe('Alex')
    expect(response.json().data.gender).toBe('other')
    expect(response.json().data.birthday).toBe('1995-05-20')
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
      },
    })

    expect(avatarUrl).toMatch(/^https:\/\/api\.example\.com\/uploads\/avatars\//)
    expect(profileResponse.json().data.avatarUrl).toBe(avatarUrl)
  })
})

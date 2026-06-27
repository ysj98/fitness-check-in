export interface AppUser {
  id: number
  openid: string
  nickname: string
  avatarUrl: string | null
  gender?: string | null
  birthday?: string | null
  dailyGoal: number
  heightCm?: number | string | null
  targetWeightKg?: number | string | null
  weightUnit?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface AppCheckIn {
  id: number
  userId: number
  checkedAt: Date
  createdAt: Date
  isBackfill?: boolean
  backfillReason?: string | null
  sportType?: string
  durationMinutes?: number
}

export interface AppWeightRecord {
  id: number
  userId: number
  weightKg: number | string
  measuredAt: Date
  createdAt: Date
  updatedAt?: Date
}

export interface AppDb {
  user: {
    upsert: (args: unknown) => Promise<AppUser>
    findUnique: (args: unknown) => Promise<AppUser | null>
    update: (args: unknown) => Promise<AppUser>
  }
  checkIn: {
    count: (args: unknown) => Promise<number>
    create: (args: unknown) => Promise<AppCheckIn>
    findMany: (args: unknown) => Promise<AppCheckIn[]>
    findFirst: (args: unknown) => Promise<AppCheckIn | null>
    delete: (args: unknown) => Promise<AppCheckIn>
  }
  weightRecord: {
    count: (args: unknown) => Promise<number>
    create: (args: unknown) => Promise<AppWeightRecord>
    findMany: (args: unknown) => Promise<AppWeightRecord[]>
    findFirst: (args: unknown) => Promise<AppWeightRecord | null>
    update: (args: unknown) => Promise<AppWeightRecord>
    delete: (args: unknown) => Promise<AppWeightRecord>
  }
}

export interface WxSession {
  openid: string
  session_key?: string
  unionid?: string
}

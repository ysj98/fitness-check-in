export interface AppUser {
  id: number
  openid: string
  nickname: string
  avatarUrl: string | null
  gender?: string | null
  birthday?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface AppCheckIn {
  id: number
  userId: number
  checkedAt: Date
  createdAt: Date
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
}

export interface WxSession {
  openid: string
  session_key?: string
  unionid?: string
}

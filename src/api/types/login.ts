export type WeightUnit = 'kg' | 'jin'
export type GoalPeriod = 'week' | 'month'
export type GoalMode = 'count' | 'duration' | 'both'

export interface IUserInfoRes {
  userId: number
  username: string
  nickname: string
  avatar: string
  avatarUrl: string
  gender: string
  birthday: string
  goalPeriod: GoalPeriod
  goalMode: GoalMode
  goalCount: number
  goalDuration: number
  heightCm: number | null
  targetWeightKg: number | null
  weightUnit: WeightUnit
}

export interface IAuthLoginRes {
  token: string
  expiresIn: number
  user: IUserInfoRes
}

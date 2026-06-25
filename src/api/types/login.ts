export type WeightUnit = 'kg' | 'jin'

export interface IUserInfoRes {
  userId: number
  username: string
  nickname: string
  avatar: string
  avatarUrl: string
  gender: string
  birthday: string
  dailyGoal: number
  heightCm: number | null
  targetWeightKg: number | null
  weightUnit: WeightUnit
}

export interface IAuthLoginRes {
  token: string
  expiresIn: number
  user: IUserInfoRes
}

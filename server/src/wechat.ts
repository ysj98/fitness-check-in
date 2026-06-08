import type { WxSession } from './types.js'
import process from 'node:process'

interface WeChatSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

export async function exchangeWeChatCode(code: string): Promise<WxSession> {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET

  if (!appid || !secret) {
    throw new Error('WECHAT_APPID and WECHAT_SECRET are required')
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appid)
  url.searchParams.set('secret', secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`WeChat request failed: ${response.status}`)
  }

  const data = await response.json() as WeChatSessionResponse
  if (!data.openid) {
    throw new Error(data.errmsg || 'WeChat login failed')
  }

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid,
  }
}

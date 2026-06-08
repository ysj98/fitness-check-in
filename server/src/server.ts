import { PrismaClient } from '@prisma/client'
import process from 'node:process'
import { createApp } from './app.js'
import type { AppDb } from './types.js'

const prisma = new PrismaClient()

async function main() {
  const app = await createApp({ db: prisma as unknown as AppDb })
  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '0.0.0.0'

  await app.listen({ port, host })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

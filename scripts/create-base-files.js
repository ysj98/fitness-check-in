import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(rootDir, 'src')
const manifestPath = path.join(srcDir, 'manifest.json')
const pagesPath = path.join(srcDir, 'pages.json')

const basePages = {
  pages: [
    { path: 'pages/index/index', type: 'home' },
    { path: 'pages/weight/index', type: 'page' },
    { path: 'pages/me/me', type: 'page' },
  ],
  subPackages: [],
}

fs.mkdirSync(srcDir, { recursive: true })
if (!fs.existsSync(manifestPath)) {
  fs.writeFileSync(manifestPath, '{}\n')
}
if (!fs.existsSync(pagesPath)) {
  fs.writeFileSync(pagesPath, `${JSON.stringify(basePages, null, 2)}\n`)
}

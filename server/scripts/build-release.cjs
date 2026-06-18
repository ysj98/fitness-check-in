const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const releaseDir = path.join(rootDir, 'release')
const stageDir = path.join(releaseDir, 'fitness-check-in-server')
const zipPath = path.join(releaseDir, 'fitness-check-in-server.zip')

const releaseItems = [
  'dist',
  'prisma',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'ecosystem.config.cjs',
  '.env.example',
]

function clean() {
  fs.rmSync(distDir, { recursive: true, force: true })
  fs.rmSync(stageDir, { recursive: true, force: true })
  fs.rmSync(zipPath, { force: true })
  fs.mkdirSync(stageDir, { recursive: true })
}

function runBuild() {
  const command = process.env.npm_execpath
    ? process.execPath
    : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'build']
    : ['build']

  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: !process.env.npm_execpath && process.platform === 'win32',
  })
}

function copyReleaseFiles() {
  for (const item of releaseItems) {
    const source = path.join(rootDir, item)
    const target = path.join(stageDir, item)
    if (!fs.existsSync(source)) {
      throw new Error(`Missing release item: ${item}`)
    }
    fs.cpSync(source, target, { recursive: true })
  }
}

function walkFiles(baseDir, currentDir = baseDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(baseDir, fullPath))
      continue
    }
    if (!entry.isFile()) {
      continue
    }

    files.push({
      absolute: fullPath,
      name: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
    })
  }

  return files.sort((a, b) => a.name.localeCompare(b.name))
}

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
  let value = i
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
  }
  crcTable[i] = value >>> 0
}

function crc32(buffer) {
  let value = 0xFFFFFFFF
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8)
  }
  return (value ^ 0xFFFFFFFF) >>> 0
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosDate, dosTime }
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

function createZip(sourceDir, targetZip) {
  const files = walkFiles(sourceDir)
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const data = fs.readFileSync(file.absolute)
    const name = Buffer.from(file.name)
    const stat = fs.statSync(file.absolute)
    const { dosDate, dosTime } = dosDateTime(stat.mtime)
    const checksum = crc32(data)

    const localHeader = Buffer.concat([
      writeUInt32(0x04034B50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ])

    const centralHeader = Buffer.concat([
      writeUInt32(0x02014B50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name,
    ])

    localParts.push(localHeader, data)
    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endRecord = Buffer.concat([
    writeUInt32(0x06054B50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length),
    writeUInt16(files.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ])

  fs.mkdirSync(path.dirname(targetZip), { recursive: true })
  fs.writeFileSync(targetZip, Buffer.concat([...localParts, centralDirectory, endRecord]))
}

clean()
runBuild()
copyReleaseFiles()
createZip(stageDir, zipPath)

console.log(`Release package created: ${path.relative(rootDir, zipPath)}`)

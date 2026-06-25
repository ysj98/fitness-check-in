const fs = require('node:fs')
const path = require('node:path')

const serverDir = __dirname
const envFile = path.join(serverDir, '.env')

function parseEnv(file) {
  if (!fs.existsSync(file)) {
    return {}
  }

  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const source = line.trim()
      if (!source || source.startsWith('#')) {
        return env
      }

      const index = source.indexOf('=')
      if (index === -1) {
        return env
      }

      const key = source.slice(0, index).trim()
      let value = source.slice(index + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      env[key] = value
      return env
    }, {})
}

const fileEnv = parseEnv(envFile)
const host = !fileEnv.HOST || fileEnv.HOST === '0.0.0.0' ? '127.0.0.1' : fileEnv.HOST

module.exports = {
  apps: [
    {
      name: 'fitness-check-in-api',
      cwd: serverDir,
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '384M',
      env: {
        ...fileEnv,
        NODE_ENV: 'production',
        PORT: fileEnv.PORT || '3000',
        HOST: host,
        NODE_OPTIONS: fileEnv.NODE_OPTIONS || '--max-old-space-size=256',
      },
    },
  ],
}

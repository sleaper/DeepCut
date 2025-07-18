import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import Database from 'better-sqlite3'
import 'dotenv/config'
import * as schema from './schema'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'

function getDbPath(): string {
  if (process.env.NODE_ENV === 'development') {
    return join(process.cwd(), 'dev.db')
  }

  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  return join(userDataPath, 'clips.db')
}

const dbPath = getDbPath()
console.log(`🗄️ Using database at ${dbPath}`)

const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })

// Run migrations automatically
async function runMigrations() {
  try {
    const migrationsFolder =
      process.env.NODE_ENV === 'development'
        ? join(process.cwd(), 'electron/main/database/migrations')
        : join(process.resourcesPath, 'migrations')

    console.log(`🔄 Running migrations from ${migrationsFolder}`)
    migrate(db, { migrationsFolder })
    console.log('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    // Don't throw - let app continue with existing schema
  }
}

// Auto-run migrations
runMigrations()

export { dbPath }

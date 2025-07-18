import { defineConfig } from 'drizzle-kit'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  schema: './electron/main/database/schema.ts',
  out: './electron/main/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: isProduction ? './clips.db' : './dev.db'
  }
})

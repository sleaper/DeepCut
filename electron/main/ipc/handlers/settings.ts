import { app, safeStorage } from 'electron'
import { logger } from '../../utils/logger'
import fs from 'fs'
import path from 'path'
import { t } from '../trpc'
import { z } from 'zod'

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function readSettings() {
  if (!fs.existsSync(settingsPath)) {
    return {}
  }
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
}

function writeSettings(settings: any) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

export const settingsRouter = t.router({
  getApiToken: t.procedure.input(z.object({ tokenKey: z.string() })).query(({ input }) => {
    try {
      const settings = readSettings()
      if (!settings[input.tokenKey]) {
        return null
      }
      const decryptedBuffer = safeStorage.decryptString(
        Buffer.from(settings[input.tokenKey], 'hex')
      )
      return decryptedBuffer
    } catch (error) {
      logger.error('Failed to get API token:', error)
      return null
    }
  }),

  setApiToken: t.procedure
    .input(z.object({ tokenKey: z.string(), tokenValue: z.string() }))
    .mutation(({ input }) => {
      try {
        const settings = readSettings()
        const encryptedBuffer = safeStorage.encryptString(input.tokenValue)
        settings[input.tokenKey] = encryptedBuffer.toString('hex')
        writeSettings(settings)
        return { success: true }
      } catch (error) {
        logger.error('Failed to set API token:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }),

  deleteApiToken: t.procedure.input(z.object({ tokenKey: z.string() })).mutation(({ input }) => {
    try {
      const settings = readSettings()
      delete settings[input.tokenKey]
      writeSettings(settings)
      return { success: true }
    } catch (error) {
      logger.error('Failed to delete API token:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }),

  getAllTokenKeys: t.procedure.query(() => {
    try {
      const settings = readSettings()
      return Object.keys(settings)
    } catch (error) {
      logger.error('Failed to get token keys:', error)
      return []
    }
  })
})

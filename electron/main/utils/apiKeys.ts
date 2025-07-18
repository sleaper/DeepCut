import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { logger } from './logger'

export const getApiKey = (key: string): string | null => {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = path.join(userDataPath, 'settings.json')

    if (!fs.existsSync(settingsPath)) {
      logger.error(`Settings file not found at ${settingsPath}`)
      return null
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))

    if (!settings[key]) {
      logger.error(`API key ${key} not found in settings`)
      return null
    }

    return safeStorage.decryptString(Buffer.from(settings[key], 'hex'))
  } catch (error) {
    logger.error(`Failed to get API key ${key}:`, error)
    return null
  }
}

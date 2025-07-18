import path from 'path'
import fs from 'fs/promises'
import { t } from '../trpc'
import { z } from 'zod'
import { clipsDir } from './clips'

export const assetsRouter = t.router({
  getClip: t.procedure.input(z.object({ clipId: z.string() })).query(async ({ input }) => {
    const filePath = path.join(clipsDir, `${input.clipId}.mp4`)

    if (!filePath.startsWith(clipsDir)) {
      return { success: false, error: 'Access denied' }
    }

    try {
      await fs.access(filePath)
      return `clips://${input.clipId}`
    } catch {
      return { success: false, error: 'File not found' }
    }
  }),

  clipExists: t.procedure.input(z.object({ clipId: z.string() })).query(async ({ input }) => {
    const filePath = path.join(clipsDir, `${input.clipId}.mp4`)

    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }),

  // Get full path for a clip file
  getClipPath: t.procedure.input(z.object({ clipId: z.string() })).query(async ({ input }) => {
    const filePath = path.join(clipsDir, `${input.clipId}.mp4`)

    if (!filePath.startsWith(clipsDir)) {
      throw new Error('Access denied')
    }

    try {
      await fs.access(filePath)
      return filePath
    } catch {
      throw new Error('File not found')
    }
  })
})

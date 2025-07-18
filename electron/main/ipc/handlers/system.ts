import { shell } from 'electron'
import { db } from '../../database'
import { clips, videos } from '../../database/schema'
import { count, desc, eq, sql } from 'drizzle-orm'
import { logger } from '../../utils/logger'
import { t } from '../trpc'
import { z } from 'zod'

async function checkDbConnection() {
  try {
    await db.get(sql`SELECT 1`)
    return { status: 'ok' as const, message: 'Database connection successful.' }
  } catch (error) {
    logger.error('Database connection failed:', error)
    return { status: 'error' as const, message: 'Database connection failed.' }
  }
}

export const systemRouter = t.router({
  health: t.procedure.query(async () => {
    try {
      const dbStatus = await checkDbConnection()
      const services = [
        { name: 'Database', status: dbStatus.status, message: dbStatus.message },
        { name: 'Desktop App', status: 'ok' as const, message: 'Desktop application running.' }
      ]
      const overallStatus = services.every((s) => s.status === 'ok')
        ? ('ok' as const)
        : ('error' as const)

      return { success: true, status: overallStatus, services }
    } catch (error) {
      logger.error('System health check failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }),

  metrics: t.procedure.query(async () => {
    try {
      const totalVideos = await db.select({ value: count() }).from(videos)
      const totalClips = await db.select({ value: count() }).from(clips)
      const producedClips = await db
        .select({ value: count() })
        .from(clips)
        .where(eq(clips.status, 'produced'))

      return {
        success: true,
        totalVideos: totalVideos[0].value,
        totalClips: totalClips[0].value,
        producedClips: producedClips[0].value
      }
    } catch (error) {
      logger.error('Failed to get system metrics:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }),

  activity: t.procedure.query(async () => {
    try {
      const recentClips = await db
        .select({
          id: clips.id,
          text: sql<string>`'Clip "' || ${clips.proposedTitle} || '" processed.'`,
          timestamp: clips.updatedAt,
          status: clips.status,
          type: sql<string>`'clip'`
        })
        .from(clips)
        .where(eq(clips.status, 'produced'))
        .orderBy(desc(clips.updatedAt))
        .limit(10)

      const recentVideos = await db
        .select({
          id: videos.videoId,
          text: sql<string>`'Video "' || ${videos.title} || '" added.'`,
          timestamp: videos.createdAt,
          status: sql<string>`'info'`,
          type: sql<string>`'video'`
        })
        .from(videos)
        .orderBy(desc(videos.createdAt))
        .limit(10)

      const combined = [...recentClips, ...recentVideos].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      return { success: true, activity: combined.slice(0, 10) }
    } catch (error) {
      logger.error('Failed to get system activity:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }),

  openExternal: t.procedure.input(z.object({ url: z.string() })).mutation(({ input }) => {
    shell.openExternal(input.url)
  }),

  showInFolder: t.procedure.input(z.object({ path: z.string() })).mutation(({ input }) => {
    shell.showItemInFolder(input.path)
  }),

  showClipInFolder: t.procedure.input(z.object({ clipId: z.string() })).mutation(({ input }) => {
    const path = require('path')
    const { app } = require('electron')
    const dataDir = app.getPath('userData')
    const clipsDir = path.join(dataDir, 'clips')
    const filePath = path.join(clipsDir, `${input.clipId}.mp4`)
    shell.showItemInFolder(filePath)
  })
})

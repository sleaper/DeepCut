import { db, clips, videos } from '../../database'
import { eq } from 'drizzle-orm'
import { t } from '../trpc'
import { z } from 'zod'
import { logger } from '../../utils/logger'
import path from 'path'
import fs from 'fs/promises'
import { audioDir } from '../../index'
import { app } from 'electron'

export const dataDir = app.getPath('userData')
export const clipsDir = path.join(dataDir, 'clips')

export const videosRouter = t.router({
  getAll: t.procedure.query(async () => {
    // Get all videos
    const allVideos = await db.select().from(videos)

    // Get all clips
    const allClips = await db.select().from(clips)

    // Group clips by videoId
    const clipsByVideoId = allClips.reduce(
      (acc, clip) => {
        if (!acc[clip.videoId]) {
          acc[clip.videoId] = []
        }
        acc[clip.videoId].push(clip)
        return acc
      },
      {} as Record<string, typeof allClips>
    )

    // Combine videos with their clips
    const videosWithClips = allVideos.map((video) => ({
      ...video,
      clips: clipsByVideoId[video.videoId] || []
    }))

    return videosWithClips
  }),
  deleteVideo: t.procedure.input(z.object({ videoId: z.string() })).mutation(async ({ input }) => {
    const { videoId } = input

    try {
      const videoClips = await db.select().from(clips).where(eq(clips.videoId, videoId))

      for (const clip of videoClips) {
        const clipPath = path.join(clipsDir, `${clip.id}.mp4`)
        try {
          await fs.unlink(clipPath)
          logger.info(`Deleted clip file: ${clipPath}`)
        } catch (error) {
          // File might not exist, which is fine
          logger.debug(`Clip file not found or already deleted: ${clipPath}`)
        }
      }

      const audioPath = path.join(audioDir, `${videoId}.wav`)
      try {
        await fs.unlink(audioPath)
        logger.info(`Deleted audio file: ${audioPath}`)
      } catch (error) {
        // File might not exist, which is fine
        logger.debug(`Audio file not found or already deleted: ${audioPath}`)
      }

      await db.delete(videos).where(eq(videos.videoId, videoId))

      logger.info(`Successfully deleted video ${videoId} and all associated clips`)
      return { success: true, message: 'Video and all associated clips deleted successfully' }
    } catch (error) {
      logger.error(`Failed to delete video ${videoId}:`, error)
      throw new Error(
        `Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })
})

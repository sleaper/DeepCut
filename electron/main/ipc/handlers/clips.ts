import { db, clips, videos, posts } from '../../database'
import { desc, and, asc, SQL, eq, inArray } from 'drizzle-orm'
import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger'
import { regenerateClipSummary, Transcript } from '../../utils/ai'
import { postClipToTwitter } from '../../utils/twitter'
import { produceClip } from '../../pipeline/production'
import { t } from '../trpc'
import { z } from 'zod'
import { app } from 'electron'
import { existsSync } from 'fs'

export const dataDir = app.getPath('userData')
export const clipsDir = path.join(dataDir, 'clips')

export const clipsRouter = t.router({
  getClips: t.procedure
    .input(
      z
        .object({
          sortBy: z.string().optional(),
          sortOrder: z.enum(['asc', 'desc']).optional(),
          status: z.enum(['pending', 'error', 'produced', 'posted', 'All']).optional()
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { sortBy = 'createdAt', sortOrder = 'desc', status } = input || {}
      const sortColumn = sortBy === 'updatedAt' ? clips.updatedAt : clips.createdAt
      const whereConditions: SQL[] = []

      if (status && status !== 'All') {
        whereConditions.push(eq(clips.status, status))
      }

      const newClips = await db
        .select({
          id: clips.id,
          videoId: clips.videoId,
          startTime: clips.startTime,
          endTime: clips.endTime,
          llmReason: clips.llmReason,
          proposedTitle: clips.proposedTitle,
          status: clips.status,
          errorMessage: clips.errorMessage,
          summary: clips.summary,
          videoTitle: videos.title,
          createdAt: clips.createdAt,
          updatedAt: clips.updatedAt,
          channelName: videos.channelName,
          srt: clips.srt,
          deepgramResponse: clips.deepgramResponse,
          postUrl: clips.postUrl,
          postId: clips.postId
        })
        .from(clips)
        .leftJoin(videos, eq(clips.videoId, videos.videoId))
        .where(and(...whereConditions))
        .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))

      return newClips
    }),

  deleteClip: t.procedure.input(z.object({ clipId: z.string() })).mutation(async ({ input }) => {
    const clip = await db.query.clips.findFirst({
      where: eq(clips.id, input.clipId)
    })

    if (clip?.id) {
      const filePath = path.join(clipsDir, `${clip.id}.mp4`)
      try {
        await fs.unlink(filePath)
      } catch (error) {
        logger.error(`Failed to delete file: ${filePath}`, error)
      }
    }

    await db.delete(clips).where(eq(clips.id, input.clipId))
  }),

  regenerateClipSummary: t.procedure
    .input(z.object({ clipId: z.string() }))
    .mutation(async ({ input }) => {
      const clip = await db.query.clips.findFirst({
        where: eq(clips.id, input.clipId)
      })

      if (!clip) {
        return { success: false, message: 'Clip not found' }
      }

      const video = await db.query.videos.findFirst({
        where: eq(videos.videoId, clip.videoId)
      })

      if (!video || !video.transcript) {
        return { success: false, message: 'Video transcript not available' }
      }

      const transcript = JSON.parse(video.transcript) as Transcript[]
      let newSummary: string
      try {
        newSummary = await regenerateClipSummary(
          transcript,
          clip.startTime,
          clip.endTime,
          clip.proposedTitle,
          clip.summary,
          'gemini_2_0'
        )
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message.includes('503') || e.message.includes('UNAVAILABLE'))
        ) {
          logger.info('Gemini 2.0 failed, trying Gemini 1.5')
          newSummary = await regenerateClipSummary(
            transcript,
            clip.startTime,
            clip.endTime,
            clip.proposedTitle,
            clip.summary,
            'gemini_1_5'
          )
        } else {
          throw e
        }
      }

      await db
        .update(clips)
        .set({
          summary: newSummary,
          updatedAt: new Date().toISOString()
        })
        .where(eq(clips.id, input.clipId))

      logger.info(`✅ Regenerated summary for clip ${input.clipId}`)

      return newSummary
    }),

  updateClipSummary: t.procedure
    .input(z.object({ clipId: z.string(), summary: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(clips)
        .set({
          summary: input.summary,
          updatedAt: new Date().toISOString()
        })
        .where(eq(clips.id, input.clipId))

      logger.info(`✅ Updated summary for clip ${input.clipId}`)
      return input.summary
    }),

  postClipToX: t.procedure.input(z.object({ clipId: z.string() })).mutation(async ({ input }) => {
    const clip = await db.query.clips.findFirst({
      where: eq(clips.id, input.clipId)
    })

    if (!clip) {
      throw new Error('Clip not found')
    }
    const filePath = path.join(clipsDir, `${clip.id}.mp4`)
    if (!existsSync(filePath)) {
      throw new Error('Clip video file not found')
    }
    if (!clip.summary) {
      throw new Error('Clip summary not available')
    }
    if (clip.status !== 'produced') {
      throw new Error('Clip must be in "produced" status to post')
    }
    if (await fs.access(filePath).catch(() => false)) {
      throw new Error('Clip video file not found')
    }

    const existingPost = await db
      .select()
      .from(posts)
      .where(and(eq(posts.clipId, input.clipId), eq(posts.platform, 'X')))
      .limit(1)
      .then((rows: any[]) => rows[0] || null)

    if (existingPost) {
      throw new Error('Clip has already been posted to X')
    }

    try {
      const result = await postClipToTwitter(filePath, clip.summary, clip.videoId)
      await db.insert(posts).values({
        clipId: input.clipId,
        platform: 'X',
        postUrl: result.postUrl
      })
      await db.update(clips).set({ status: 'posted' }).where(eq(clips.id, input.clipId))

      logger.info(`✅ Successfully posted clip ${input.clipId} to X: ${result.postUrl}`)

      return result.postUrl
    } catch (error) {
      throw error
    }
  }),

  produceClips: t.procedure
    .input(
      z.object({
        clips: z.array(z.object({ id: z.string(), startTime: z.number(), endTime: z.number() }))
      })
    )
    .mutation(async ({ input }) => {
      const { clips: updatedClips } = input

      if (!updatedClips || updatedClips.length === 0) {
        return { success: false, message: 'No clips provided for production.' }
      }

      for (const clip of updatedClips) {
        await db
          .update(clips)
          .set({
            startTime: clip.startTime,
            endTime: clip.endTime
          })
          .where(eq(clips.id, clip.id))
      }

      const clipIds = updatedClips.map((c) => c.id)
      const clipsToProduce = await db
        .select({
          clip: clips
        })
        .from(clips)
        .where(inArray(clips.id, clipIds))

      logger.info(`🎬 Starting production for ${clipsToProduce.length} clips`)

      const productionPromises = clipsToProduce.map(({ clip }) => produceClip(clip))
      const results = await Promise.all(productionPromises)

      const successfulClips = results.filter((r) => r.success)
      const failedClips = results.filter((r) => !r.success)

      if (failedClips.length > 0) {
        logger.error(`Failed to produce ${failedClips.length} clips:`, failedClips)
      }

      logger.info(
        `✅ Production completed: ${successfulClips.length} successful, ${failedClips.length} failed`
      )

      return {
        success: true,
        message: `Successfully initiated production for ${successfulClips.length} clips.`,
        successfulClips,
        failedClips
      }
    })
})

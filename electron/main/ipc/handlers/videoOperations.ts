import { db } from '../../database'
import { videos, clips, Clip } from '../../database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getVideoMetadata } from '../../utils/video'
import { processVideo } from '../../pipeline/start'
import { logger } from '../../utils/logger'
import { produceClip } from '../../pipeline/production'
import { z } from 'zod'
import { t } from '../trpc'
import { transcription } from '../../pipeline/transcription'
import { processVideoTranscriptAnalysis } from '../../pipeline/analysis'
import { progressTracker } from '@/utils/progressTracker'

export const videoOperationRouter = t.router({
  videoSubmission: t.procedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ input }) => {
      const { videoId } = input

      progressTracker.updateProgress(videoId, {
        stage: 'download',
        progress: 20,
        message: 'Downloading video...'
      })

      const {
        videoId: newVideoId,
        channelId: youtubeChannelId,
        channelName,
        title,
        publishedAt
      } = await getVideoMetadata(videoId)

      if (!channelName) {
        throw new Error('Could not determine channel name for this video.')
      }

      const existingVideo = db.select().from(videos).where(eq(videos.videoId, newVideoId)).get()
      if (!existingVideo) {
        await db.insert(videos).values({
          videoId: newVideoId,
          title: title,
          channelName: channelName,
          youtubeChannelId: youtubeChannelId,
          publishedAt: publishedAt,
          status: 'pending',
          context: '',
          transcript: null
        })
        logger.info(`✅ Manually added video ${newVideoId} to the database.`)
      } else {
        logger.warn(`⚠️ Video ${newVideoId} already exists. Reprocessing.`)
        await db
          .update(videos)
          .set({ status: 'pending', updatedAt: new Date().toISOString() })
          .where(eq(videos.videoId, newVideoId))
      }

      setImmediate(() => {
        processVideo(newVideoId).catch((error) => {
          throw error
        })
      })
    }),
  produceClips: t.procedure
    .input(
      z.object({
        clips: z.array(z.object({ id: z.string(), startTime: z.number(), endTime: z.number() }))
      })
    )
    .mutation(async ({ input }) => {
      const { clips: newClips } = input
      const clipsToProduce = await db.transaction(async (tx) => {
        for (const clip of newClips) {
          await tx
            .update(clips)
            .set({
              startTime: clip.startTime,
              endTime: clip.endTime
            })
            .where(eq(clips.id, clip.id))
        }
        const clipIds = newClips.map((c) => c.id)
        return tx
          .select({
            clip: clips
          })
          .from(clips)
          .where(inArray(clips.id, clipIds))
      })

      const productionPromises = clipsToProduce.map(({ clip }) => produceClip(clip))
      return await Promise.all(productionPromises)
    }),

  videoStatus: t.procedure.input(z.object({ videoId: z.string() })).query(async ({ input }) => {
    const { videoId } = input
    const video = db.select().from(videos).where(eq(videos.videoId, videoId)).get()
    if (!video) {
      return { success: false, error: 'Video not found' }
    }

    const videoClips = db
      .select({ id: clips.id })
      .from(clips)
      .where(and(eq(clips.videoId, video.videoId), eq(clips.status, 'produced')))
      .all()
    const clipPaths = videoClips.map((c) => c.id).filter((p) => p)
    return { success: true, status: video.status, clips: clipPaths }
  }),
  manualAnalyze: t.procedure
    .input(
      z.object({
        videoId: z.string(),
        promptType: z.string(),
        customLookFor: z.string(),
        existingClips: z.optional(
          z.array(
            z.object({
              id: z.string(),
              startTime: z.number(),
              endTime: z.number(),
              proposedTitle: z.string(),
              summary: z.optional(z.string())
            })
          )
        )
      })
    )
    .mutation(async ({ input }) => {
      const { videoId, promptType, customLookFor, existingClips } = input

      logger.info(
        `Received request to analyze ${videoId} with query "${promptType}" and customLookFor "${customLookFor}"${
          existingClips?.length ? ` with ${existingClips.length} existing clips` : ''
        }`
      )

      await transcription(videoId)

      let clips: Clip[] = []
      try {
        clips = await processVideoTranscriptAnalysis(
          videoId,
          promptType,
          customLookFor,
          'gemini_2_0',
          existingClips
        )
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message.includes('503') || e.message.includes('UNAVAILABLE'))
        ) {
          logger.info('Gemini 2.0 failed, trying Gemini 1.5')
          clips = await processVideoTranscriptAnalysis(
            videoId,
            promptType,
            customLookFor,
            'gemini_1_5',
            existingClips
          )
        } else {
          throw e
        }
      }

      return clips
    })
})

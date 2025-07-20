import { db } from '@db/db'
import { videos } from '@db/schema'
import { eq } from 'drizzle-orm'
import { transcribeVideo } from '@/utils/video'
import { getVideoMetadata } from '@/utils/video'
import { progressTracker } from '@/utils/progressTracker'

export async function transcription(videoId: string) {
  try {
    const video = db.select().from(videos).where(eq(videos.videoId, videoId)).get()

    if (video && video.status === 'transcribed') {
      console.log(`✅ Video ${video.videoId} already transcribed, skipping`)
      progressTracker.updateProgress(videoId, {
        stage: 'transcription',
        progress: 100,
        message: 'Already transcribed'
      })
      return
    }

    const transcript = await transcribeVideo(videoId)
    if (!video) {
      const { description, channelId, title, publishedAt, channelName } =
        await getVideoMetadata(videoId)

      await db.insert(videos).values({
        videoId,
        transcript,
        context: description,
        youtubeChannelId: channelId,
        channelName,
        title,
        publishedAt,
        status: 'transcribed'
      })
    } else {
      await db
        .update(videos)
        .set({
          status: 'transcribed',
          transcript
        })
        .where(eq(videos.videoId, videoId))
    }

    console.log(`✅ Transcribed video: ${videoId}`)
  } catch (error) {
    console.error(`❌ Failed to transcribe ${videoId}:`, error)

    await db
      .update(videos)
      .set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
      .where(eq(videos.videoId, videoId))
    throw error
  }
}

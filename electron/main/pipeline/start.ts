import { transcription } from './transcription'
import { processVideoTranscriptAnalysis } from './analysis'
import { db } from '@db/db'
import { clips, videos, Clip } from '@db/schema'
import { eq } from 'drizzle-orm'
import { produceClip } from './production'
import { progressTracker } from '@/utils/progressTracker'

export async function processVideo(videoId: string) {
  try {
    // Step 1: Get transcripts for a new video
    await transcription(videoId)

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 0,
      message: 'Analyzing...'
    })

    const existingClips = await db.select().from(clips).where(eq(clips.videoId, videoId))

    // Step 2: Analyze transcribed videos
    let newClips: Clip[] = []
    try {
      newClips = await processVideoTranscriptAnalysis(
        videoId,
        'default',
        '',
        'gemini_2_0',
        existingClips
      )
    } catch (e) {
      if (e instanceof Error && (e.message.includes('503') || e.message.includes('UNAVAILABLE'))) {
        console.log('Gemini 2.0 failed, trying Gemini 1.5')
        newClips = await processVideoTranscriptAnalysis(
          videoId,
          'default',
          '',
          'gemini_1_5',
          existingClips
        )
      } else {
        throw e
      }
    }

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 100,
      message: 'Analysis complete',
      clipsIds: newClips.map((clip) => clip.id)
    })

    progressTracker.updateProgress(videoId, {
      stage: 'production',
      progress: 0,
      message: 'Producing clips...'
    })

    // Step 3: Produce clips for analyzed videos

    for (let i = 0; i < newClips.length; i++) {
      const clip = newClips[i]
      const progress = Math.round((i / newClips.length) * 100)

      // Update overall progress
      progressTracker.updateProgress(videoId, {
        progress,
        message: `Producing clip ${i + 1} of ${newClips.length}: ${clip.proposedTitle}`,
        stage: 'production'
      })

      const newClipId = await produceClip(clip)

      // Update after completion
      progressTracker.updateProgress(videoId, {
        progress: Math.round(((i + 1) / newClips.length) * 100),
        message: `Completed clip ${i + 1} of ${newClips.length}`,
        stage: 'production',
        newClipId
      })
    }

    // Step 4: Distribute produced clips (for desktop this will be local file management)

    // Mark as complete instead of clearing immediately
    progressTracker.updateProgress(videoId, {
      progress: 100,
      message: 'All clips produced successfully!',
      stage: 'complete'
    })
  } catch (error) {
    await db
      .update(videos)
      .set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString()
      })
      .where(eq(videos.videoId, videoId))

    throw error
  } finally {
    progressTracker.clearProgress(videoId)
  }
}

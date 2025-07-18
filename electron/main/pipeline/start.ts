import { transcription } from './transcription'
import { Clip, processVideoTranscriptAnalysis } from './analysis'
import { db } from '@db/db'
import { videos } from '@db/schema'
import { eq } from 'drizzle-orm'

// Main processing loop
export async function processVideo(videoId: string) {
  try {
    // Step 1: Get transcripts for a new video
    await transcription(videoId)

    // Step 2: Analyze transcribed videos
    let newClips: Clip[] = []
    try {
      newClips = await processVideoTranscriptAnalysis(videoId, 'default', '', 'gemini_2_0')
    } catch (e) {
      if (e instanceof Error && (e.message.includes('503') || e.message.includes('UNAVAILABLE'))) {
        console.log('Gemini 2.0 failed, trying Gemini 1.5')
        newClips = await processVideoTranscriptAnalysis(videoId, 'default', '', 'gemini_1_5')
      } else {
        throw e
      }
    }

    // Step 3: Produce clips for analyzed videos
    for (const clip of newClips) {
      //await produceClip(clip)
      console.log('Now would produce clip', clip)
    }

    // Step 4: Distribute produced clips (for desktop this will be local file management)
    //await distributeProducedClips()
  } catch (error) {
    console.error('❌ Error in processing loop:', error)
    await db
      .update(videos)
      .set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString()
      })
      .where(eq(videos.videoId, videoId))
  }
}

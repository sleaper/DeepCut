import { db } from '@db/db'
import { videos, clips, Clip } from '@db/schema'
import { eq } from 'drizzle-orm'
import { createAIClips, Transcript, ExistingClip } from '../utils/ai'
import { progressTracker } from '@/utils/progressTracker'

// Step 2: Analyze transcribed videos to find interesting clips
export async function processVideoTranscriptAnalysis(
  videoId: string,
  promptType: string,
  customLookFor: string,
  model: string,
  existingClips?: ExistingClip[]
): Promise<Clip[]> {
  try {
    // Update progress for analysis stage
    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 10,
      message: 'Starting analysis...'
    })

    const video = db.select().from(videos).where(eq(videos.videoId, videoId)).get()

    if (!video) {
      throw new Error('Video not found')
    }

    console.log(
      `🧠 Analyzing ${video.videoId} transcribed video${
        existingClips?.length ? ` with ${existingClips.length} existing clips to avoid` : ''
      }`
    )

    if (!video.transcript) {
      throw new Error('No transcript found')
    }

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 30,
      message: 'Processing transcript...'
    })

    const transcript = JSON.parse(video.transcript) as Transcript[]

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 50,
      message: 'Analyzing with AI...'
    })

    // Create clips from AI transcript analysis
    const clipData = await createAIClips(
      transcript,
      promptType,
      customLookFor,
      video.context,
      model,
      existingClips
    )

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 80,
      message: 'Saving clips...'
    })

    const newClips: Clip[] = clipData.map((clip) => ({
      ...clip,
      id: crypto.randomUUID(),
      videoId: video.videoId,
      status: 'pending',
      errorMessage: null,
      postUrl: null,
      postId: null,
      srt: null,
      deepgramResponse: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))

    await db.insert(clips).values(newClips)

    // Mark video as analyzed
    await db
      .update(videos)
      .set({ status: 'transcribed', updatedAt: new Date().toISOString() })
      .where(eq(videos.videoId, video.videoId))

    progressTracker.updateProgress(videoId, {
      stage: 'analysis',
      progress: 100,
      message: 'Analysis complete'
    })

    console.log(`✅ Analyzed video: ${video.videoId}, found ${clipData.length} clips`)

    return newClips
  } catch (error) {
    console.error(`❌ Failed to analyze ${videoId} with ${model}:`, error)
    throw error
  }
}

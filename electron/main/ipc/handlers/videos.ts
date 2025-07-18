import { db, clips, videos } from '../../database'
import { eq } from 'drizzle-orm'
import { t } from '../trpc'
import { z } from 'zod'

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
  getClips: t.procedure.input(z.string()).query(async ({ input: videoId }) => {
    const videoClips = await db.select().from(clips).where(eq(clips.videoId, videoId))
    return videoClips
  })
})

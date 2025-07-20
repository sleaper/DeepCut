import { t } from '../trpc'
import { z } from 'zod'
import { observable } from '@trpc/server/observable'
import { progressTracker, PipelineProgress } from '@/utils/progressTracker'

export const progressRouter = t.router({
  subscribeToProgress: t.procedure
    .input(z.object({ videoId: z.string() }))
    .subscription(({ input }) => {
      return observable<PipelineProgress>((emit) => {
        const currentProgress = progressTracker.getProgress(input.videoId)
        if (currentProgress) {
          emit.next(currentProgress)
        }

        // Set up observer (this is where the magic happens!)
        const handleProgress = (progress: PipelineProgress) => {
          if (progress.videoId === input.videoId) {
            emit.next(progress) // Send to client
          }
        }

        // Subscribe to progress updates
        progressTracker.on('progress-update', handleProgress)

        // Cleanup function (runs when client unsubscribes)
        return () => {
          progressTracker.off('progress-update', handleProgress)
        }
      })
    })
})

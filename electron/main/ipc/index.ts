import { videoOperationRouter } from './handlers/videoOperations'
import { videosRouter } from './handlers/videos'
import { t } from './trpc'
import { systemRouter } from './handlers/system'
import { settingsRouter } from './handlers/settings'
import { clipsRouter } from './handlers/clips'
import { assetsRouter } from './handlers/assets'
import { progressRouter } from './handlers/progress'

export const router = t.router({
  videoOperations: videoOperationRouter,
  videos: videosRouter,
  system: systemRouter,
  settings: settingsRouter,
  clips: clipsRouter,
  assets: assetsRouter,
  progress: progressRouter
})

export type AppRouter = typeof router

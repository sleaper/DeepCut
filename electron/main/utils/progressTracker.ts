import { EventEmitter } from 'events'

export interface PipelineProgress {
  videoId: string
  stage: 'transcription' | 'analysis' | 'production' | 'download' | 'complete'
  progress: number
  message: string
  clipsIds?: string[]
  newClipId?: string
}

class ProgressTracker extends EventEmitter {
  private progressMap = new Map<string, PipelineProgress>()

  // Method to update progress (Subject notifies Observers)
  updateProgress(videoId: string, progress: Partial<PipelineProgress>) {
    const current = this.progressMap.get(videoId) || {
      videoId,
      stage: 'transcription',
      progress: 0,
      message: 'Starting...'
    }

    const updated = { ...current, ...progress }
    this.progressMap.set(videoId, updated)

    this.emit('progress-update', updated)

    if (progress.stage) {
      this.emit(`${progress.stage}-update`, updated)
    }
  }

  // Method to get current progress
  getProgress(videoId: string): PipelineProgress | null {
    return this.progressMap.get(videoId) || null
  }

  // Method to clean up when done
  clearProgress(videoId: string) {
    this.progressMap.delete(videoId)
  }
}

// Create a singleton instance
export const progressTracker = new ProgressTracker()

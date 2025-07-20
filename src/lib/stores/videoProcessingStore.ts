import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PipelineProgress } from '../../../electron/main/utils/progressTracker'
import { Clip } from '@/database'

interface VideoProcessingState {
  // Current video being processed
  currentVideoId: string | null
  videoUrl: string

  // Processing state
  isProcessing: boolean
  processingStage: string
  progress: number
  pipelineProgress: PipelineProgress | null

  // Generated clips
  generatedClips: Clip[]

  // Actions
  setCurrentVideoId: (videoId: string | null) => void
  setVideoUrl: (url: string) => void
  setIsProcessing: (processing: boolean) => void
  setProcessingStage: (stage: string) => void
  setProgress: (progress: number) => void
  setPipelineProgress: (progress: PipelineProgress | null) => void
  setGeneratedClips: (clips: Clip[]) => void
  addGeneratedClip: (clip: Clip) => void
  updateGeneratedClip: (clipId: string, updates: Partial<Clip>) => void

  // Reset state
  reset: () => void
}

const initialState = {
  currentVideoId: null,
  videoUrl: 'https://www.youtube.com/watch?v=kOyIjt6FUrw',
  isProcessing: false,
  processingStage: '',
  progress: 0,
  pipelineProgress: null,
  generatedClips: []
}

export const useVideoProcessingStore = create<VideoProcessingState>()(
  persist(
    (set) => ({
      ...initialState,
      setCurrentVideoId: (videoId) => set({ currentVideoId: videoId }),
      setVideoUrl: (url) => set({ videoUrl: url }),
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      setProcessingStage: (stage) => set({ processingStage: stage }),
      setProgress: (progress) => set({ progress }),
      setPipelineProgress: (progress) => set({ pipelineProgress: progress }),
      setGeneratedClips: (clips) => set({ generatedClips: clips }),
      addGeneratedClip: (clip) =>
        set((state) => ({
          generatedClips: [...state.generatedClips, clip]
        })),

      updateGeneratedClip: (clipId, updates) =>
        set((state) => ({
          generatedClips: state.generatedClips.map((clip) =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          )
        })),

      reset: () => set(initialState)
    }),
    {
      name: 'video-processing-storage',
      partialize: (state) => ({
        videoUrl: state.videoUrl,
        generatedClips: state.generatedClips
      })
    }
  )
)
